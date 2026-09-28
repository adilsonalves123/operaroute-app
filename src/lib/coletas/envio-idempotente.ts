import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { getAppBootstrap } from "@/lib/supabase/app-bootstrap";
import { notifyEmpresaAdminsBackground } from "@/lib/push/notify-admins";
import {
  coletadoEmDoEnvio,
  diferencasLidas,
  HEADER_ENVIO_ID,
  lerEnvioOffline,
  UUID_RE,
  type ValoresLidos,
} from "@/lib/coletas/envio-offline";

/** "processando" parado há mais que isso = a tentativa anterior morreu no meio. */
const PROCESSANDO_TRAVADO_MS = 5 * 60 * 1000;

type Reivindicacao =
  | { tipo: "novo" }
  | { tipo: "sem_registro" }
  | { tipo: "duplicado"; resposta: unknown; httpStatus: number }
  | { tipo: "processando" }
  | { tipo: "outro_usuario" };

type Meta = {
  empresaId: string;
  userId: string;
  rota: string;
  offline: boolean;
  coletadoEm: string | null;
};

async function reivindicar(
  admin: SupabaseClient,
  envioId: string,
  meta: Meta
): Promise<Reivindicacao> {
  const dados = {
    empresa_id: meta.empresaId,
    user_id: meta.userId,
    rota: meta.rota,
    offline: meta.offline,
    coletado_em: meta.coletadoEm,
  };
  const { error } = await admin
    .from("coleta_envios")
    .insert({ id: envioId, status: "processando", ...dados });
  if (!error) return { tipo: "novo" };
  // Sem a tabela (SQL não rodado) ou outro erro: segue sem proteção, como antes.
  if (error.code !== "23505") return { tipo: "sem_registro" };

  const { data: row } = await admin
    .from("coleta_envios")
    .select("user_id, status, http_status, resposta, updated_at")
    .eq("id", envioId)
    .maybeSingle();
  if (!row) return { tipo: "sem_registro" };
  if (row.user_id !== meta.userId) return { tipo: "outro_usuario" };
  if (row.status === "ok") {
    return { tipo: "duplicado", resposta: row.resposta, httpStatus: row.http_status ?? 200 };
  }

  const travado =
    row.status === "processando" &&
    Date.now() - new Date(row.updated_at).getTime() > PROCESSANDO_TRAVADO_MS;
  if (row.status === "processando" && !travado) return { tipo: "processando" };

  // Tentativa anterior deu erro: libera nova tentativa (só uma requisição pega).
  const { data: pegou } = await admin
    .from("coleta_envios")
    .update({ status: "processando", updated_at: new Date().toISOString(), ...dados })
    .eq("id", envioId)
    .eq("status", row.status)
    .eq("updated_at", row.updated_at)
    .select("id");
  return pegou && pegou.length > 0 ? { tipo: "novo" } : { tipo: "processando" };
}

function lidoDaResposta(json: unknown): ValoresLidos | undefined {
  const lido = (json as { lido_no_envio?: unknown } | null)?.lido_no_envio;
  if (!lido || typeof lido !== "object") return undefined;
  const out: ValoresLidos = {};
  for (const [k, v] of Object.entries(lido as Record<string, unknown>)) {
    const n = Number(v);
    if (Number.isFinite(n)) out[k] = n;
  }
  return out;
}

/**
 * Envolve uma rota de coleta: mesmo `x-envio-id` nunca lança a coleta duas vezes
 * (devolve a resposta já gravada). Coleta vinda da fila offline é comparada com o
 * que o servidor leu no envio; se a dívida/haver/contadores mudaram, grava com o
 * valor do servidor e marca "revisar" (push para dono/admin).
 */
export function comEnvioIdempotente<C>(
  rota: string,
  handler: (request: Request, ctx: C) => Promise<Response>
): (request: Request, ctx: C) => Promise<Response> {
  return async (request, ctx) => {
    const envioId = request.headers.get(HEADER_ENVIO_ID)?.trim() ?? "";
    if (!UUID_RE.test(envioId) || !isAdminConfigured()) return handler(request, ctx);

    const { profile } = await getAppBootstrap();
    // Sem sessão/empresa: a própria rota responde o erro de acesso.
    if (!profile?.user_id || !profile.empresa_id) return handler(request, ctx);

    const body = await request.clone().json().catch(() => null);
    const envioOffline = lerEnvioOffline(body);
    const coletadoEm = coletadoEmDoEnvio(body);

    const admin = createAdminClient();
    const r = await reivindicar(admin, envioId, {
      empresaId: profile.empresa_id,
      userId: profile.user_id,
      rota,
      offline: Boolean(envioOffline),
      coletadoEm: coletadoEm?.toISOString() ?? null,
    });

    if (r.tipo === "sem_registro") return handler(request, ctx);
    if (r.tipo === "duplicado") {
      const resposta =
        r.resposta && typeof r.resposta === "object" ? { ...r.resposta, duplicado: true } : r.resposta;
      return NextResponse.json(resposta, { status: r.httpStatus });
    }
    if (r.tipo === "processando") {
      return NextResponse.json(
        { error: "Esta coleta já está sendo registrada. Aguarde um instante.", code: "envio_processando" },
        { status: 409 }
      );
    }
    if (r.tipo === "outro_usuario") {
      return NextResponse.json({ error: "Código de envio inválido." }, { status: 409 });
    }

    let res: Response;
    try {
      res = await handler(request, ctx);
    } catch (err) {
      await admin
        .from("coleta_envios")
        .update({ status: "erro", http_status: 500, updated_at: new Date().toISOString() })
        .eq("id", envioId);
      throw err;
    }

    const json = await res.clone().json().catch(() => null);
    const motivos = res.ok ? diferencasLidas(envioOffline?.previsto, lidoDaResposta(json)) : [];
    const revisar = motivos.length > 0;
    const resposta =
      revisar && json && typeof json === "object" ? { ...json, revisar: motivos } : json;

    await admin
      .from("coleta_envios")
      .update({
        status: res.ok ? "ok" : "erro",
        http_status: res.status,
        resposta,
        revisar,
        revisar_motivo: revisar ? motivos.join(" · ") : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", envioId);

    if (!revisar) return res;

    const pontoId = typeof body?.ponto_id === "string" ? body.ponto_id : null;
    notifyEmpresaAdminsBackground(profile.empresa_id, {
      title: "Coleta sem sinal para conferir",
      body: `${envioOffline?.ponto_nome ?? "Ponto"} · ${profile.nome ?? "Operador"}: ${motivos[0]}${
        motivos.length > 1 ? ` (+${motivos.length - 1})` : ""
      }. Gravada com o valor atual.`,
      url: pontoId ? `/pontos/${pontoId}` : "/coletas",
      tag: `coleta-revisar-${envioId}`,
    });

    return NextResponse.json(resposta, { status: res.status });
  };
}

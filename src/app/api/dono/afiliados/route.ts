import { NextResponse } from "next/server";
import { getDonoSession } from "@/lib/dono/session";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import {
  linkAfiliado,
  normalizarCodigo,
  toPublicAfiliado,
  type AfiliadoRow,
} from "@/lib/afiliados/core";
import { hashSenhaAfiliado } from "@/lib/afiliados/senha";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const session = await getDonoSession();
    if (!session) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }
    if (!isAdminConfigured()) {
      return NextResponse.json({ error: "Admin não configurado." }, { status: 503 });
    }

    const admin = createAdminClient();
    const origin = new URL(request.url).origin;
    const { data, error } = await admin
      .from("plataforma_afiliados")
      .select(
        "id, codigo, nome, email, whatsapp, comissao_tipo, comissao_valor, ativo, notas, created_at, senha_hash"
      )
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json(
        {
          afiliados: [],
          error: error.message.includes("plataforma_afiliados")
            ? "Rode supabase/plataforma-afiliados.sql no Supabase."
            : error.message,
        },
        { status: error.message.includes("plataforma_afiliados") ? 200 : 500 }
      );
    }

    const afiliados = (data ?? []) as AfiliadoRow[];
    const ids = afiliados.map((a) => a.id);

    const stats = new Map<
      string,
      { clicks: number; cadastros: number; pendente_centavos: number; pago_centavos: number }
    >();
    for (const id of ids) {
      stats.set(id, {
        clicks: 0,
        cadastros: 0,
        pendente_centavos: 0,
        pago_centavos: 0,
      });
    }

    if (ids.length > 0) {
      const [comissoesRes, eventosRes] = await Promise.all([
        admin
          .from("plataforma_afiliado_comissoes")
          .select("afiliado_id, valor_centavos, status")
          .in("afiliado_id", ids),
        admin
          .from("plataforma_afiliado_eventos")
          .select("afiliado_id, tipo")
          .in("afiliado_id", ids),
      ]);

      for (const e of eventosRes.data ?? []) {
        const s = stats.get(e.afiliado_id);
        if (!s) continue;
        if (e.tipo === "click") s.clicks += 1;
        if (e.tipo === "cadastro") s.cadastros += 1;
      }
      for (const c of comissoesRes.data ?? []) {
        const s = stats.get(c.afiliado_id);
        if (!s) continue;
        if (c.status === "pendente") s.pendente_centavos += Number(c.valor_centavos) || 0;
        if (c.status === "pago") s.pago_centavos += Number(c.valor_centavos) || 0;
      }
    }

    return NextResponse.json({
      afiliados: afiliados.map((a) => ({
        ...toPublicAfiliado(a),
        link: linkAfiliado(a.codigo, origin),
        stats: stats.get(a.id) ?? {
          clicks: 0,
          cadastros: 0,
          pendente_centavos: 0,
          pago_centavos: 0,
        },
      })),
    });
  } catch (e) {
    return NextResponse.json(
      {
        afiliados: [],
        error: e instanceof Error ? e.message : "Erro interno.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await getDonoSession();
    if (!session) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }
    if (!isAdminConfigured()) {
      return NextResponse.json({ error: "Admin não configurado." }, { status: 503 });
    }

    const body = await request.json().catch(() => ({}));
    const nome = String(body.nome ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();
    const senha = String(body.senha ?? "");
    const codigo = normalizarCodigo(String(body.codigo ?? nome));
    const whatsapp = String(body.whatsapp ?? "").trim() || null;
    const comissao_tipo =
      body.comissao_tipo === "fixo" ? "fixo" : "percentual";
    const comissao_valor = Number(body.comissao_valor);
    const notas = String(body.notas ?? "").trim() || null;

    if (!nome || !email || !codigo) {
      return NextResponse.json(
        { error: "Nome, e-mail e código são obrigatórios." },
        { status: 400 }
      );
    }
    if (senha.length < 6) {
      return NextResponse.json(
        { error: "Senha do parceiro: mínimo 6 caracteres." },
        { status: 400 }
      );
    }
    if (!Number.isFinite(comissao_valor) || comissao_valor < 0) {
      return NextResponse.json({ error: "Comissão inválida." }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("plataforma_afiliados")
      .insert({
        nome,
        email,
        codigo,
        senha_hash: hashSenhaAfiliado(senha),
        whatsapp,
        comissao_tipo,
        comissao_valor,
        notas,
        ativo: true,
      })
      .select(
        "id, codigo, nome, email, whatsapp, comissao_tipo, comissao_valor, ativo, notas, created_at, senha_hash"
      )
      .single();

    if (error) {
      const msg = error.message.includes("duplicate")
        ? "E-mail ou código já existe."
        : error.message.includes("plataforma_afiliados")
          ? "Rode supabase/plataforma-afiliados.sql no Supabase."
          : error.message;
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    const origin = new URL(request.url).origin;
    const row = data as AfiliadoRow;
    return NextResponse.json({
      afiliado: {
        ...toPublicAfiliado(row),
        link: linkAfiliado(row.codigo, origin),
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro interno." },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { createClient, getEmpresa, getProfile } from "@/lib/supabase/server";
import { canUseEquipamentoTipo, resolveNichosAtivos } from "@/lib/assinatura";
import type { EquipamentoTipo } from "@/lib/equipamentos";
import { isEquipamentoTipoDiversao, parseLeituraContador } from "@/lib/equipamentos";

function parsePrecoJogada(raw: unknown): number | null {
  if (raw == null || raw === "") return null;
  const n = Number(String(raw).replace(",", "."));
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100) / 100;
}

/** Cadastra equipamento no estoque central (ponto_id = null). */
export async function POST(request: Request) {
  const profile = await getProfile();
  if (!profile?.empresa_id) {
    return NextResponse.json({ error: "Empresa não encontrada" }, { status: 404 });
  }

  const body = await request.json();
  const nome = String(body.nome ?? "").trim();
  const numeroSerie = String(body.numero_serie ?? "").trim();
  const tipo = body.tipo as EquipamentoTipo;

  if (!nome || !tipo || !numeroSerie) {
    return NextResponse.json(
      { error: "Nome, tipo e número de série são obrigatórios." },
      { status: 400 }
    );
  }

  if (tipo === "bolinha") {
    const preco = parsePrecoJogada(body.preco_jogada);
    if (preco == null) {
      return NextResponse.json(
        { error: "Informe o valor da jogada (ex.: 2,00)" },
        { status: 400 }
      );
    }
  }

  const empresa = await getEmpresa(profile.empresa_id);
  const nichosAtivos = resolveNichosAtivos(empresa?.nichos_ativos, empresa?.nicho);
  if (!canUseEquipamentoTipo(nichosAtivos, tipo)) {
    return NextResponse.json(
      {
        error: "Nicho não contratado para este tipo de equipamento. Veja /planos.",
        nicho_bloqueado: true,
      },
      { status: 403 }
    );
  }

  const supabase = await createClient();
  const { encontrarSerieEmUso, mensagemSerieJaCadastrada } = await import(
    "@/lib/equipamentos/serie-unica"
  );
  const serieEmUso = await encontrarSerieEmUso(
    supabase,
    profile.empresa_id,
    numeroSerie
  );
  if (serieEmUso) {
    return NextResponse.json(
      { error: mensagemSerieJaCadastrada(numeroSerie, serieEmUso) },
      { status: 400 }
    );
  }

  const precoJogada = tipo === "bolinha" ? parsePrecoJogada(body.preco_jogada) : null;

  const { data, error } = await supabase
    .from("equipamentos")
    .insert({
      empresa_id: profile.empresa_id,
      ponto_id: null,
      nome,
      numero_maquina: null,
      numero_serie: numeroSerie,
      tipo,
      numero_entrada:
        tipo === "cassino" && body.numero_entrada
          ? parseLeituraContador(String(body.numero_entrada))
          : null,
      numero_saida:
        tipo === "cassino" && body.numero_saida
          ? parseLeituraContador(String(body.numero_saida))
          : null,
      entrada_atual:
        tipo === "bolinha"
          ? 0
          : (tipo === "ursinho" ||
                tipo === "vending_ursinho" ||
                isEquipamentoTipoDiversao(tipo)) &&
              body.entrada_atual
            ? parseLeituraContador(String(body.entrada_atual))
            : null,
      preco_jogada: precoJogada,
      observacao: body.observacao ? String(body.observacao).trim() : null,
      status: "ativo",
    })
    .select("*")
    .maybeSingle();

  if (error) {
    const msg = error.message ?? "";
    const needsMigration =
      msg.includes("null value") ||
      msg.includes("ponto_id") ||
      msg.includes("not-null") ||
      msg.includes("does not exist");

    return NextResponse.json(
      {
        error: needsMigration
          ? "Rode supabase/equipamentos-estoque-central.sql no Supabase (libera estoque sem ponto)."
          : msg,
      },
      { status: 500 }
    );
  }

  const { auditarAcao } = await import("@/lib/auditoria/auditar");
  await auditarAcao(supabase, profile, {
    acao: "equipamento.criar",
    tabela: "equipamentos",
    registroId: data?.id ?? null,
    dadosNovos: data as unknown as Record<string, unknown>,
    severidade: "medium",
    categoria: "equipamento",
    modulo: "pontos",
    titulo: `Cadastrou equipamento ${data?.nome ?? ""}`,
    resumo: `${data?.tipo ?? "—"} · Nº ${data?.numero_maquina ?? "—"}`,
    request,
  });

  return NextResponse.json({ success: true, equipamento: data });
}

export async function GET() {
  const profile = await getProfile();
  if (!profile?.empresa_id) {
    return NextResponse.json({ error: "Empresa não encontrada" }, { status: 404 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("equipamentos")
    .select("*, pontos(id, nome, status)")
    .eq("empresa_id", profile.empresa_id)
    .order("nome");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ items: data ?? [] });
}

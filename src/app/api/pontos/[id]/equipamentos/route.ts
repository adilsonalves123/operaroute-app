import { NextResponse } from "next/server";
import { createClient, getEmpresa, getProfile } from "@/lib/supabase/server";
import { canUseEquipamentoTipo, resolveNichosAtivos } from "@/lib/assinatura";
import type { EquipamentoTipo } from "@/lib/equipamentos";
import { parseLeituraContador, isEquipamentoTipoDiversao } from "@/lib/equipamentos";

function parsePrecoJogada(raw: unknown): number | null {
  if (raw == null || raw === "") return null;
  const n = Number(String(raw).replace(",", "."));
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100) / 100;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: pontoId } = await params;
  const profile = await getProfile();

  if (!profile?.empresa_id) {
    return NextResponse.json({ error: "Empresa não encontrada" }, { status: 404 });
  }

  const body = await request.json();
  const supabase = await createClient();

  const { data: ponto } = await supabase
    .from("pontos")
    .select("id")
    .eq("id", pontoId)
    .eq("empresa_id", profile.empresa_id)
    .maybeSingle();

  if (!ponto) {
    return NextResponse.json({ error: "Ponto não encontrado" }, { status: 404 });
  }

  if (!body.nome?.trim() || !body.numero_maquina?.trim() || !body.tipo) {
    return NextResponse.json(
      { error: "Número, nome e tipo são obrigatórios" },
      { status: 400 }
    );
  }

  const tipo = body.tipo as EquipamentoTipo;

  if (
    (tipo === "cassino" ||
      tipo === "ursinho" ||
      tipo === "bolinha" ||
      tipo === "consignado" ||
      isEquipamentoTipoDiversao(tipo) ||
      tipo === "fura_fura") &&
    !String(body.numero_serie ?? "").trim()
  ) {
    return NextResponse.json(
      { error: "Número de série é obrigatório para o equipamento" },
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

  if (
    (isEquipamentoTipoDiversao(tipo) || tipo === "ursinho" || tipo === "vending_ursinho") &&
    !String(body.entrada_atual ?? "").trim()
  ) {
    return NextResponse.json({ error: "Informe a entrada atual" }, { status: 400 });
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

  const precoJogada = tipo === "bolinha" ? parsePrecoJogada(body.preco_jogada) : null;

  const numeroSerie = String(body.numero_serie ?? "").trim();
  if (numeroSerie) {
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
  }

  const { data, error } = await supabase
    .from("equipamentos")
    .insert({
      empresa_id: profile.empresa_id,
      ponto_id: pontoId,
      nome: body.nome.trim(),
      numero_maquina: body.numero_maquina.trim(),
      numero_serie: numeroSerie || null,
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
      observacao: body.observacao || null,
      status: "ativo",
    })
    .select("*")
    .maybeSingle();

  if (error) {
    const msg = error.message ?? "";
    const needsMigration =
      msg.includes("numero_maquina") ||
      msg.includes("numero_serie") ||
      msg.includes("preco_jogada") ||
      msg.includes("schema cache") ||
      msg.includes("does not exist");

    return NextResponse.json(
      {
        error: needsMigration
          ? "Coluna ausente no banco. Rode supabase/equipamentos-preco-jogada.sql (e/ou numero-serie) no Supabase."
          : msg,
      },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, equipamento: data });
}

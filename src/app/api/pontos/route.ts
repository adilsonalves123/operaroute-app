import { NextResponse } from "next/server";
import { requireAcesso } from "@/lib/equipe/require-acesso";
import { createClient, getEmpresa, getProfile } from "@/lib/supabase/server";
import { canAddPonto, canUseEquipamentoTipo, resolveNichosAtivos } from "@/lib/assinatura";
import type { EquipamentoTipo } from "@/lib/equipamentos";
import { parseLeituraContador, isEquipamentoTipoDiversao } from "@/lib/equipamentos";
import { registrarMovimentoPonto } from "@/lib/pontos-movimentos";

async function resolveEmpresaId(): Promise<string | null> {
  const supabase = await createClient();
  const profile = await getProfile();

  if (profile?.empresa_id) return profile.empresa_id;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: empresa } = await supabase
    .from("empresas")
    .select("id")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!empresa) return null;

  await supabase
    .from("profiles")
    .update({ empresa_id: empresa.id, onboarding_completo: true })
    .eq("user_id", user.id);

  return empresa.id;
}

export async function GET(request: Request) {
  const empresaId = await resolveEmpresaId();

  if (!empresaId) {
    return NextResponse.json({ error: "Empresa não encontrada" }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const excluir = searchParams.get("excluir");

  const supabase = await createClient();
  let query = supabase
    .from("pontos")
    .select("id, nome, cidade, status")
    .eq("empresa_id", empresaId)
    .order("nome");

  if (excluir) {
    query = query.neq("id", excluir);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ pontos: data ?? [] });
}

interface EquipamentoBody {
  nome: string;
  numero_maquina: string;
  numero_serie?: string;
  tipo: EquipamentoTipo;
  numero_entrada?: string;
  numero_saida?: string;
  entrada_atual?: string;
  observacao?: string;
}

export async function POST(request: Request) {
  const auth = await requireAcesso("pontos", "criar");
  if (!auth.ok) return auth.response;

  const empresaId = auth.profile.empresa_id ?? (await resolveEmpresaId());

  if (!empresaId) {
    return NextResponse.json(
      { error: "Finalize a configuração em /configuracao", needs_onboarding: true },
      { status: 404 }
    );
  }

  const supabase = await createClient();
  const body = await request.json();

  if (!body.nome?.trim()) {
    return NextResponse.json({ error: "Nome do ponto é obrigatório" }, { status: 400 });
  }

  const profile = await getProfile();
  const empresa = profile?.empresa_id ? await getEmpresa(profile.empresa_id) : null;

  const { count: pontosAtivos } = await supabase
    .from("pontos")
    .select("*", { count: "exact", head: true })
    .eq("empresa_id", empresaId)
    .eq("status", "ativo");

  if (
    empresa &&
    !canAddPonto(
      pontosAtivos ?? 0,
      empresa.quantidade_pontos,
      empresa.limite_pontos
    )
  ) {
    return NextResponse.json(
      {
        error: `Limite de pontos do seu plano atingido (${empresa.limite_pontos === 9999 ? "ilimitado" : empresa.limite_pontos}). Faça upgrade para continuar.`,
        limite_atingido: true,
        upgrade_url: "/planos",
      },
      { status: 403 }
    );
  }

  const nichosAtivos = resolveNichosAtivos(empresa?.nichos_ativos, empresa?.nicho);
  const equipamentos: EquipamentoBody[] = body.equipamentos ?? [];

  for (const eq of equipamentos) {
    if (!canUseEquipamentoTipo(nichosAtivos, eq.tipo)) {
      return NextResponse.json(
        {
          error: `Nicho não contratado para equipamento "${eq.tipo}". Faça upgrade ou adicione o nicho em /planos.`,
          nicho_bloqueado: true,
          upgrade_url: "/planos",
        },
        { status: 403 }
      );
    }
  }

  const {
    encontrarSerieDuplicadaNoLote,
    encontrarSerieEmUso,
    mensagemSerieJaCadastrada,
  } = await import("@/lib/equipamentos/serie-unica");

  const serieDuplicadaNoLote = encontrarSerieDuplicadaNoLote(
    equipamentos.map((eq) => eq.numero_serie)
  );
  if (serieDuplicadaNoLote) {
    return NextResponse.json(
      {
        error: `Número de série "${serieDuplicadaNoLote}" repetido neste cadastro. Cada máquina precisa de série única.`,
      },
      { status: 400 }
    );
  }

  for (const eq of equipamentos) {
    const serie = eq.numero_serie?.trim();
    if (!serie) continue;
    const serieEmUso = await encontrarSerieEmUso(supabase, empresaId, serie);
    if (serieEmUso) {
      return NextResponse.json(
        { error: mensagemSerieJaCadastrada(serie, serieEmUso) },
        { status: 400 }
      );
    }
  }

  const { data: ponto, error: pontoError } = await supabase
    .from("pontos")
    .insert({
      empresa_id: empresaId,
      nome: body.nome.trim(),
      responsavel: body.responsavel || null,
      whatsapp: body.whatsapp || null,
      cidade: body.cidade || null,
      bairro: body.bairro || null,
      endereco: body.endereco || null,
      latitude: (() => {
        const n = Number(body.latitude);
        return Number.isFinite(n) ? n : null;
      })(),
      longitude: (() => {
        const n = Number(body.longitude);
        return Number.isFinite(n) ? n : null;
      })(),
      status: body.status || "ativo",
      comissao_percentual: parseFloat(body.comissao_percentual) || 0,
      comissao_por_nicho:
        body.comissao_por_nicho && typeof body.comissao_por_nicho === "object"
          ? body.comissao_por_nicho
          : {},
      consignado_modo_comissao:
        body.consignado_modo_comissao === "percentual" ? "percentual" : "tabela",
      observacoes: body.observacoes || null,
    })
    .select("id, nome")
    .maybeSingle();

  if (pontoError || !ponto) {
    const msg = pontoError?.message ?? "Erro ao cadastrar ponto";
    if (/comissao_por_nicho|schema cache/i.test(msg)) {
      return NextResponse.json(
        {
          error:
            "Coluna comissao_por_nicho ausente. Rode supabase/comissao-por-nicho.sql no Supabase SQL Editor.",
        },
        { status: 500 }
      );
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  await registrarMovimentoPonto(supabase, {
    empresa_id: empresaId,
    ponto_id: ponto.id,
    ponto_nome: body.nome.trim(),
    tipo: "entrada",
    motivo: "cadastro",
  });

  let insertedEquipamentos: { id: string; nome: string; numero_maquina: string | null; tipo: string }[] =
    [];

  if (equipamentos.length > 0) {
    const rows = equipamentos.map((eq) => ({
      empresa_id: empresaId,
      ponto_id: ponto.id,
      nome: eq.nome.trim(),
      numero_maquina: eq.numero_maquina?.trim() || null,
      numero_serie:
        (eq.tipo === "cassino" || eq.tipo === "ursinho" || isEquipamentoTipoDiversao(eq.tipo)) &&
        eq.numero_serie?.trim()
          ? eq.numero_serie.trim()
          : null,
      tipo: eq.tipo,
      numero_entrada:
        eq.tipo === "cassino" && eq.numero_entrada
          ? parseLeituraContador(eq.numero_entrada)
          : null,
      numero_saida:
        eq.tipo === "cassino" && eq.numero_saida
          ? parseLeituraContador(eq.numero_saida)
          : null,
      entrada_atual:
        (eq.tipo === "ursinho" || eq.tipo === "vending_ursinho" || isEquipamentoTipoDiversao(eq.tipo)) &&
        eq.entrada_atual
          ? parseLeituraContador(eq.entrada_atual)
          : null,
      observacao: eq.observacao || null,
      status: "ativo",
    }));

    const { data: insertedEquipamentosData, error: eqError } = await supabase
      .from("equipamentos")
      .insert(rows)
      .select("id, nome, numero_maquina, tipo");

    if (eqError) {
      const msg = eqError.message ?? "";
      const needsMigration =
        msg.includes("numero_maquina") ||
        msg.includes("numero_serie") ||
        msg.includes("schema cache") ||
        msg.includes("does not exist");

      return NextResponse.json(
        {
          error: needsMigration
            ? msg.includes("equipamentos")
              ? "Coluna numero_serie não existe. Rode supabase/equipamentos-numero-serie.sql no Supabase."
              : "Tabela equipamentos não existe. Rode supabase/equipamentos.sql."
            : msg,
        },
        { status: 500 }
      );
    }
    insertedEquipamentos = insertedEquipamentosData ?? [];
  }

  const { pushPontoCriado } = await import("@/lib/push/events");
  pushPontoCriado({
    empresaId,
    autorUserId: profile?.user_id ?? auth.profile.user_id,
    autorNome: profile?.nome ?? auth.profile.nome,
    pontoNome: ponto.nome,
    pontoId: ponto.id,
    equipamentos: (insertedEquipamentos ?? []).length,
  });

  const { auditarAcao } = await import("@/lib/auditoria/auditar");
  if (profile) {
    await auditarAcao(supabase, profile, {
      acao: "ponto.criar",
      tabela: "pontos",
      registroId: ponto.id,
      dadosNovos: {
        nome: ponto.nome,
        equipamentos: (insertedEquipamentos ?? []).length,
      },
      severidade: "medium",
      categoria: "ponto",
      modulo: "pontos",
      titulo: `Cadastrou ponto ${ponto.nome}`,
      resumo: `${(insertedEquipamentos ?? []).length} equipamento(s) no cadastro`,
      request,
    });
  }
  return NextResponse.json({
    success: true,
    id: ponto.id,
    equipamentos: insertedEquipamentos ?? [],
  });
}

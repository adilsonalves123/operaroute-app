import { NextResponse } from "next/server";
import { createClient, getEmpresa, getProfile } from "@/lib/supabase/server";
import { canAddPonto, canUseEquipamentoTipo, resolveNichosAtivos } from "@/lib/assinatura";
import type { EquipamentoTipo } from "@/lib/equipamentos";
import { parseLeituraContador } from "@/lib/equipamentos";
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
  tipo: EquipamentoTipo;
  numero_entrada?: string;
  numero_saida?: string;
  entrada_atual?: string;
  observacao?: string;
}

export async function POST(request: Request) {
  const empresaId = await resolveEmpresaId();

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
        error: `Limite de ${empresa.limite_pontos} pontos atingido. Faça upgrade em /planos.`,
        limite_atingido: true,
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
          error: `Nicho não contratado para equipamento "${eq.tipo}". Adicione o nicho em /planos.`,
          nicho_bloqueado: true,
        },
        { status: 403 }
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
      status: body.status || "ativo",
      comissao_percentual: parseFloat(body.comissao_percentual) || 0,
      observacoes: body.observacoes || null,
    })
    .select("id")
    .maybeSingle();

  if (pontoError || !ponto) {
    return NextResponse.json(
      { error: pontoError?.message ?? "Erro ao cadastrar ponto" },
      { status: 500 }
    );
  }

  await registrarMovimentoPonto(supabase, {
    empresa_id: empresaId,
    ponto_id: ponto.id,
    ponto_nome: body.nome.trim(),
    tipo: "entrada",
    motivo: "cadastro",
  });

  if (equipamentos.length > 0) {
    const rows = equipamentos.map((eq) => ({
      empresa_id: empresaId,
      ponto_id: ponto.id,
      nome: eq.nome.trim(),
      numero_maquina: eq.numero_maquina?.trim() || null,
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
        eq.tipo === "vending_ursinho" && eq.entrada_atual
          ? parseLeituraContador(eq.entrada_atual)
          : null,
      observacao: eq.observacao || null,
      status: "ativo",
    }));

    const { error: eqError } = await supabase.from("equipamentos").insert(rows);

    if (eqError) {
      const msg = eqError.message ?? "";
      const needsMigration =
        msg.includes("numero_maquina") ||
        msg.includes("schema cache") ||
        msg.includes("does not exist");

      return NextResponse.json(
        {
          error: needsMigration
            ? msg.includes("equipamentos")
              ? "Coluna numero_maquina não existe no banco. Rode supabase/equipamentos-numero-maquina.sql no Supabase SQL Editor."
              : "Tabela equipamentos não existe. Rode supabase/equipamentos.sql no Supabase."
            : msg,
        },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ success: true, id: ponto.id });
}

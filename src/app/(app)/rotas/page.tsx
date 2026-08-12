import { createClient, getProfile, getEmpresa } from "@/lib/supabase/server";
import { getAcessoUsuario } from "@/lib/equipe/acesso";
import { ModulePage } from "@/components/layout/ModulePage";
import {
  RotaInteligenteClient,
  type PontoRotaEnriquecido,
} from "@/components/rotas/RotaInteligenteClient";
import { agregarPendenciasPorPonto, NICHO_MODULO_FURA_FURA } from "@/lib/nichos/fura-fura";
import { fetchChamadosAbertosResumo } from "@/lib/chamados/fetch-resumo";
import { listarRotasSalvas } from "@/lib/rotas/listar-rotas-salvas";
import type { OperadorRotaOpcao } from "@/lib/rotas/rotas-salvas";

export default async function RotasPage() {
  const [profile, supabase] = await Promise.all([getProfile(), createClient()]);

  if (!profile?.empresa_id) {
    return (
      <ModulePage
        title="Rotas"
        description="Organize o dia de campo e envie para a equipe"
        emptyTitle="Faça login"
        emptyDescription="Entre na conta para montar sua rota do dia."
        actionLabel="Dashboard"
        actionHref="/dashboard"
      />
    );
  }

  const [empresa, pontosResult, equipe] = await Promise.all([
    getEmpresa(profile.empresa_id),
    supabase
      .from("pontos")
      .select(
        "id, empresa_id, nome, responsavel, whatsapp, cidade, bairro, endereco, latitude, longitude, tipo_ponto, status, comissao_percentual, operador_id, observacoes, abater_automatico, foto_url, ultima_coleta, created_at, preco_furo, furos_estoque, furos_minimo, estoque_brindes, kit_ativo_id, kit_instalado_em"
      )
      .eq("empresa_id", profile.empresa_id)
      .eq("status", "ativo")
      .order("nome"),
    supabase
      .from("equipe")
      .select("user_id, nome, role, status, whatsapp")
      .eq("empresa_id", profile.empresa_id)
      .eq("status", "ativo")
      .not("user_id", "is", null),
  ]);

  const acesso = await getAcessoUsuario(supabase, profile, empresa?.owner_id);
  const podeGerenciarRotas = acesso.podeGerenciarRotas;
  const pontos = pontosResult.data ?? [];
  const pontosSemGps = pontos.filter((p) => p.latitude == null || p.longitude == null);
  const limiteGpsColeta = Math.min(Math.max(pontosSemGps.length * 8, 300), 2000);

  const [coletasPendResult, coletasGpsResult, chamadosResumo, rotasSalvas] = await Promise.all([
    supabase
      .from("coletas")
      .select("ponto_id, valor_a_receber, valor_pago_recebido")
      .eq("empresa_id", profile.empresa_id)
      .eq("nicho_modulo", NICHO_MODULO_FURA_FURA)
      .or("valor_a_receber.gt.0,valor_pago_recebido.gt.0"),
    pontosSemGps.length > 0
      ? supabase
          .from("coletas")
          .select("ponto_id, latitude, longitude, created_at")
          .eq("empresa_id", profile.empresa_id)
          .not("latitude", "is", null)
          .not("longitude", "is", null)
          .order("created_at", { ascending: false })
          .limit(limiteGpsColeta)
      : Promise.resolve({ data: [] }),
    fetchChamadosAbertosResumo(profile.empresa_id),
    listarRotasSalvas(supabase, profile.empresa_id, profile.user_id, podeGerenciarRotas),
  ]);

  const gpsPorPonto = new Map<string, { latitude: number; longitude: number }>();
  for (const c of coletasGpsResult.data ?? []) {
    if (
      c.ponto_id &&
      !gpsPorPonto.has(c.ponto_id) &&
      c.latitude != null &&
      c.longitude != null
    ) {
      gpsPorPonto.set(c.ponto_id, {
        latitude: Number(c.latitude),
        longitude: Number(c.longitude),
      });
    }
  }

  const pendencias = agregarPendenciasPorPonto(coletasPendResult.data ?? []);
  const pontosEnriquecidos: PontoRotaEnriquecido[] = (pontos ?? []).map((p) => {
    const gpsFallback = gpsPorPonto.get(p.id);
    return {
      ...p,
      latitude: p.latitude ?? gpsFallback?.latitude ?? null,
      longitude: p.longitude ?? gpsFallback?.longitude ?? null,
      // Só foto cadastrada do ponto/cliente — foto de coleta não substitui
      fotoExibir: p.foto_url ?? null,
      pendente: pendencias.get(p.id)?.totalPendente ?? 0,
      chamadosAbertos: chamadosResumo.porPonto.get(p.id) ?? [],
    };
  });

  const operadores: OperadorRotaOpcao[] = (equipe.data ?? [])
    .filter(
      (m) =>
        m.user_id && (m.role === "operador" || m.role === "gerente" || m.role === "admin")
    )
    .map((m) => ({
      userId: m.user_id!,
      nome: m.nome,
      role: m.role,
      whatsapp: m.whatsapp ?? null,
    }));

  return (
    <div className="mx-auto max-w-5xl">
      <RotaInteligenteClient
        pontos={pontosEnriquecidos}
        rotasSalvas={rotasSalvas}
        operadores={operadores}
        podeGerenciarRotas={podeGerenciarRotas}
        userId={profile.user_id}
        chamadosAbertos={chamadosResumo.total}
      />
    </div>
  );
}

import { createClient, getProfile, getEmpresa } from "@/lib/supabase/server";
import { resolveNichosAtivos, nichosParaPainelPonto } from "@/lib/assinatura";
import { notFound } from "next/navigation";
import { PontoCassinoSettings } from "@/components/pontos/PontoCassinoSettings";
import { PontoUrsoSettings } from "@/components/pontos/PontoUrsoSettings";
import { PontoDadosCard } from "@/components/pontos/PontoDadosCard";
import { PontoNichoPainel } from "@/components/pontos/PontoNichoPainel";
import { PontoHistoricoNicho } from "@/components/pontos/PontoHistoricoNicho";
import { PontoFuraFuraSettings } from "@/components/pontos/PontoFuraFuraSettings";
import { PontoKitInstalar } from "@/components/pontos/PontoKitInstalar";
import { PontoExcluirButton } from "@/components/pontos/PontoExcluirButton";
import { PontoHero } from "@/components/pontos/PontoHero";
import { PontoFuraAlertas } from "@/components/coletas/fura-fura/PontoFuraAlertas";
import { formatCurrency } from "@/lib/utils";
import { saldoPendenciaReais } from "@/lib/nichos/cassino/pendencias";
import { visitaPontoDisponivel } from "@/lib/visitas-ponto";
import { LinkColetaPonto } from "@/components/visitas-ponto/LinkColetaPonto";
import { PontoHistoricoVisitas } from "@/components/pontos/PontoHistoricoVisitas";
import { PontoComissaoPeriodo } from "@/components/pontos/PontoComissaoPeriodo";
import { resolverPeriodoAnalise } from "@/lib/analise/periodo-analise";
import { fetchComissaoPontoPeriodo } from "@/lib/pontos/comissao-periodo";

const ACAO_COLETA =
  "inline-flex w-full items-center justify-center rounded-full border border-white/15 bg-white/[0.04] px-4 py-3 text-[13px] font-medium text-white transition hover:border-white/25 hover:bg-white/[0.08]";

export default async function PontoDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ periodo?: string; de?: string; ate?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const periodoComissao = resolverPeriodoAnalise({
    periodo: sp.periodo ?? "semana",
    de: sp.de,
    ate: sp.ate,
  });
  const [profile, supabase] = await Promise.all([getProfile(), createClient()]);
  const empresa = profile?.empresa_id ? await getEmpresa(profile.empresa_id) : null;
  const nichosAtivos = resolveNichosAtivos(empresa?.nichos_ativos, empresa?.nicho);
  const nichosPainel = nichosParaPainelPonto(nichosAtivos);
  const isCassino = nichosPainel.includes("maquinas_cassino");
  const isUrsinho = nichosPainel.includes("ursinho");
  const isVending = nichosPainel.includes("vending_ursinho");
  const isFuraFura = nichosPainel.includes("fura_fura");
  const isDiversao = nichosPainel.includes("diversao");
  const isBolinha = nichosPainel.includes("bolinha");
  const isConsignado = nichosPainel.includes("consignado");
  const isOutros = nichosPainel.includes("outros");
  const mostraVisitaUnificada = visitaPontoDisponivel(nichosAtivos);
  // Estoque central só entra em nichos que alocam itens — evita query pesada no cassino puro
  const precisaEstoqueCentral =
    isUrsinho || isVending || isFuraFura || isBolinha || isConsignado;

  const { data: ponto } = await supabase
    .from("pontos")
    .select(
      "id, nome, responsavel, whatsapp, endereco, bairro, cidade, status, observacoes, ultima_coleta, created_at, comissao_percentual, comissao_por_nicho, foto_url, abater_automatico, kit_ativo_id, kit_instalado_em, preco_furo, furos_estoque, furos_minimo, estoque_brindes"
    )
    .eq("id", id)
    .eq("empresa_id", profile?.empresa_id ?? "")
    .single();

  if (!ponto) notFound();

  const [
    kitAtivoResult,
    estoqueCentralResult,
    equipamentosResult,
    estoqueEquipamentosResult,
    todosPontosResult,
    visitasResult,
    visitasCountResult,
    coletasFuraResult,
    coletasFuraCountResult,
    coletasUrsinhoResult,
    coletasUrsinhoCountResult,
    coletasDiversaoResult,
    coletasDiversaoCountResult,
    coletasBolinhaResult,
    coletasBolinhaCountResult,
    coletasConsignadoResult,
    coletasConsignadoCountResult,
    coletasOutrosResult,
    coletasOutrosCountResult,
    pendenciasAbertasResult,
    chamadosAbertosResult,
    visitaRascunhoResult,
    visitasPontoHistoricoResult,
    comissaoPeriodoResult,
  ] = await Promise.all([
    isFuraFura && ponto.kit_ativo_id && profile?.empresa_id
      ? supabase
          .from("fura_kits")
          .select("nome")
          .eq("id", ponto.kit_ativo_id)
          .eq("empresa_id", profile.empresa_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    precisaEstoqueCentral && profile?.empresa_id
      ? supabase
          .from("estoque")
          .select("id, nome_item, custo_unitario, quantidade, foto_url")
          .eq("empresa_id", profile.empresa_id)
          .order("nome_item")
      : Promise.resolve({ data: [] }),
    supabase
      .from("equipamentos")
      .select(
        "id, empresa_id, ponto_id, nome, tipo, status, numero_maquina, numero_serie, numero_entrada, numero_saida, entrada_atual, preco_jogada, observacao, foto_url, estoque_brindes, created_at"
      )
      .eq("ponto_id", id)
      .order("created_at"),
    profile?.empresa_id
      ? supabase
          .from("equipamentos")
          .select(
            "id, empresa_id, ponto_id, nome, tipo, status, numero_maquina, numero_serie, numero_entrada, numero_saida, entrada_atual, preco_jogada, observacao, foto_url, estoque_brindes, created_at"
          )
          .eq("empresa_id", profile.empresa_id)
          .is("ponto_id", null)
          .eq("status", "ativo")
          .order("nome")
      : Promise.resolve({ data: [] }),
    profile?.empresa_id
      ? supabase
          .from("pontos")
          .select("id, nome")
          .eq("empresa_id", profile.empresa_id)
          .neq("id", id)
          .order("nome")
      : Promise.resolve({ data: [] }),
    isCassino
      ? supabase
          .from("visitas")
          .select("id, created_at, total_lucro_centavos, valor_operacao, saldo_negativo")
          .eq("ponto_id", id)
          .order("created_at", { ascending: false })
          .limit(10)
      : Promise.resolve({ data: null }),
    isCassino
      ? supabase.from("visitas").select("id", { count: "exact", head: true }).eq("ponto_id", id)
      : Promise.resolve({ count: 0 }),
    isFuraFura
      ? supabase
          .from("coletas")
          .select("id, created_at, valor_liquido, lucro_real, quantidade_furos, nicho_modulo")
          .eq("ponto_id", id)
          .eq("nicho_modulo", "fura_fura")
          .order("created_at", { ascending: false })
          .limit(10)
      : Promise.resolve({ data: null }),
    isFuraFura
      ? supabase
          .from("coletas")
          .select("id", { count: "exact", head: true })
          .eq("ponto_id", id)
          .eq("nicho_modulo", "fura_fura")
      : Promise.resolve({ count: 0 }),
    isUrsinho
      ? supabase
          .from("coletas")
          .select("id, created_at, valor_liquido, lucro_real, nicho_modulo")
          .eq("ponto_id", id)
          .eq("nicho_modulo", "ursinho")
          .order("created_at", { ascending: false })
          .limit(10)
      : Promise.resolve({ data: null }),
    isUrsinho
      ? supabase
          .from("coletas")
          .select("id", { count: "exact", head: true })
          .eq("ponto_id", id)
          .eq("nicho_modulo", "ursinho")
      : Promise.resolve({ count: 0 }),
    isDiversao
      ? supabase
          .from("coletas")
          .select("id, created_at, valor_liquido, lucro_real, nicho_modulo")
          .eq("ponto_id", id)
          .eq("nicho_modulo", "diversao")
          .order("created_at", { ascending: false })
          .limit(10)
      : Promise.resolve({ data: null }),
    isDiversao
      ? supabase
          .from("coletas")
          .select("id", { count: "exact", head: true })
          .eq("ponto_id", id)
          .eq("nicho_modulo", "diversao")
      : Promise.resolve({ count: 0 }),
    isBolinha
      ? supabase
          .from("coletas")
          .select("id, created_at, valor_liquido, lucro_real, nicho_modulo")
          .eq("ponto_id", id)
          .eq("nicho_modulo", "bolinha")
          .order("created_at", { ascending: false })
          .limit(10)
      : Promise.resolve({ data: null }),
    isBolinha
      ? supabase
          .from("coletas")
          .select("id", { count: "exact", head: true })
          .eq("ponto_id", id)
          .eq("nicho_modulo", "bolinha")
      : Promise.resolve({ count: 0 }),
    isConsignado
      ? supabase
          .from("coletas")
          .select("id, created_at, valor_liquido, lucro_real, nicho_modulo")
          .eq("ponto_id", id)
          .eq("nicho_modulo", "consignado")
          .order("created_at", { ascending: false })
          .limit(10)
      : Promise.resolve({ data: null }),
    isConsignado
      ? supabase
          .from("coletas")
          .select("id", { count: "exact", head: true })
          .eq("ponto_id", id)
          .eq("nicho_modulo", "consignado")
      : Promise.resolve({ count: 0 }),
    isOutros
      ? supabase
          .from("coletas")
          .select(
            "id, created_at, valor_bruto, valor_liquido, entrada, saida, ponto_id, forma_pagamento, observacao, nicho_modulo"
          )
          .eq("ponto_id", id)
          .order("created_at", { ascending: false })
          .limit(10)
      : Promise.resolve({ data: null }),
    isOutros
      ? supabase.from("coletas").select("id", { count: "exact", head: true }).eq("ponto_id", id)
      : Promise.resolve({ count: 0 }),
    supabase
      .from("pendencias")
      .select("id, tipo, valor, titulo, descricao")
      .eq("ponto_id", id)
      .eq("status", "aberta"),
    profile?.empresa_id
      ? supabase
          .from("chamados")
          .select("id, equipamento_id, status, titulo")
          .eq("empresa_id", profile.empresa_id)
          .eq("ponto_id", id)
          .in("status", ["aberta", "em_andamento"])
      : Promise.resolve({ data: [] }),
    mostraVisitaUnificada && profile?.empresa_id
      ? supabase
          .from("visitas_ponto")
          .select("id")
          .eq("empresa_id", profile.empresa_id)
          .eq("ponto_id", id)
          .eq("status", "rascunho")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    mostraVisitaUnificada && profile?.empresa_id
      ? supabase
          .from("visitas_ponto")
          .select(
            "id, created_at, finalizada_em, status, subtotal_cobravel, total_cobrado, valor_pago, restante"
          )
          .eq("empresa_id", profile.empresa_id)
          .eq("ponto_id", id)
          .eq("status", "finalizada")
          .order("finalizada_em", { ascending: false })
          .limit(10)
      : Promise.resolve({ data: [] }),
    profile?.empresa_id
      ? fetchComissaoPontoPeriodo(
          supabase,
          profile.empresa_id,
          id,
          periodoComissao.inicioISO,
          periodoComissao.fimISO
        )
      : Promise.resolve({ total: 0, porNicho: [] }),
  ]);

  const kitAtivoNome = kitAtivoResult.data?.nome ?? null;
  const estoqueCentral = estoqueCentralResult.data ?? [];
  const equipamentos = equipamentosResult.data ?? [];
  const estoqueEquipamentos = estoqueEquipamentosResult.data ?? [];
  const todosPontos = todosPontosResult.data ?? [];
  const visitas = visitasResult.data ?? null;
  const visitasCount = visitasCountResult.count ?? 0;
  const coletasFura = coletasFuraResult.data ?? null;
  const coletasFuraCount = coletasFuraCountResult.count ?? 0;
  const coletasUrsinho = coletasUrsinhoResult.data ?? null;
  const coletasUrsinhoCount = coletasUrsinhoCountResult.count ?? 0;
  const coletasDiversao = coletasDiversaoResult.data ?? null;
  const coletasDiversaoCount = coletasDiversaoCountResult.count ?? 0;
  const coletasBolinha = coletasBolinhaResult.data ?? null;
  const coletasBolinhaCount = coletasBolinhaCountResult.count ?? 0;
  const coletasConsignado = coletasConsignadoResult.data ?? null;
  const coletasConsignadoCount = coletasConsignadoCountResult.count ?? 0;
  const coletas = coletasOutrosResult.data ?? null;
  const coletasCount = coletasOutrosCountResult.count ?? 0;
  const pendenciasAbertas = pendenciasAbertasResult.data ?? [];
  const chamadosAbertos = chamadosAbertosResult.data ?? [];
  const visitaRascunhoId = visitaRascunhoResult.data?.id ?? null;
  const visitasPontoHistorico = visitasPontoHistoricoResult.data ?? [];
  const comissaoPeriodo = comissaoPeriodoResult;

  const chamadosResumo = chamadosAbertos ?? [];

  const temMaquinaUrso = (equipamentos ?? []).some(
    (e) => e.tipo === "ursinho" || e.tipo === "vending_ursinho"
  );
  const nichoInicialPonto: "ursinho" | "vending_ursinho" | undefined =
    temMaquinaUrso && isUrsinho
      ? "ursinho"
      : temMaquinaUrso && isVending
        ? "vending_ursinho"
        : isUrsinho
          ? "ursinho"
          : isVending
            ? "vending_ursinho"
            : undefined;

  const pendenciasCobraveis = (pendenciasAbertas ?? []).filter((p) => p.tipo !== "haver");
  const totalCobravel = pendenciasCobraveis.reduce((total, p) => {
    const valor =
      p.tipo === "negativo"
        ? saldoPendenciaReais({
            id: p.id,
            valor: Number(p.valor ?? 0),
            observacao: p.descricao,
          })
        : Number(p.valor ?? 0);
    return total + valor;
  }, 0);

  const cobrarUrl =
    ponto.whatsapp && totalCobravel > 0.009
      ? `https://wa.me/55${ponto.whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(
          [
            `Olá, ${ponto.nome}.`,
            "",
            `Constam pendências abertas no valor de ${formatCurrency(totalCobravel)}.`,
            "",
            ...pendenciasCobraveis.map((p) => {
              const valor =
                p.tipo === "negativo"
                  ? saldoPendenciaReais({
                      id: p.id,
                      valor: Number(p.valor ?? 0),
                      observacao: p.descricao,
                    })
                  : Number(p.valor ?? 0);
              return `• ${p.titulo}: ${formatCurrency(valor)}`;
            }),
            "",
            "Pode verificar o pagamento, por favor?",
          ].join("\n")
        )}`
      : null;

  return (
    <div className="mx-auto max-w-3xl space-y-10 pb-10">
      <PontoHero
        pontoId={id}
        nome={ponto.nome}
        status={ponto.status}
        endereco={ponto.endereco}
        bairro={ponto.bairro}
        cidade={ponto.cidade}
        fotoUrl={ponto.foto_url}
        whatsapp={ponto.whatsapp}
        totalCobravel={totalCobravel}
        cobrarUrl={cobrarUrl}
        pendenciasCount={pendenciasAbertas?.length ?? 0}
        chamadosCount={chamadosResumo.length}
        mostraVisita={mostraVisitaUnificada}
        visitaRascunhoId={visitaRascunhoId}
        alertaFura={
          isFuraFura && nichosPainel.length === 1 ? (
            <PontoFuraAlertas ponto={ponto} />
          ) : undefined
        }
      />

      {mostraVisitaUnificada && (
        <PontoHistoricoVisitas visitas={visitasPontoHistorico} />
      )}

      <PontoComissaoPeriodo
        pontoId={id}
        periodo={periodoComissao}
        comissao={comissaoPeriodo}
      />

      <PontoNichoPainel
        nichosContratados={nichosAtivos}
        faixaPontos={empresa?.quantidade_pontos}
        nichoInicial={nichoInicialPonto}
        acoes={{
          maquinas_cassino: isCassino ? (
            <LinkColetaPonto
              pontoId={id}
              nicho="cassino"
              viaVisita={mostraVisitaUnificada}
              rascunhoId={visitaRascunhoId}
              className={ACAO_COLETA}
            >
              Nova leitura
            </LinkColetaPonto>
          ) : undefined,
          ursinho: isUrsinho ? (
            <LinkColetaPonto
              pontoId={id}
              nicho="ursinho"
              viaVisita={mostraVisitaUnificada}
              rascunhoId={visitaRascunhoId}
              className={ACAO_COLETA}
            >
              Coleta ursinho
            </LinkColetaPonto>
          ) : undefined,
          fura_fura: isFuraFura ? (
            <LinkColetaPonto
              pontoId={id}
              nicho="fura_fura"
              viaVisita={mostraVisitaUnificada}
              rascunhoId={visitaRascunhoId}
              className={ACAO_COLETA}
            >
              Coleta fura-fura
            </LinkColetaPonto>
          ) : undefined,
          diversao: isDiversao ? (
            <LinkColetaPonto
              pontoId={id}
              nicho="diversao"
              viaVisita={mostraVisitaUnificada}
              rascunhoId={visitaRascunhoId}
              className={ACAO_COLETA}
            >
              Coleta diversão
            </LinkColetaPonto>
          ) : undefined,
          bolinha: isBolinha ? (
            <LinkColetaPonto
              pontoId={id}
              nicho="bolinha"
              viaVisita={mostraVisitaUnificada}
              rascunhoId={visitaRascunhoId}
              className={ACAO_COLETA}
            >
              Coleta bolinha
            </LinkColetaPonto>
          ) : undefined,
          consignado: isConsignado ? (
            <LinkColetaPonto
              pontoId={id}
              nicho="consignado"
              viaVisita={mostraVisitaUnificada}
              rascunhoId={visitaRascunhoId}
              className={ACAO_COLETA}
            >
              Recolhe consignado
            </LinkColetaPonto>
          ) : undefined,
        }}
        equipamentosCtx={{
          pontoId: id,
          equipamentos: equipamentos ?? [],
          estoqueDisponivel: estoqueEquipamentos ?? [],
          outrosPontos: todosPontos ?? [],
          nichosAtivos,
          chamadosAbertos: chamadosResumo,
          estoqueBrindesPonto: Array.isArray(ponto.estoque_brindes)
            ? ponto.estoque_brindes
            : [],
          estoqueCentral: estoqueCentral ?? [],
        }}
        settings={{
          maquinas_cassino: isCassino ? (
            <PontoCassinoSettings
              pontoId={id}
              abaterAutomatico={ponto.abater_automatico !== false}
            />
          ) : undefined,
          ursinho:
            isUrsinho || isVending ? (
              <PontoUrsoSettings
                pontoId={id}
                estoqueBrindes={
                  Array.isArray(ponto.estoque_brindes) ? ponto.estoque_brindes : []
                }
                estoqueCentral={estoqueCentral ?? []}
              />
            ) : undefined,
          vending_ursinho:
            isUrsinho || isVending ? (
              <PontoUrsoSettings
                pontoId={id}
                estoqueBrindes={
                  Array.isArray(ponto.estoque_brindes) ? ponto.estoque_brindes : []
                }
                estoqueCentral={estoqueCentral ?? []}
              />
            ) : undefined,
          fura_fura: isFuraFura ? (
            <>
              <PontoFuraAlertas ponto={ponto} />
              <PontoKitInstalar
                pontoId={id}
                kitAtivoId={ponto.kit_ativo_id ?? null}
                kitInstaladoEm={ponto.kit_instalado_em ?? null}
                kitAtivoNome={kitAtivoNome}
              />
              <PontoFuraFuraSettings
                pontoId={id}
                precoFuro={Number(ponto.preco_furo ?? 1)}
                furosEstoque={ponto.furos_estoque ?? null}
                furosMinimo={Number(ponto.furos_minimo ?? 0)}
                estoqueBrindes={
                  Array.isArray(ponto.estoque_brindes) ? ponto.estoque_brindes : []
                }
                estoqueCentral={estoqueCentral ?? []}
              />
            </>
          ) : undefined,
          bolinha: (
            <div className="space-y-2 border-t border-white/[0.06] pt-4">
              <h2 className="text-[15px] text-white">Estoque por máquina</h2>
              <p className="text-[13px] leading-relaxed text-slate-500">
                Diferente do fura-fura, bolinha e cápsula guardam o estoque em cada
                máquina. No cadastro ou em Equipamentos → detalhes → Brindes, escolha o
                que vai em cada uma.
              </p>
            </div>
          ),
          consignado: isConsignado ? (
            <div className="space-y-2 border-t border-white/[0.06] pt-4">
              <h2 className="text-[15px] text-white">Consignado por expositor</h2>
              <p className="text-[13px] leading-relaxed text-slate-500">
                Cadastre os produtos em Produtos consignados. Cada expositor guarda o
                estoque na máquina — no recolhe o sistema calcula o vendido e a comissão.
              </p>
            </div>
          ) : undefined,
        }}
        historicos={{
          maquinas_cassino: isCassino ? (
            <PontoHistoricoNicho nicho="maquinas_cassino" visitas={visitas} />
          ) : undefined,
          ursinho: isUrsinho ? (
            <PontoHistoricoNicho nicho="ursinho" coletas={coletasUrsinho} />
          ) : undefined,
          vending_ursinho: isVending && !isUrsinho ? (
            <PontoHistoricoNicho nicho="vending_ursinho" />
          ) : undefined,
          fura_fura: isFuraFura ? (
            <PontoHistoricoNicho nicho="fura_fura" coletas={coletasFura} />
          ) : undefined,
          diversao: (
            <PontoHistoricoNicho nicho="diversao" coletas={coletasDiversao} />
          ),
          bolinha: (
            <PontoHistoricoNicho nicho="bolinha" coletas={coletasBolinha} />
          ),
          consignado: isConsignado ? (
            <PontoHistoricoNicho nicho="consignado" coletas={coletasConsignado} />
          ) : undefined,
          outros: isOutros ? (
            <PontoHistoricoNicho nicho="outros" coletas={coletas} />
          ) : undefined,
        }}
      />

      <section className="space-y-3 border-t border-white/[0.06] pt-8">
        <h2 className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500">
          Ficha
        </h2>
        <PontoDadosCard
          pontoId={id}
          nome={ponto.nome}
          responsavel={ponto.responsavel}
          whatsapp={ponto.whatsapp}
          endereco={ponto.endereco}
          bairro={ponto.bairro}
          cidade={ponto.cidade}
          status={ponto.status}
          observacoes={ponto.observacoes}
          ultimaColeta={ponto.ultima_coleta}
          createdAt={ponto.created_at}
          comissaoPercentual={Number(ponto.comissao_percentual) || 0}
          comissaoPorNicho={ponto.comissao_por_nicho}
          nichosAtivos={nichosAtivos}
        />
      </section>

      <section className="space-y-3 border-t border-white/[0.06] pt-8">
        <h2 className="text-[11px] font-medium uppercase tracking-[0.18em] text-rose-400/80">
          Zona de perigo
        </h2>
        <p className="text-[13px] leading-relaxed text-slate-500">
          Excluir remove o ponto, equipamentos e histórico vinculados. Pendências em
          aberto impedem a exclusão.
        </p>
        <PontoExcluirButton
          pontoId={id}
          pontoNome={ponto.nome}
          equipamentosCount={equipamentos?.length ?? 0}
          visitasCount={visitasCount ?? 0}
          coletasCount={
            (coletasUrsinhoCount ?? 0) +
            (coletasFuraCount ?? 0) +
            (coletasDiversaoCount ?? 0) +
            (coletasBolinhaCount ?? 0) +
            (coletasConsignadoCount ?? 0) +
            (coletasCount ?? 0)
          }
          pendenciasCobraveisCount={pendenciasCobraveis.length}
        />
      </section>
    </div>
  );
}

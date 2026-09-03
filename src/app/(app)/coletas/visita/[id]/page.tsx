import { createClient, getProfile } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Download, MapPin } from "lucide-react";
import { AlertBadge } from "@/components/ui/AlertBadge";
import { formatContador, centesimosToReais } from "@/lib/nichos/cassino";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { getEquipamentoTipoLabel } from "@/lib/equipamentos";
import { saldoPendenciaReais } from "@/lib/nichos/cassino/pendencias";
import { ExcluirVisitaButton } from "@/components/coletas/cassino/ExcluirVisitaButton";
import { ImprimirColetaCassinoButton } from "@/components/coletas/cassino/ImprimirColetaCassinoButton";
import { CompartilharColetaHistoricoActions } from "@/components/coletas/CompartilharColetaHistoricoActions";
import { CorrigirPagamentoButton } from "@/components/coletas/CorrigirPagamentoButton";
import { VisitaNegativaResumo } from "@/components/coletas/cassino/VisitaNegativaResumo";
import { VisitaPositivaResumo } from "@/components/coletas/cassino/VisitaPositivaResumo";
import { ExpandableImage } from "@/components/ui/ExpandableImage";
import {
  reconstructCalculoNegativoFromVisita,
  reconstructCalculoPositivoFromVisita,
} from "@/lib/nichos/cassino/reconstruct-visita";
import { snapshotFromRelatorioCassino } from "@/lib/comprovantes/types";
import type { RelatorioColetaData } from "@/lib/nichos/cassino/relatorio";

export default async function VisitaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = await getProfile();
  if (!profile?.empresa_id) notFound();

  const supabase = await createClient();

  const { data: visita } = await supabase
    .from("visitas")
    .select("*, pontos(nome, whatsapp, comissao_percentual, cidade)")
    .eq("id", id)
    .eq("empresa_id", profile.empresa_id)
    .maybeSingle();

  if (!visita) notFound();

  const [{ data: coletas }, { data: empresa }, { data: pendenciasNegativas }, { data: pendenciasVisita }, { data: pendenciasHaverPonto }] =
    await Promise.all([
      supabase
        .from("coletas")
        .select("*, equipamentos(nome, tipo)")
        .eq("visita_id", id)
        .order("created_at"),
      supabase.from("empresas").select("nome_operacao, chave_pix").eq("id", profile.empresa_id).maybeSingle(),
      supabase
        .from("pendencias")
        .select("id, valor, descricao")
        .eq("ponto_id", visita.ponto_id)
        .eq("empresa_id", profile.empresa_id)
        .eq("status", "aberta")
        .ilike("tipo", "negativo"),
      supabase
        .from("pendencias")
        .select("id, tipo, valor, descricao, visita_id")
        .eq("ponto_id", visita.ponto_id)
        .eq("empresa_id", profile.empresa_id)
        .or(`visita_id.eq.${id},descricao.ilike.%[visita:${id}]%`),
      // Haver do ponto (aberto + resolvido nesta visita) — para mostrar "tinha antes"
      supabase
        .from("pendencias")
        .select("id, tipo, valor, descricao, visita_id, status")
        .eq("ponto_id", visita.ponto_id)
        .eq("empresa_id", profile.empresa_id)
        .ilike("tipo", "haver"),
    ]);

  const pendenciasParaHistorico = (() => {
    const byId = new Map<string, { id: string; tipo: string; valor: number | null; descricao: string | null; visita_id?: string | null }>();
    for (const p of pendenciasVisita ?? []) byId.set(p.id, p);
    for (const p of pendenciasHaverPonto ?? []) {
      const tagged =
        p.visita_id === id ||
        (typeof p.descricao === "string" && p.descricao.includes(`[visita:${id}]`));
      if (tagged) byId.set(p.id, p);
    }
    return Array.from(byId.values());
  })();

  const ponto = visita.pontos as {
    nome: string;
    whatsapp: string | null;
    comissao_percentual: number;
    cidade: string | null;
  } | null;

  const valorCliente = Number(visita.valor_cliente);
  const valorOperacao = Number(visita.valor_operacao);
  const descontoManual = Number(visita.desconto);
  const descontoRecebimento = Number(visita.desconto_recebimento);
  const valorPago = Number(visita.valor_pago);
  const valorACobrar = Number(visita.valor_operacao_efetivo);
  const lucroReais = centesimosToReais(Number(visita.total_lucro_centavos));
  const saldoAposDesconto = lucroReais - descontoManual;
  const saldoAposDebito = valorCliente + valorOperacao;
  const recuperacaoNegativo = Math.max(0, saldoAposDesconto - saldoAposDebito);
  const debitoAbatido = Number(visita.debito_abatido);
  const debitoAtual = (pendenciasNegativas ?? []).reduce(
    (total, p) =>
      total +
      saldoPendenciaReais({
        id: p.id,
        valor: Number(p.valor ?? 0),
        observacao: p.descricao,
      }),
    0
  );
  const debitoAnterior = debitoAtual > 0.009 || debitoAbatido > 0.009
    ? debitoAtual + debitoAbatido
    : 0;
  const totalACobrar = debitoAnterior + valorACobrar;
  const restanteTotal = Math.max(0, totalACobrar - valorPago);
  const restanteOperacao = Math.max(0, valorACobrar - Math.max(0, valorPago - debitoAbatido));
  const haverGerado = Math.max(0, valorPago - totalACobrar);

  const adiantamentoPix = Number(visita.adiantamento_pix ?? 0);
  const adiantamentoDinheiro = Number(visita.adiantamento_dinheiro ?? 0);
  const adiantamentoDetalhe =
    visita.saldo_negativo && (adiantamentoPix > 0.009 || adiantamentoDinheiro > 0.009)
      ? {
          pixReais: adiantamentoPix,
          dinheiroReais: adiantamentoDinheiro,
          pixDoCaixa: Boolean(visita.adiantamento_pix_do_caixa),
          dinheiroDoCaixa: Boolean(
            visita.adiantamento_dinheiro_do_caixa ?? visita.adiantamento_do_caixa
          ),
        }
      : undefined;

  const calculoNegativo = visita.saldo_negativo
    ? reconstructCalculoNegativoFromVisita(visita, pendenciasParaHistorico)
    : null;

  const calculoPositivo = !visita.saldo_negativo
    ? reconstructCalculoPositivoFromVisita(visita, pendenciasParaHistorico)
    : null;

  const calculoBase = calculoNegativo ?? calculoPositivo;
  const calculo = {
    totalLucroCentavos: Number(visita.total_lucro_centavos),
    saldoNegativo: visita.saldo_negativo === true,
    debitoTotalReais: debitoAnterior,
    recuperacaoNegativoReais: recuperacaoNegativo,
    debitoAbatidoReais: debitoAbatido,
    debitoRestanteReais: debitoAtual,
    descontoManualReais: descontoManual,
    valorClienteReais: valorCliente,
    valorOperacaoReais: valorOperacao,
    descontoRecebimentoReais: descontoRecebimento,
    valorOperacaoEfetivoReais: valorACobrar,
    totalACobrarReais: totalACobrar,
    valorDeixadoOperadorReais: descontoManual,
    valorPagoReais: valorPago,
    restanteReais: restanteTotal,
    haverTotalReais: Number(calculoBase?.haverTotalReais ?? 0),
    haverCompensadoReais: Number(calculoBase?.haverCompensadoReais ?? 0),
    haverGeradoReais: Number(
      calculoBase?.haverGeradoReais ?? haverGerado
    ),
    ...(calculoBase ?? {}),
  };

  const calculoRelatorio = calculoNegativo ?? calculoPositivo;

  const historicoPayload = calculoRelatorio
    ? {
        pontoNome: ponto?.nome ?? "Ponto",
        empresaNome: empresa?.nome_operacao ?? "Operação",
        dataIso: visita.created_at,
        gpsRegistrado: Boolean(visita.latitude && visita.longitude),
        comissaoPercentual: Number(ponto?.comissao_percentual) || 0,
        saldoNegativo: visita.saldo_negativo === true,
        totalLucroCentavos: Number(visita.total_lucro_centavos),
        calculo: calculoRelatorio,
        adiantamento: adiantamentoDetalhe,
        maquinas: (coletas ?? []).map((c) => ({
          nome: (c.equipamentos as { nome: string; tipo?: string } | null)?.nome ?? "Máquina",
          tipo: (c.equipamentos as { tipo?: string } | null)?.tipo ?? null,
          entradaAnterior: Number(c.entrada_anterior ?? 0),
          saidaAnterior: Number(c.saida_anterior ?? 0),
          entradaAtual: Number(c.entrada_atual ?? 0),
          saidaAtual: Number(c.saida_atual ?? 0),
          entradaPeriodo: Number(c.entrada_periodo ?? 0),
          saidaPeriodo: Number(c.saida_periodo ?? 0),
          lucroCentavos: Number(c.lucro_centavos ?? 0),
          fotoUrl: c.foto_url ?? null,
        })),
        observacao: visita.observacao ?? null,
      }
    : null;

  const snapshotBase = snapshotFromRelatorioCassino({
    empresaNome: empresa?.nome_operacao ?? "Operação",
    pontoNome: ponto?.nome ?? "Ponto",
    chavePix: (empresa as { chave_pix?: string | null } | null)?.chave_pix ?? null,
    data: visita.created_at,
    previa: false,
    maquinas: (coletas ?? []).map((c) => ({
      nome: (c.equipamentos as { nome: string } | null)?.nome ?? "Máquina",
      lucroCentavos: Number(c.lucro_centavos ?? 0),
      entradaAtual: Number(c.entrada_atual ?? 0),
      saidaAtual: Number(c.saida_atual ?? 0),
    })),
    valorOperacional: Number(calculo.valorOperacaoReais ?? valorOperacao),
    comissao: Number(calculo.valorClienteReais ?? valorCliente),
    comissaoPercentual: Number(ponto?.comissao_percentual) || 0,
    subtotal: Number(calculo.valorOperacaoEfetivoReais ?? valorACobrar),
    desconto: visita.saldo_negativo
      ? Number(calculo.descontoRecebimentoReais ?? descontoRecebimento)
      : Number(calculo.descontoRecebimentoReais ?? descontoRecebimento) +
        Number(calculo.descontoManualReais ?? descontoManual),
    totalACobrar: Number(calculo.totalACobrarReais ?? totalACobrar),
    valorPago: Number(calculo.valorPagoReais ?? valorPago),
    restante: Number(calculo.restanteReais ?? restanteTotal),
    saldoNegativo: visita.saldo_negativo === true,
    prejuizo: Math.abs(centesimosToReais(Number(visita.total_lucro_centavos))),
    valorDeixado: Number(calculo.valorDeixadoOperadorReais ?? descontoManual),
    haverGerado: Number(calculo.haverGeradoReais ?? haverGerado),
    haverAbatido: Number(calculo.haverCompensadoReais ?? 0),
    haverRestante: Math.max(
      0,
      Number(calculo.haverTotalReais ?? 0) - Number(calculo.haverCompensadoReais ?? 0)
    ),
    haverAnterior: Number(calculo.haverTotalReais ?? 0),
    totalBruto:
      Number(calculo.totalACobrarReais ?? totalACobrar) +
      Number(calculo.haverCompensadoReais ?? 0),
    negativoAnterior: Number(calculo.debitoTotalReais ?? debitoAnterior),
    negativoRecuperado:
      Number(calculo.recuperacaoNegativoReais ?? 0) > 0.009
        ? Number(calculo.recuperacaoNegativoReais)
        : Number(calculo.debitoAbatidoReais ?? debitoAbatido),
    negativoRestante: Number(calculo.debitoRestanteReais ?? debitoAtual),
  });

  const snapshot = {
    ...snapshotBase,
    layout: "historico" as const,
    nichoModulo: "cassino" as const,
    ...(historicoPayload ? { relatorio: historicoPayload } : {}),
  };

  const dadosImpressao: RelatorioColetaData | null = calculoRelatorio
    ? {
        empresaNome: empresa?.nome_operacao ?? "Operação",
        pontoNome: ponto?.nome ?? "Ponto",
        pontoWhatsapp: ponto?.whatsapp ?? null,
        comissaoPercentual: Number(ponto?.comissao_percentual) || 0,
        data: new Date(visita.created_at),
        previa: false,
        maquinas: (coletas ?? []).map((c) => ({
          nome: (c.equipamentos as { nome: string } | null)?.nome ?? "Máquina",
          entradaAnterior: Number(c.entrada_anterior ?? 0),
          saidaAnterior: Number(c.saida_anterior ?? 0),
          entradaAtual: Number(c.entrada_atual ?? 0),
          saidaAtual: Number(c.saida_atual ?? 0),
          lucroCentavos: Number(c.lucro_centavos ?? 0),
        })),
        calculo: calculoRelatorio,
        adiantamento: adiantamentoDetalhe,
      }
    : null;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <Link
            href="/coletas"
            className="mt-0.5 rounded-xl border border-slate-800 bg-slate-900/60 p-2.5 text-at-muted transition hover:border-slate-600 hover:bg-slate-800 hover:text-white"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-white">
                {ponto?.nome ?? "Visita"}
              </h1>
              {visita.saldo_negativo && <AlertBadge variant="danger">Saldo negativo</AlertBadge>}
              {Number(visita.restante) > 0.009 && !visita.saldo_negativo && (
                <AlertBadge variant="warning">Pagamento pendente</AlertBadge>
              )}
              {!visita.saldo_negativo &&
                Number(visita.restante) <= 0.009 &&
                Number(visita.valor_pago) > 0.009 && (
                  <AlertBadge variant="success">Quitada</AlertBadge>
                )}
            </div>
            <p className="mt-1 text-sm text-at-muted">{formatDateTime(visita.created_at)}</p>
            {visita.latitude && visita.longitude && (
              <p className="mt-1 inline-flex items-center gap-1 text-xs text-at-muted">
                <MapPin className="h-3.5 w-3.5" />
                GPS registrado
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2 print:hidden">
          <Link
            href={`/coletas/nova/cassino?ponto=${visita.ponto_id}&editar_visita=${id}`}
            className="inline-flex items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-sm text-amber-100 hover:bg-amber-500/20"
          >
            Editar coleta completa
          </Link>
          <CorrigirPagamentoButton
            tipo="visita"
            id={id}
            valorAReceber={Math.max(
              Number(visita.valor_pago ?? 0) + Number(visita.restante ?? 0),
              Number(visita.valor_operacao_efetivo ?? visita.valor_operacao ?? 0),
              Number(calculo.totalACobrarReais ?? 0)
            )}
            valorPixInicial={Number(visita.valor_pix ?? 0)}
            valorDinheiroInicial={Number(visita.valor_dinheiro ?? 0)}
            valorPagoInicial={Math.max(
              Number(visita.valor_pago ?? 0),
              Number(calculo.valorPagoReais ?? 0)
            )}
          />
          <CompartilharColetaHistoricoActions
            snapshot={snapshot}
            telefone={ponto?.whatsapp}
            visitaId={id}
          />
          {visita.relatorio_url && (
            <a
              href={visita.relatorio_url}
              download
              className="inline-flex items-center gap-2 rounded-xl border border-slate-700 px-4 py-2 text-sm text-at-primary/90 hover:bg-slate-800"
            >
              <Download className="h-4 w-4" />
              Relatório PNG
            </a>
          )}
          {dadosImpressao ? (
            <ImprimirColetaCassinoButton
              data={dadosImpressao}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-700 px-4 py-2 text-sm text-at-primary/90 hover:bg-slate-800"
            />
          ) : null}
          <ExcluirVisitaButton visitaId={id} />
        </div>
      </div>

      {visita.saldo_negativo && calculoNegativo ? (
        <VisitaNegativaResumo
          calculo={calculoNegativo}
          adiantamento={adiantamentoDetalhe}
          totalLucroCentavos={Number(visita.total_lucro_centavos)}
        />
      ) : calculoPositivo ? (
        <VisitaPositivaResumo
          calculo={calculoPositivo}
          comissaoPercentual={Number(ponto?.comissao_percentual) || 0}
          totalLucroCentavos={Number(visita.total_lucro_centavos)}
        />
      ) : (
        <div className="glass-card grid gap-3 p-6 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <p className="text-at-muted">Lucro da visita</p>
            <p className="font-semibold text-white">
              {formatContador(Number(visita.total_lucro_centavos))}
            </p>
          </div>
          <div>
            <p className="text-at-muted">Comissão cliente</p>
            <p className="font-semibold text-amber-400">{formatCurrency(valorCliente)}</p>
          </div>
          <div>
            <p className="text-at-muted">Valor operação</p>
            <p className="font-semibold text-green-400">{formatCurrency(valorOperacao)}</p>
          </div>
        </div>
      )}

      <div className="space-y-3">
        <div className="flex items-end justify-between gap-3 px-0.5">
          <h2 className="text-sm font-semibold text-white">
            Máquinas{" "}
            <span className="font-normal text-at-muted">({coletas?.length ?? 0})</span>
          </h2>
        </div>
        {(coletas ?? []).map((c) => {
          const eq = c.equipamentos as { nome: string; tipo: string } | null;
          return (
            <div
              key={c.id}
              className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/60"
            >
              <div className="flex items-start justify-between gap-3 border-b border-slate-800/80 px-4 py-3">
                <div>
                  <p className="font-medium text-white">{eq?.nome ?? "Máquina"}</p>
                  {eq?.tipo && (
                    <p className="text-xs text-at-muted">
                      {getEquipamentoTipoLabel(eq.tipo as never)}
                    </p>
                  )}
                </div>
                <p className="text-base font-semibold tabular-nums text-emerald-400">
                  {formatCurrency(centesimosToReais(Number(c.lucro_centavos ?? 0)))}
                </p>
              </div>
              <div className="grid gap-3 p-4 sm:grid-cols-2">
                <div className="rounded-xl bg-slate-900/70 p-3 text-xs space-y-1.5">
                  <p className="font-medium text-at-primary/85">Entrada</p>
                  <div className="flex justify-between gap-2 text-at-muted">
                    <span>Anterior</span>
                    <span className="tabular-nums">{formatContador(Number(c.entrada_anterior ?? 0))}</span>
                  </div>
                  <div className="flex justify-between gap-2 text-at-muted">
                    <span>Atual</span>
                    <span className="tabular-nums">{formatContador(Number(c.entrada_atual ?? 0))}</span>
                  </div>
                  <div className="flex justify-between gap-2 border-t border-slate-800 pt-1.5 text-emerald-400">
                    <span>Período</span>
                    <span className="tabular-nums font-medium">
                      {formatContador(Number(c.entrada_periodo ?? 0))}
                    </span>
                  </div>
                </div>
                <div className="rounded-xl bg-slate-900/70 p-3 text-xs space-y-1.5">
                  <p className="font-medium text-at-primary/85">Saída</p>
                  <div className="flex justify-between gap-2 text-at-muted">
                    <span>Anterior</span>
                    <span className="tabular-nums">{formatContador(Number(c.saida_anterior ?? 0))}</span>
                  </div>
                  <div className="flex justify-between gap-2 text-at-muted">
                    <span>Atual</span>
                    <span className="tabular-nums">{formatContador(Number(c.saida_atual ?? 0))}</span>
                  </div>
                  <div className="flex justify-between gap-2 border-t border-slate-800 pt-1.5 text-rose-400">
                    <span>Período</span>
                    <span className="tabular-nums font-medium">
                      {formatContador(Number(c.saida_periodo ?? 0))}
                    </span>
                  </div>
                </div>
              </div>
              {c.foto_url && (
                <div className="border-t border-slate-800/80 p-3">
                  <ExpandableImage
                    src={c.foto_url}
                    alt={`Foto ${eq?.nome ?? "máquina"}`}
                    className="max-h-52 rounded-xl"
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {visita.observacao && (
        <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-at-muted">
            Observação
          </p>
          <p className="mt-1 text-sm text-at-primary/85">{visita.observacao}</p>
        </div>
      )}
    </div>
  );
}


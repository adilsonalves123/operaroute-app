import { createClient, getProfile } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, MessageCircle, Download, MapPin } from "lucide-react";
import { AlertBadge } from "@/components/ui/AlertBadge";
import { formatContador, centesimosToReais } from "@/lib/nichos/cassino";
import { buildRelatorioMensagemWhatsApp, whatsAppUrl } from "@/lib/nichos/cassino/relatorio";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { getEquipamentoTipoLabel } from "@/lib/equipamentos";
import { PrintButton } from "@/components/ui/PrintButton";
import { saldoPendenciaReais } from "@/lib/nichos/cassino/pendencias";
import { ExcluirVisitaButton } from "@/components/coletas/cassino/ExcluirVisitaButton";
import { VisitaNegativaResumo } from "@/components/coletas/cassino/VisitaNegativaResumo";
import { VisitaPositivaResumo } from "@/components/coletas/cassino/VisitaPositivaResumo";
import { ExpandableImage } from "@/components/ui/ExpandableImage";
import {
  reconstructCalculoNegativoFromVisita,
  reconstructCalculoPositivoFromVisita,
} from "@/lib/nichos/cassino/reconstruct-visita";

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

  const [{ data: coletas }, { data: empresa }, { data: pendenciasNegativas }, { data: pendenciasVisita }] =
    await Promise.all([
      supabase
        .from("coletas")
        .select("*, equipamentos(nome, tipo)")
        .eq("visita_id", id)
        .order("created_at"),
      supabase.from("empresas").select("nome_operacao").eq("id", profile.empresa_id).maybeSingle(),
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
    ]);

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
    ? reconstructCalculoNegativoFromVisita(visita, pendenciasVisita ?? [])
    : null;

  const calculoPositivo = !visita.saldo_negativo
    ? reconstructCalculoPositivoFromVisita(visita, pendenciasVisita ?? [])
    : null;

  const mensagem =
    ponto &&
    buildRelatorioMensagemWhatsApp({
      empresaNome: empresa?.nome_operacao ?? "Operação",
      pontoNome: ponto.nome,
      pontoWhatsapp: ponto.whatsapp,
      comissaoPercentual: Number(ponto.comissao_percentual) || 0,
      data: new Date(visita.created_at),
      previa: false,
      maquinas: (coletas ?? []).map((c) => ({
        nome: (c.equipamentos as { nome: string } | null)?.nome ?? "Máquina",
        entradaAnterior: Number(c.entrada_anterior ?? 0),
        saidaAnterior: Number(c.saida_anterior ?? 0),
        entradaAtual: Number(c.entrada_atual ?? 0),
        saidaAtual: Number(c.saida_atual ?? 0),
        lucroCentavos: Number(c.lucro_centavos ?? 0),
        fotoUrl: c.foto_url,
      })),
      calculo: calculoNegativo ?? calculoPositivo ?? {
        maquinas: [],
        totalEntradaPeriodo: Number(visita.total_entrada_periodo),
        totalSaidaPeriodo: Number(visita.total_saida_periodo),
        totalLucroCentavos: Number(visita.total_lucro_centavos),
        saldoNegativo: visita.saldo_negativo,
        debitoTotalReais: debitoAnterior,
        recuperacaoNegativoReais: recuperacaoNegativo,
        debitoAbatidoReais: debitoAbatido,
        debitoRestanteReais: debitoAtual,
        abatimentos: [],
        descontoManualReais: descontoManual,
        saldoAposDebitoReais: saldoAposDebito,
        saldoAposDescontoReais: saldoAposDesconto,
        valorClienteReais: valorCliente,
        valorOperacaoReais: valorOperacao,
        descontoRecebimentoReais: descontoRecebimento,
        valorOperacaoEfetivoReais: valorACobrar,
        totalACobrarReais: totalACobrar,
        pendenciaOperacaoTotalReais: 0,
        pendenciaOperacaoIncluidaReais: 0,
        pendenciaOperacaoAbatidaReais: 0,
        pendenciaOperacaoRestanteReais: 0,
        abatimentosPendenciaOperacao: [],
        valorDeixadoOperadorReais: descontoManual,
        valorPagoReais: valorPago,
        restanteOperacaoReais: restanteOperacao,
        restanteReais: restanteTotal,
        haverTotalReais: 0,
        haverCompensadoReais: 0,
        haverQuitadoReais: 0,
        haverRestanteReais: 0,
        abatimentosHaver: [],
        haverReais: haverGerado,
        haverGeradoReais: 0,
        clientePagouGanhadores: false,
        novoDebitoReais: 0,
        saldoLiquidoReais: 0,
        maquinasDistribuidas: [],
        comissaoAplicada: saldoAposDebito > 0.009,
      },
      adiantamento: adiantamentoDetalhe,
    });

  const waLink = mensagem ? whatsAppUrl(ponto?.whatsapp, mensagem) : null;

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-4">
        <Link href="/coletas" className="rounded-lg p-2 text-slate-400 hover:bg-slate-800">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold text-white">{ponto?.nome ?? "Visita"}</h1>
            {visita.saldo_negativo && <AlertBadge variant="danger">Saldo negativo</AlertBadge>}
            {Number(visita.restante) > 0.009 && !visita.saldo_negativo && (
              <AlertBadge variant="warning">Pagamento pendente</AlertBadge>
            )}
          </div>
          <p className="text-slate-400 text-sm">{formatDateTime(visita.created_at)}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 print:hidden">
        {waLink && (
          <a
            href={waLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-500"
          >
            <MessageCircle className="h-4 w-4" />
            WhatsApp
          </a>
        )}
        {visita.relatorio_url && (
          <a
            href={visita.relatorio_url}
            download
            className="inline-flex items-center gap-2 rounded-lg border border-slate-600 px-4 py-2 text-sm text-white hover:bg-slate-800"
          >
            <Download className="h-4 w-4" />
            Relatório PNG
          </a>
        )}
        <PrintButton />
        <ExcluirVisitaButton visitaId={id} />
        {visita.latitude && visita.longitude && (
          <span className="inline-flex items-center gap-1 text-xs text-slate-500 px-2 py-2">
            <MapPin className="h-3.5 w-3.5" />
            GPS registrado
          </span>
        )}
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
      <div className="glass-card p-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 text-sm">
        <div>
          <p className="text-slate-500">Lucro da visita</p>
          <p className="font-semibold text-white">
            {formatContador(Number(visita.total_lucro_centavos))}
          </p>
        </div>
        {descontoManual > 0.009 && (
              <div>
                <p className="text-slate-500">Desconto no lucro</p>
                <p className="font-semibold text-orange-400">− {formatCurrency(descontoManual)}</p>
                <p className="text-[10px] text-slate-500">Antes da comissão</p>
              </div>
            )}
            {descontoRecebimento > 0.009 && (
              <div>
                <p className="text-slate-500">Desconto no acerto</p>
                <p className="font-semibold text-orange-400">
                  − {formatCurrency(descontoRecebimento)}
                </p>
                <p className="text-[10px] text-slate-500">No valor a pagar</p>
              </div>
            )}
            {(descontoManual > 0.009 || descontoRecebimento > 0.009) && (
              <div>
                <p className="text-slate-500">Total de descontos</p>
                <p className="font-semibold text-orange-400">
                  {formatCurrency(descontoManual + descontoRecebimento)}
                </p>
              </div>
            )}
            {recuperacaoNegativo > 0.009 && (
              <div>
                <p className="text-slate-500">Recuperar negativo</p>
                <p className="font-semibold text-amber-400">{formatCurrency(recuperacaoNegativo)}</p>
              </div>
            )}
            {recuperacaoNegativo > 0.009 && debitoAnterior > 0.009 && (
              <div>
                <p className="text-slate-500">Base para comissão</p>
                <p className="font-semibold text-white">{formatCurrency(saldoAposDebito)}</p>
                <p className="text-[10px] text-slate-500">Lucro − negativo recuperado</p>
              </div>
            )}
            <div>
              <p className="text-slate-500">
                Comissão cliente
                {saldoAposDebito > 0.009 && Number(ponto?.comissao_percentual) > 0 && (
                  <span className="text-slate-600"> ({Number(ponto?.comissao_percentual)}%)</span>
                )}
              </p>
              <p className="font-semibold text-amber-400">{formatCurrency(valorCliente)}</p>
            </div>
            <div>
              <p className="text-slate-500">Valor operação</p>
              <p className="font-semibold text-green-400">{formatCurrency(valorOperacao)}</p>
            </div>
            {totalACobrar > 0.009 && (
              <div>
                <p className="text-slate-500">Total a cobrar</p>
                <p className="font-semibold text-primary-neon">{formatCurrency(totalACobrar)}</p>
              </div>
            )}
            <div>
              <p className="text-slate-500">Pago</p>
              <p className="font-semibold">{formatCurrency(valorPago)}</p>
            </div>
            {haverGerado > 0.009 && (
              <div>
                <p className="text-slate-500">Haver gerado</p>
                <p className="font-semibold text-cyan-400">{formatCurrency(haverGerado)}</p>
              </div>
            )}
            {restanteOperacao > 0.009 && (
              <div>
                <p className="text-slate-500">Dívida operação</p>
                <p className="font-semibold text-amber-400">{formatCurrency(restanteOperacao)}</p>
              </div>
            )}
            {restanteTotal > 0.009 && (
              <div>
                <p className="text-slate-500">Total em aberto</p>
                <p className="font-semibold text-amber-400">{formatCurrency(restanteTotal)}</p>
              </div>
            )}
      </div>
      )}

      <div className="space-y-4">
        <h2 className="font-semibold text-white">Máquinas ({coletas?.length ?? 0})</h2>
        {(coletas ?? []).map((c) => {
          const eq = c.equipamentos as { nome: string; tipo: string } | null;
          return (
            <div key={c.id} className="glass-card p-4 space-y-3">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-medium text-white">{eq?.nome ?? "Máquina"}</p>
                  {eq?.tipo && (
                    <p className="text-xs text-slate-500">{getEquipamentoTipoLabel(eq.tipo as never)}</p>
                  )}
                </div>
                <p className="font-semibold text-green-400">
                  {formatCurrency(centesimosToReais(Number(c.lucro_centavos ?? 0)))}
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 text-xs">
                <div className="rounded-lg bg-slate-900/50 p-3 space-y-1">
                  <p className="font-medium text-slate-300">Entrada</p>
                  <div className="flex justify-between gap-2 text-slate-400">
                    <span>Anterior</span>
                    <span>{formatContador(Number(c.entrada_anterior ?? 0))}</span>
                  </div>
                  <div className="flex justify-between gap-2 text-slate-400">
                    <span>Atual</span>
                    <span>{formatContador(Number(c.entrada_atual ?? 0))}</span>
                  </div>
                  <div className="flex justify-between gap-2 border-t border-slate-800 pt-1 text-green-400">
                    <span>Período</span>
                    <span>{formatContador(Number(c.entrada_periodo ?? 0))}</span>
                  </div>
                </div>
                <div className="rounded-lg bg-slate-900/50 p-3 space-y-1">
                  <p className="font-medium text-slate-300">Saída</p>
                  <div className="flex justify-between gap-2 text-slate-400">
                    <span>Anterior</span>
                    <span>{formatContador(Number(c.saida_anterior ?? 0))}</span>
                  </div>
                  <div className="flex justify-between gap-2 text-slate-400">
                    <span>Atual</span>
                    <span>{formatContador(Number(c.saida_atual ?? 0))}</span>
                  </div>
                  <div className="flex justify-between gap-2 border-t border-slate-800 pt-1 text-red-400">
                    <span>Período</span>
                    <span>{formatContador(Number(c.saida_periodo ?? 0))}</span>
                  </div>
                </div>
              </div>
              {c.foto_url && (
                <ExpandableImage
                  src={c.foto_url}
                  alt={`Foto ${eq?.nome ?? "máquina"}`}
                  className="max-h-48"
                />
              )}
            </div>
          );
        })}
      </div>

      {visita.observacao && (
        <div className="glass-card p-4">
          <p className="text-sm text-slate-400">{visita.observacao}</p>
        </div>
      )}
    </div>
  );
}

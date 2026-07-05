"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, AlertTriangle, Loader2, Clock, HandCoins } from "lucide-react";
import { FormInput, FormTextarea } from "@/components/ui/FormInput";
import { FormSelect } from "@/components/ui/FormInput";
import {
  MaquinaColetaCard,
  leituraToInput,
  leiturasToCalculoInput,
  useLeituraUpdater,
  useFotoUpdater,
} from "@/components/coletas/cassino/MaquinaColetaCard";
import { PreviaRelatorioPanel } from "@/components/coletas/cassino/PreviaRelatorioPanel";
import { ResumoOperacaoNegativaView } from "@/components/coletas/cassino/ResumoOperacaoNegativaView";
import { CobrancaClienteResumo } from "@/components/coletas/cassino/CobrancaClienteResumo";
import { PagamentoCaixaFields } from "@/components/coletas/cassino/PagamentoCaixaFields";
import { ColetaCassinoSucessoModal } from "@/components/coletas/cassino/ColetaCassinoSucessoModal";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";
import { calcularVisitaCassino, centesimosToReais, formatContador, resumoTotalVisita, somenteQuitarHaver, parseComissaoPercentual, baseComissaoReais, comissaoBloqueada } from "@/lib/nichos/cassino";
import {
  temErrosLeitura,
  validarLeiturasMaquina,
  type ErrosLeituraMaquina,
} from "@/lib/nichos/cassino/calculo-maquina";
import { saldoPendenciaReais } from "@/lib/nichos/cassino/pendencias";
import type { RelatorioColetaData } from "@/lib/nichos/cassino/relatorio";
import { uploadFotosMaquinasParalelo } from "@/lib/storage/coleta-fotos";
import { createClient } from "@/lib/supabase/client";
import { getEmpresaIdForUser } from "@/lib/supabase/empresa";
import {
  cn,
  formatCurrency,
  formatMoneyInput,
  formatMoneyInputOnBlur,
  parseMoneyInput,
} from "@/lib/utils";
import type { Equipamento, Ponto } from "@/lib/types/database";

interface PendenciaNegativa {
  id: string;
  valor: number | null;
  descricao: string | null;
  tipo?: string;
  titulo?: string | null;
}

interface SucessoState {
  visitaId: string;
  empresaId: string;
  relatorioData: RelatorioColetaData;
}

export function NovaColetaCassinoForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pontoInicial = searchParams.get("ponto") ?? "";

  const [loading, setLoading] = useState(false);
  const [loadingPonto, setLoadingPonto] = useState(false);
  const [error, setError] = useState("");
  const [empresaId, setEmpresaId] = useState<string | null>(null);
  const [empresaNome, setEmpresaNome] = useState("Operação");
  const [pontos, setPontos] = useState<Ponto[]>([]);
  const [pontoId, setPontoId] = useState(pontoInicial);
  const [ponto, setPonto] = useState<Ponto | null>(null);
  const [leituras, setLeituras] = useState<ReturnType<typeof leituraToInput>[]>([]);
  const [pendencias, setPendencias] = useState<PendenciaNegativa[]>([]);
  const [havers, setHavers] = useState<PendenciaNegativa[]>([]);
  const [pendenciasOperacao, setPendenciasOperacao] = useState<PendenciaNegativa[]>([]);
  const [incluirPendenciaOperacao, setIncluirPendenciaOperacao] = useState(false);
  const [abaterPendenciaOperacaoNegativa, setAbaterPendenciaOperacaoNegativa] = useState(true);
  const [incluirUsarHaverNegativo, setIncluirUsarHaverNegativo] = useState(false);
  const [comissaoVisita, setComissaoVisita] = useState("");
  const [sucesso, setSucesso] = useState<SucessoState | null>(null);
  const [validacaoVisivel, setValidacaoVisivel] = useState(false);
  const [gps, setGps] = useState<{ latitude: number; longitude: number } | null>(null);
  const [pagamento, setPagamento] = useState({
    desconto_manual: "",
    desconto_recebimento: "",
    valor_pix: "",
    valor_dinheiro: "",
    adiantamento_pix: "",
    adiantamento_dinheiro: "",
    adiantamento_pix_do_caixa: false,
    adiantamento_dinheiro_do_caixa: false,
    recebimento_pix_do_caixa: false,
    recebimento_dinheiro_do_caixa: false,
    observacao: "",
  });

  const updateLeitura = useLeituraUpdater(setLeituras);
  const updateFoto = useFotoUpdater(setLeituras);

  function handleToggleAbaterPendenciaOperacaoNegativa(checked: boolean) {
    setAbaterPendenciaOperacaoNegativa(checked);
    if (checked) {
      setPagamento((p) => ({
        ...p,
        valor_pix: "",
        valor_dinheiro: "",
        recebimento_pix_do_caixa: false,
        recebimento_dinheiro_do_caixa: false,
      }));
    }
  }

  const validarFormulario = useCallback((exigirPreenchimento: boolean) => {
    const errosLeitura = new Map<string, ErrosLeituraMaquina>();
    const errosFotoMap = new Map<string, string>();

    for (const l of leituras) {
      const parcial = validarLeiturasMaquina({
        entradaAnterior: l.entradaAnterior,
        saidaAnterior: l.saidaAnterior,
        entradaAtualInput: l.entradaAtualInput,
        saidaAtualInput: l.saidaAtualInput,
        exigirPreenchimento,
      });
      if (temErrosLeitura(parcial)) {
        errosLeitura.set(l.equipamentoId, parcial);
      }

      const leituraPreenchida = l.entradaAtualInput || l.saidaAtualInput;
      const exigeFoto = exigirPreenchimento || leituraPreenchida;
      if (exigeFoto && !l.fotoFile) {
        errosFotoMap.set(l.equipamentoId, "Foto obrigatória");
      }
    }

    return { errosLeitura, errosFotoMap };
  }, [leituras]);

  function scrollParaPrimeiroErro(
    errosLeitura: Map<string, ErrosLeituraMaquina>,
    errosFotoMap: Map<string, string>
  ) {
    const primeira =
      leituras.find((l) => {
        const e = errosLeitura.get(l.equipamentoId);
        return e && temErrosLeitura(e);
      }) ?? leituras.find((l) => errosFotoMap.has(l.equipamentoId));

    if (primeira) {
      requestAnimationFrame(() => {
        document
          .getElementById(`maquina-${primeira.equipamentoId}`)
          ?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    }
  }

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        setGps({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        }),
      () => {},
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  useEffect(() => {
    async function loadPontos() {
      const supabase = createClient();
      const eid = await getEmpresaIdForUser(supabase);
      if (!eid) return;
      setEmpresaId(eid);

      const [{ data: pontosData }, { data: empresa }] = await Promise.all([
        supabase
          .from("pontos")
          .select("*")
          .eq("empresa_id", eid)
          .eq("status", "ativo")
          .order("nome"),
        supabase.from("empresas").select("nome_operacao").eq("id", eid).maybeSingle(),
      ]);

      setPontos(pontosData ?? []);
      if (empresa?.nome_operacao) setEmpresaNome(empresa.nome_operacao);
    }
    loadPontos();
  }, []);

  useEffect(() => {
    if (!pontoId) {
      setPonto(null);
      setLeituras([]);
      setPendencias([]);
      setHavers([]);
      setPendenciasOperacao([]);
      setIncluirPendenciaOperacao(false);
      setAbaterPendenciaOperacaoNegativa(true);
      setIncluirUsarHaverNegativo(false);
      setComissaoVisita("");
      setValidacaoVisivel(false);
      return;
    }

    async function loadPontoData() {
      setLoadingPonto(true);
      setError("");

      const supabase = createClient();
      const [{ data: pontoData }, { data: equipamentos }, { data: pendenciasData }, { data: haverData }, { data: operacaoData }] =
        await Promise.all([
          supabase.from("pontos").select("*").eq("id", pontoId).maybeSingle(),
          supabase
            .from("equipamentos")
            .select("*")
            .eq("ponto_id", pontoId)
            .eq("tipo", "cassino")
            .eq("status", "ativo")
            .order("nome"),
          supabase
            .from("pendencias")
            .select("id, valor, descricao, tipo, titulo")
            .eq("ponto_id", pontoId)
            .eq("status", "aberta")
            .ilike("tipo", "negativo"),
          supabase
            .from("pendencias")
            .select("id, valor, descricao, tipo, titulo")
            .eq("ponto_id", pontoId)
            .eq("status", "aberta")
            .ilike("tipo", "haver"),
          supabase
            .from("pendencias")
            .select("id, valor, descricao, tipo, titulo")
            .eq("ponto_id", pontoId)
            .eq("status", "aberta")
            .in("tipo", ["pagamento_pendente", "parcial"]),
        ]);

      setPonto(pontoData);
      setComissaoVisita(String(pontoData?.comissao_percentual ?? 0));
      setPendencias(pendenciasData ?? []);
      setHavers(haverData ?? []);
      setPendenciasOperacao(operacaoData ?? []);
      setIncluirPendenciaOperacao(false);
      setAbaterPendenciaOperacaoNegativa(true);
      setIncluirUsarHaverNegativo(false);

      const cassinos = (equipamentos ?? []).filter((e: Equipamento) => e.tipo === "cassino");
      setLeituras(cassinos.map(leituraToInput));
      setLoadingPonto(false);

      if (!pontoData) setError("Ponto não encontrado.");
      else if (cassinos.length === 0) setError("Este ponto não tem máquinas cassino cadastradas.");
    }

    loadPontoData();
  }, [pontoId]);

  const { errosLeitura: errosMaquinas, errosFotoMap: errosFoto } = useMemo(
    () => validarFormulario(validacaoVisivel),
    [validarFormulario, validacaoVisivel]
  );

  const comissaoPercentual = parseComissaoPercentual(comissaoVisita);

  const calculo = useMemo(() => {
    const input = leiturasToCalculoInput(leituras);
    if (input.length === 0 || input.length !== leituras.length) return null;
    if (errosMaquinas.size > 0) return null;

    const pendenciasNegativas = pendencias.map((p) => ({
      id: p.id,
      valor: Number(p.valor ?? 0),
      observacao: p.descricao,
    }));
    const pendenciasHaver = havers.map((p) => ({
      id: p.id,
      valor: Number(p.valor ?? 0),
      observacao: p.descricao,
    }));
    const pendenciasOperacaoMapped = pendenciasOperacao.map((p) => ({
      id: p.id,
      valor: Number(p.valor ?? 0),
      observacao: p.descricao,
    }));

    const valorPix = parseMoneyInput(pagamento.valor_pix);
    const valorDinheiro = parseMoneyInput(pagamento.valor_dinheiro);
    const adiantamentoPix = parseMoneyInput(pagamento.adiantamento_pix);
    const adiantamentoDinheiro = parseMoneyInput(pagamento.adiantamento_dinheiro);
    const adiantamentoTotal = adiantamentoPix + adiantamentoDinheiro;
    const descontoManualInput = parseMoneyInput(pagamento.desconto_manual);
    const temHaver = pendenciasHaver.some((p) => p.valor > 0.009);

    const calcInputBase = {
      leituras: input,
      pendenciasNegativas,
      pendenciasHaver,
      pendenciasOperacao: pendenciasOperacaoMapped,
      incluirPendenciasOperacao: incluirPendenciaOperacao,
      abaterPendenciaOperacaoNegativa,
      incluirUsarHaverNegativo: incluirUsarHaverNegativo,
      comissaoPercentual,
      descontoRecebimentoReais: parseMoneyInput(pagamento.desconto_recebimento),
      abaterAutomatico: ponto?.abater_automatico !== false,
    };

    try {
      const calcProbe = calcularVisitaCassino({
        ...calcInputBase,
        descontoManualReais: 0,
        descontoRecebimentoReais: 0,
        valorPixReais: 0,
        valorDinheiroReais: 0,
      });

      const modoQuitarHaver = somenteQuitarHaver(calcProbe);
      const operadorPagaHaver = valorPix + valorDinheiro;

      const descontoManualReais = calcProbe.saldoNegativo
        ? adiantamentoTotal
        : temHaver
          ? modoQuitarHaver
            ? operadorPagaHaver
            : descontoManualInput
          : descontoManualInput;

      return calcularVisitaCassino({
        ...calcInputBase,
        descontoManualReais,
        valorPixReais: calcProbe.saldoNegativo || !modoQuitarHaver ? valorPix : 0,
        valorDinheiroReais: calcProbe.saldoNegativo || !modoQuitarHaver ? valorDinheiro : 0,
      });
    } catch {
      return null;
    }
  }, [leituras, pendencias, havers, pendenciasOperacao, incluirPendenciaOperacao, abaterPendenciaOperacaoNegativa, incluirUsarHaverNegativo, ponto, pagamento, errosMaquinas, comissaoPercentual]);

  const adiantamentoDetalhe = useMemo(() => {
    const pixReais = parseMoneyInput(pagamento.adiantamento_pix);
    const dinheiroReais = parseMoneyInput(pagamento.adiantamento_dinheiro);
    if (pixReais <= 0.009 && dinheiroReais <= 0.009) return undefined;
    return {
      pixReais,
      dinheiroReais,
      pixDoCaixa: pagamento.adiantamento_pix_do_caixa,
      dinheiroDoCaixa: pagamento.adiantamento_dinheiro_do_caixa,
    };
  }, [
    pagamento.adiantamento_pix,
    pagamento.adiantamento_dinheiro,
    pagamento.adiantamento_pix_do_caixa,
    pagamento.adiantamento_dinheiro_do_caixa,
  ]);

  const modoQuitarHaver = calculo ? somenteQuitarHaver(calculo) : false;
  const descontoOperacaoExibido = calculo
    ? Math.max(0, calculo.valorOperacaoReais - calculo.valorOperacaoEfetivoReais)
    : 0;
  const resumoAcertoNegativo = useMemo(() => {
    if (!calculo || !calculo.saldoNegativo) return null;

    const prejuizoVisitaReais = centesimosToReais(Math.abs(calculo.totalLucroCentavos));
    const abatidoPendenciaReais = calculo.pendenciaOperacaoAbatidaReais;
    const valorBaseAcertoReais = Math.max(0, prejuizoVisitaReais - abatidoPendenciaReais);
    const valorInformadoReais = Math.min(calculo.valorDeixadoOperadorReais, valorBaseAcertoReais);
    const valorRestanteReais = Math.max(0, valorBaseAcertoReais - valorInformadoReais);
    const saldoLiquidoAbsReais = Math.abs(calculo.saldoLiquidoReais);

    const saldoLabel =
      saldoLiquidoAbsReais <= 0.009
        ? "Acerto zerado com o ponto"
        : calculo.saldoLiquidoReais > 0
          ? "Ponto ainda te deve"
          : "Você ainda deve ao ponto";

    return {
      prejuizoVisitaReais,
      abatidoPendenciaReais,
      valorBaseAcertoReais,
      valorInformadoReais,
      valorRestanteReais,
      negativoARecuperarReais: calculo.novoDebitoReais,
      saldoLiquidoAbsReais,
      saldoLabel,
    };
  }, [calculo]);

  const eraSaldoNegativo = useRef(false);
  useEffect(() => {
    if (!calculo) return;
    if (eraSaldoNegativo.current && !calculo.saldoNegativo) {
      setPagamento((p) => ({
        ...p,
        desconto_manual: "",
        adiantamento_pix: "",
        adiantamento_dinheiro: "",
        adiantamento_pix_do_caixa: false,
        adiantamento_dinheiro_do_caixa: false,
      }));
    }
    eraSaldoNegativo.current = calculo.saldoNegativo;
  }, [calculo]);

  const relatorioData: RelatorioColetaData | null = useMemo(() => {
    if (!calculo || !ponto) return null;
    return {
      empresaNome,
      pontoNome: ponto.nome,
      pontoWhatsapp: ponto.whatsapp,
      comissaoPercentual,
      data: new Date(),
      previa: false,
      maquinas: calculo.maquinas.map((m) => ({
        nome: m.nome,
        entradaAnterior: m.entradaAnterior,
        saidaAnterior: m.saidaAnterior,
        entradaAtual: m.entradaAtual,
        saidaAtual: m.saidaAtual,
        lucroCentavos: m.lucroCentavos,
        fotoUrl: leituras.find((l) => l.equipamentoId === m.equipamentoId)?.fotoPreview,
      })),
      calculo,
      adiantamento: adiantamentoDetalhe,
    };
  }, [calculo, ponto, empresaNome, leituras, comissaoPercentual, adiantamentoDetalhe]);

  const debitoAberto = pendencias.reduce(
    (s, p) =>
      s + saldoPendenciaReais({ id: p.id, valor: Number(p.valor ?? 0), observacao: p.descricao }),
    0
  );

  const haverAberto = havers.reduce((s, p) => s + Number(p.valor ?? 0), 0);
  const haverCompensadoAnterior = havers.reduce(
    (s, p) =>
      s +
      Math.max(
        0,
        Number(p.valor ?? 0) -
          saldoPendenciaReais({
            id: p.id,
            valor: Number(p.valor ?? 0),
            observacao: p.descricao,
          })
      ),
    0
  );
  const haverSaldoAberto = Math.max(0, haverAberto - haverCompensadoAnterior);

  const pendenciaOperacaoAberta = pendenciasOperacao.reduce(
    (s, p) => s + Number(p.valor ?? 0),
    0
  );
  const temPagamentoParcial = pendenciasOperacao.some(
    (p) => p.tipo?.toLowerCase() === "parcial"
  );

  const leiturasCompletas =
    leituras.length > 0 &&
    leituras.every((l) => l.entradaAtualInput && l.saidaAtualInput && l.fotoFile);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setValidacaoVisivel(true);

    if (!pontoId || !empresaId || leituras.length === 0) {
      setError("Selecione um ponto com máquinas cadastradas.");
      return;
    }

    const { errosLeitura, errosFotoMap } = validarFormulario(true);

    if (
      !leituras.every((l) => l.entradaAtualInput && l.saidaAtualInput && l.fotoFile) ||
      errosLeitura.size > 0 ||
      errosFotoMap.size > 0
    ) {
      scrollParaPrimeiroErro(errosLeitura, errosFotoMap);
      return;
    }

    if (!calculo || !relatorioData) {
      setError("Não foi possível calcular a visita.");
      return;
    }

    setLoading(true);

    try {
      const supabase = createClient();
      const visitaFolder = crypto.randomUUID();

      const fotos = leituras
        .filter((l): l is typeof l & { fotoFile: File } => !!l.fotoFile)
        .map((l) => ({ equipamentoId: l.equipamentoId, file: l.fotoFile }));

      const fotoUrls = await uploadFotosMaquinasParalelo(
        supabase,
        empresaId,
        visitaFolder,
        fotos
      );

      const recebimentoPixReais = parseMoneyInput(pagamento.valor_pix);
      const recebimentoDinheiroReais = parseMoneyInput(pagamento.valor_dinheiro);

      const res = await fetch("/api/visitas/cassino", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          ponto_id: pontoId,
          leituras: leituras.map((l) => ({
            equipamento_id: l.equipamentoId,
            entrada_atual: l.entradaAtualInput.replace(/\D/g, ""),
            saida_atual: l.saidaAtualInput.replace(/\D/g, ""),
            foto_url: fotoUrls.get(l.equipamentoId),
          })),
          desconto_manual: pagamento.desconto_manual,
          adiantamento_pix: pagamento.adiantamento_pix,
          adiantamento_dinheiro: pagamento.adiantamento_dinheiro,
          adiantamento_pix_do_caixa: pagamento.adiantamento_pix_do_caixa,
          adiantamento_dinheiro_do_caixa: pagamento.adiantamento_dinheiro_do_caixa,
          recebimento_pix_do_caixa: recebimentoPixReais > 0.009 || pagamento.recebimento_pix_do_caixa,
          recebimento_dinheiro_do_caixa:
            recebimentoDinheiroReais > 0.009 || pagamento.recebimento_dinheiro_do_caixa,
          desconto_recebimento: pagamento.desconto_recebimento,
          valor_pix: pagamento.valor_pix,
          valor_dinheiro: pagamento.valor_dinheiro,
          incluir_pendencia_operacao: incluirPendenciaOperacao,
          abater_pendencia_operacao_negativa: abaterPendenciaOperacaoNegativa,
          incluir_usar_haver_negativo: incluirUsarHaverNegativo,
          comissao_percentual: comissaoPercentual,
          observacao: pagamento.observacao || null,
          latitude: gps?.latitude ?? null,
          longitude: gps?.longitude ?? null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Erro ao registrar coleta.");
        return;
      }

      setSucesso({
        visitaId: data.visita_id,
        empresaId,
        relatorioData: { ...relatorioData, previa: false },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  function handleConcluir() {
    setSucesso(null);
    router.push("/coletas");
    router.refresh();
  }

  return (
    <>
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/coletas" className="rounded-lg p-2 text-slate-400 hover:bg-slate-800">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-white">Nova leitura</h1>
            <p className="text-slate-400 text-sm">Cassino · leitura por máquina + relatório</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div
            className={cn(
              "glass-card p-6 space-y-4 transition-colors",
              ponto &&
                debitoAberto > 0.009 &&
                "border-amber-500/35 ring-1 ring-amber-500/15",
              ponto &&
                haverAberto > 0.009 &&
                debitoAberto <= 0.009 &&
                "border-cyan-500/35 ring-1 ring-cyan-500/15",
              ponto &&
                haverAberto > 0.009 &&
                debitoAberto > 0.009 &&
                "border-amber-500/25 ring-1 ring-amber-500/10",
              ponto &&
                pendenciaOperacaoAberta > 0.009 &&
                debitoAberto <= 0.009 &&
                haverAberto <= 0.009 &&
                "border-rose-500/35 ring-1 ring-rose-500/15"
            )}
          >
            <FormSelect
              label="Ponto *"
              value={pontoId}
              onChange={(e) => setPontoId(e.target.value)}
              options={[
                { value: "", label: "Selecione o ponto..." },
                ...pontos.map((p) => ({ value: p.id, label: p.nome })),
              ]}
            />

            {ponto && (
              <>
                {(debitoAberto > 0.009 ||
                  haverAberto > 0.009 ||
                  pendenciaOperacaoAberta > 0.009) && (
                  <div className="space-y-2">
                    {debitoAberto > 0.009 && (
                      <div className="rounded-lg border border-amber-500/45 bg-amber-500/12 px-4 py-3 space-y-2">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-500/20">
                            <AlertTriangle className="h-5 w-5 text-amber-400" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium uppercase tracking-wide text-amber-400/90">
                              Negativo em aberto
                            </p>
                            <p className="text-xl font-bold tabular-nums text-amber-300">
                              {formatCurrency(debitoAberto)}
                            </p>
                            <p className="text-xs text-amber-400/75 mt-0.5">
                              Você adiantou — recuperar nesta coleta
                            </p>
                          </div>
                        </div>
                        {pendencias.length > 0 && (
                          <div className="border-t border-amber-500/20 pt-2 space-y-1.5 text-xs">
                            {pendencias.map((p) => {
                              const saldo = saldoPendenciaReais({
                                id: p.id,
                                valor: Number(p.valor ?? 0),
                                observacao: p.descricao,
                              });
                              if (saldo <= 0.009) return null;
                              return (
                                <div key={p.id} className="flex justify-between gap-3 text-slate-400">
                                  <span className="min-w-0 truncate">
                                    {p.titulo ?? "Saldo negativo"}
                                    {p.descricao && (
                                      <span className="block text-[10px] text-slate-500 truncate">
                                        {p.descricao.split("\n")[0]}
                                      </span>
                                    )}
                                  </span>
                                  <span className="font-semibold tabular-nums text-amber-300 shrink-0">
                                    {formatCurrency(saldo)}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                    {haverAberto > 0.009 && (
                      <div className="flex items-center gap-3 rounded-lg border border-cyan-500/45 bg-cyan-500/12 px-4 py-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-cyan-500/20">
                          <HandCoins className="h-5 w-5 text-cyan-400" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium uppercase tracking-wide text-cyan-400/90">
                            Haver do ponto
                          </p>
                          <p className="text-xl font-bold tabular-nums text-cyan-300">
                            {formatCurrency(
                              haverSaldoAberto > 0.009 ? haverSaldoAberto : haverAberto
                            )}
                          </p>
                          <p className="text-xs text-cyan-400/75 mt-0.5">
                            {haverCompensadoAnterior > 0.009
                              ? `Registrado ${formatCurrency(haverAberto)} · já compensado ${formatCurrency(haverCompensadoAnterior)}`
                              : "Ponto pagou ganhadores — abate do lucro ou você devolve"}
                          </p>
                        </div>
                      </div>
                    )}
                    {pendenciaOperacaoAberta > 0.009 && (
                      <div className="rounded-lg border border-rose-500/45 bg-rose-500/12 px-4 py-3 space-y-2">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-500/20">
                            <Clock className="h-5 w-5 text-rose-400" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium uppercase tracking-wide text-rose-400/90">
                              {temPagamentoParcial
                                ? "Pagamento parcial em aberto"
                                : "Pagamento pendente"}
                            </p>
                            <p className="text-xl font-bold tabular-nums text-rose-300">
                              {formatCurrency(pendenciaOperacaoAberta)}
                            </p>
                            <p className="text-xs text-rose-400/75 mt-0.5">
                              Dívida da operação de coletas anteriores — pode incluir na cobrança
                            </p>
                          </div>
                        </div>
                        {pendenciasOperacao.length > 0 && (
                          <div className="border-t border-rose-500/20 pt-2 space-y-1.5 text-xs">
                            {pendenciasOperacao.map((p) => (
                              <div key={p.id} className="flex justify-between gap-3 text-slate-400">
                                <span className="min-w-0 truncate">
                                  {p.titulo ?? "Dívida da operação"}
                                  {p.descricao && (
                                    <span className="block text-[10px] text-slate-500 truncate">
                                      {p.descricao.split("\n")[0]}
                                    </span>
                                  )}
                                </span>
                                <span className="font-semibold tabular-nums text-rose-300 shrink-0">
                                  {formatCurrency(Number(p.valor ?? 0))}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500">
                  <span>
                    Comissão: <strong className="text-slate-300">{comissaoPercentual}%</strong>
                  </span>
                  {gps && (
                    <span className="text-green-500/80 text-xs">GPS capturado</span>
                  )}
                </div>
              </>
            )}
          </div>

          {loadingPonto && (
            <div className="flex items-center justify-center gap-2 text-slate-400 py-8">
              <Loader2 className="h-5 w-5 animate-spin" />
              Carregando máquinas...
            </div>
          )}

          {!loadingPonto && leituras.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-sm font-medium text-slate-400">Leituras das máquinas</h2>
              {leituras.map((l) => {
                const erros = errosMaquinas.get(l.equipamentoId);
                return (
                  <MaquinaColetaCard
                    key={l.equipamentoId}
                    leitura={l}
                    onUpdate={updateLeitura}
                    onFotoChange={updateFoto}
                    erroEntrada={erros?.entrada}
                    erroSaida={erros?.saida}
                    erroFoto={errosFoto.get(l.equipamentoId)}
                  />
                );
              })}
            </div>
          )}

          {calculo && relatorioData && (
            <>
              <div className="glass-card p-6 space-y-4 border border-primary-neon/20">
                <h2 className="font-semibold text-white">Resumo da visita</h2>
                {calculo.saldoNegativo ? (
                  <div className="space-y-3">
                    <div className="flex items-start gap-2 rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-red-300 text-sm">
                      <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                      Comissão bloqueada — negativo só recupera em coleta positiva.
                    </div>
                    <ResumoOperacaoNegativaView
                      calculo={calculo}
                      adiantamento={adiantamentoDetalhe}
                    />
                  </div>
                ) : (
                  <>
                    <div className="space-y-2.5 text-sm">
                      <div className="flex items-baseline justify-between gap-4">
                        <p className="text-slate-500">Total entrada / Total saída</p>
                        <p className="font-semibold text-white tabular-nums text-right">
                          {formatContador(calculo.totalEntradaPeriodo)}
                          <span className="text-slate-600 mx-1">/</span>
                          <span className="text-red-400/90">
                            {formatContador(calculo.totalSaidaPeriodo)}
                          </span>
                        </p>
                      </div>
                      <div className="flex items-baseline justify-between gap-4">
                        <p className="text-slate-500">Lucro da visita</p>
                        <p className="font-semibold text-white tabular-nums">
                          {formatContador(calculo.totalLucroCentavos)}
                        </p>
                      </div>
                      {(calculo.haverCompensadoReais > 0.009 ||
                        calculo.recuperacaoNegativoReais > 0.009) &&
                        baseComissaoReais(calculo) > 0.009 && (
                          <div className="flex items-baseline justify-between gap-4">
                            <p className="text-slate-500">Base para comissão</p>
                            <p className="font-semibold text-white tabular-nums">
                              {formatCurrency(baseComissaoReais(calculo))}
                            </p>
                          </div>
                        )}
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2 min-w-0">
                          <p className="text-slate-500 shrink-0">
                            {comissaoBloqueada(calculo) ? "Comissão bloqueada" : "Comissão"}
                          </p>
                          {!comissaoBloqueada(calculo) && (
                            <>
                              <input
                                type="number"
                                min={0}
                                max={100}
                                step={0.01}
                                value={comissaoVisita}
                                onChange={(e) => setComissaoVisita(e.target.value)}
                                className="w-[4.5rem] rounded-md border border-slate-700 bg-slate-900/80 px-2 py-1 text-sm text-white tabular-nums"
                                aria-label="Comissão percentual"
                              />
                              <span className="text-slate-500 text-xs">%</span>
                            </>
                          )}
                        </div>
                        <p className="font-semibold text-orange-400 tabular-nums shrink-0">
                          {formatCurrency(calculo.valorClienteReais)}
                        </p>
                      </div>
                      {!comissaoBloqueada(calculo) &&
                        comissaoPercentual <= 0 &&
                        baseComissaoReais(calculo) > 0.009 && (
                          <p className="text-[11px] text-amber-400/90">
                            Informe a comissão (%) — ela incide só sobre a base de{" "}
                            {formatCurrency(baseComissaoReais(calculo))}, não sobre o haver compensado.
                          </p>
                        )}
                      <div className="flex items-baseline justify-between gap-4">
                        <p className="text-slate-500">Valor operação</p>
                        <p className="font-semibold text-green-400 tabular-nums">
                          {formatCurrency(calculo.valorOperacaoReais)}
                        </p>
                      </div>
                      {descontoOperacaoExibido > 0.009 && (
                        <>
                          <div className="flex items-baseline justify-between gap-4 min-w-0">
                            <p className="text-slate-500 shrink min-w-0">Desconto na operação</p>
                            <p className="font-semibold text-orange-400 tabular-nums shrink-0 whitespace-nowrap text-right">
                              − {formatCurrency(descontoOperacaoExibido)}
                            </p>
                          </div>
                          <div className="flex items-baseline justify-between gap-4">
                            <p className="text-slate-500">Operação líquida</p>
                            <p className="font-semibold text-green-400 tabular-nums">
                              {formatCurrency(calculo.valorOperacaoEfetivoReais)}
                            </p>
                          </div>
                        </>
                      )}
                      {calculo.haverTotalReais > 0.009 && (
                        <div className="flex items-baseline justify-between gap-4">
                          <p className="text-slate-500">Haver do ponto</p>
                          <p className="font-semibold text-cyan-400 tabular-nums">
                            {formatCurrency(calculo.haverTotalReais)}
                          </p>
                        </div>
                      )}
                      {(() => {
                        const total = resumoTotalVisita(calculo);
                        return (
                          <div className="border-t border-slate-800 pt-3 mt-1">
                            <div className="flex items-baseline justify-between gap-4">
                              <p className="font-medium text-slate-300">{total.label}</p>
                              <p
                                className={`text-base font-bold tabular-nums ${
                                  total.tipo === "pagar" ? "text-amber-400" : "text-primary-neon"
                                }`}
                              >
                                {formatCurrency(total.valorReais)}
                              </p>
                            </div>
                            {total.hint && (
                              <p className="text-[11px] text-slate-500 mt-1 text-right">
                                {total.hint}
                              </p>
                            )}
                          </div>
                        );
                      })()}
                    </div>

                    {(calculo.debitoTotalReais > 0.009 ||
                      calculo.recuperacaoNegativoReais > 0.009 ||
                      calculo.descontoManualReais > 0.009 ||
                      calculo.descontoRecebimentoReais > 0.009 ||
                      calculo.pendenciaOperacaoIncluidaReais > 0.009 ||
                      calculo.haverCompensadoReais > 0.009 ||
                      calculo.haverQuitadoReais > 0.009) && (
                      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 text-sm border-t border-slate-800 pt-3 mt-3">
                        {calculo.debitoTotalReais > 0.009 && (
                          <div>
                            <p className="text-slate-500">Negativo em aberto</p>
                            <p className="font-semibold text-amber-400">
                              {formatCurrency(calculo.debitoTotalReais)}
                            </p>
                          </div>
                        )}
                        {calculo.recuperacaoNegativoReais > 0.009 && (
                          <div>
                            <p className="text-slate-500">Recuperar negativo</p>
                            <p className="font-semibold text-amber-400">
                              {formatCurrency(calculo.recuperacaoNegativoReais)}
                            </p>
                          </div>
                        )}
                        {calculo.recuperacaoNegativoReais > 0.009 &&
                          calculo.debitoTotalReais > 0.009 && (
                            <div>
                              <p className="text-slate-500">Base para comissão</p>
                              <p className="font-semibold text-white">
                                {formatCurrency(calculo.saldoAposDebitoReais)}
                              </p>
                            </div>
                          )}
                        {calculo.haverCompensadoReais > 0.009 && (
                          <div>
                            <p className="text-slate-500">Compensado pelo lucro</p>
                            <p className="font-semibold text-cyan-400">
                              {formatCurrency(calculo.haverCompensadoReais)}
                            </p>
                          </div>
                        )}
                        {calculo.descontoManualReais > 0.009 &&
                          calculo.debitoTotalReais <= 0.009 && (
                            <div>
                              <p className="text-slate-500">Desconto no lucro</p>
                              <p className="font-semibold text-orange-400">
                                − {formatCurrency(calculo.descontoManualReais)}
                              </p>
                            </div>
                          )}
                        {descontoOperacaoExibido > 0.009 && (
                          <div>
                            <p className="text-slate-500">Desconto na operação</p>
                            <p className="font-semibold text-orange-400 tabular-nums whitespace-nowrap">
                              − {formatCurrency(descontoOperacaoExibido)}
                            </p>
                          </div>
                        )}
                        {calculo.pendenciaOperacaoIncluidaReais > 0.009 && (
                          <div>
                            <p className="text-slate-500">Pendência anterior</p>
                            <p className="font-semibold text-amber-400">
                              + {formatCurrency(calculo.pendenciaOperacaoIncluidaReais)}
                            </p>
                          </div>
                        )}
                        {calculo.haverQuitadoReais > 0.009 && (
                          <div>
                            <p className="text-slate-500">Você pagou o ponto (haver)</p>
                            <p className="font-semibold text-cyan-400">
                              {formatCurrency(calculo.haverQuitadoReais)}
                            </p>
                          </div>
                        )}
                        {calculo.haverRestanteReais > 0.009 &&
                          centesimosToReais(calculo.totalLucroCentavos) + 0.009 >=
                            calculo.haverTotalReais && (
                            <div>
                              <p className="text-slate-500">Haver restante</p>
                              <p className="font-semibold text-cyan-400">
                                {formatCurrency(calculo.haverRestanteReais)}
                              </p>
                            </div>
                          )}
                        {resumoTotalVisita(calculo).tipo === "pagar" &&
                          calculo.totalACobrarReais > 0.009 && (
                            <div>
                              <p className="text-slate-500">Cliente ainda paga</p>
                              <p className="font-semibold text-primary-neon">
                                {formatCurrency(calculo.totalACobrarReais)}
                              </p>
                            </div>
                          )}
                      </div>
                    )}
                  </>
                )}
              </div>
            </>
          )}

          {calculo && calculo.saldoNegativo && calculo.pendenciaOperacaoTotalReais > 0.009 && (
            <div className="glass-card p-6 space-y-4 border border-rose-500/20">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-rose-400" />
                <h2 className="font-semibold text-white">Pendência da coleta anterior</h2>
              </div>
              <p className="text-xs text-slate-400">
                Ponto deve{" "}
                <strong className="text-rose-300">
                  {formatCurrency(calculo.pendenciaOperacaoTotalReais)}
                </strong>
                {abaterPendenciaOperacaoNegativa
                  ? ". Se marcar abaixo, esse valor entra abatendo o prejuízo de hoje."
                  : ". Se houve recebimento real hoje, informe abaixo."}
              </p>
              <label
                htmlFor="abater-pendencia-operacao-negativa"
                className={`flex cursor-pointer gap-3 rounded-lg border p-4 transition-colors ${
                  abaterPendenciaOperacaoNegativa
                    ? "border-emerald-500/35 bg-emerald-500/5"
                    : "border-slate-700/60 bg-slate-900/30 hover:border-slate-600"
                }`}
              >
                <input
                  type="checkbox"
                  id="abater-pendencia-operacao-negativa"
                  checked={abaterPendenciaOperacaoNegativa}
                  onChange={(e) => handleToggleAbaterPendenciaOperacaoNegativa(e.target.checked)}
                  className="mt-0.5"
                />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                    <span className="flex items-center gap-2 text-sm font-medium text-white">
                      <Clock className="h-4 w-4 shrink-0 text-emerald-400" />
                      Quer abater da pendência?
                    </span>
                  </div>
                  <p className="text-xs leading-relaxed text-slate-400">
                    Marcado = usa automaticamente o que o ponto te deve para reduzir o prejuízo de
                    hoje. Desmarcado = se houve recebimento real, você informa abaixo.
                  </p>
                </div>
              </label>
              {!abaterPendenciaOperacaoNegativa ? (
                <PagamentoCaixaFields
                  modo="entrada"
                  pix={pagamento.valor_pix}
                  dinheiro={pagamento.valor_dinheiro}
                  pixDoCaixa={pagamento.recebimento_pix_do_caixa}
                  dinheiroDoCaixa={pagamento.recebimento_dinheiro_do_caixa}
                  pixLabel="Pix recebido (R$)"
                  dinheiroLabel="Dinheiro recebido (R$)"
                  onPixChange={(v) => setPagamento((p) => ({ ...p, valor_pix: v }))}
                  onDinheiroChange={(v) => setPagamento((p) => ({ ...p, valor_dinheiro: v }))}
                  onPixDoCaixaChange={(checked) =>
                    setPagamento((p) => ({ ...p, recebimento_pix_do_caixa: checked }))
                  }
                  onDinheiroDoCaixaChange={(checked) =>
                    setPagamento((p) => ({ ...p, recebimento_dinheiro_do_caixa: checked }))
                  }
                />
              ) : (
                <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 text-sm">
                  <div className="flex justify-between gap-4">
                    <span className="text-slate-300">Abatimento aplicado agora</span>
                    <span className="font-semibold tabular-nums text-emerald-400">
                      {formatCurrency(calculo.pendenciaOperacaoAbatidaReais)}
                    </span>
                  </div>
                  {calculo.pendenciaOperacaoRestanteReais > 0.009 && (
                    <p className="mt-1 text-xs text-slate-400">
                      Ainda fica pendente {formatCurrency(calculo.pendenciaOperacaoRestanteReais)} da
                      dívida antiga.
                    </p>
                  )}
                </div>
              )}
              {calculo.pendenciaOperacaoAbatidaReais > 0.009 && (
                <p className="text-xs text-green-400/90">
                  Abatido {formatCurrency(calculo.pendenciaOperacaoAbatidaReais)}
                  {calculo.pendenciaOperacaoRestanteReais > 0.009 && (
                    <>
                      {" "}
                      · ainda falta{" "}
                      <span className="text-rose-400">
                        {formatCurrency(calculo.pendenciaOperacaoRestanteReais)}
                      </span>
                    </>
                  )}
                </p>
              )}
              {!abaterPendenciaOperacaoNegativa && calculo.valorPagoReais > 0.009 && (
                <p className="text-xs text-amber-300/90">
                  Recebimento registrado sem abater a pendência anterior.
                </p>
              )}
            </div>
          )}

          {calculo && calculo.saldoNegativo && (
            <div className="glass-card p-6 space-y-4">
              <h2 className="font-semibold text-white">Quem pagou os ganhadores?</h2>
              <p className="text-xs text-slate-500">
                Prejuízo de{" "}
                <strong className="text-slate-400">
                  {formatCurrency(centesimosToReais(Math.abs(calculo.totalLucroCentavos)))}
                </strong>
                . Informe o que <strong className="text-slate-400">você adiantou</strong> (Pix ou
                dinheiro). Se abater a pendência acima, esse valor já entra descontando no acerto com
                o ponto.
              </p>

              {resumoAcertoNegativo && (
                <div className="rounded-lg border border-cyan-500/25 bg-cyan-500/5 px-4 py-4 space-y-3">
                  <div>
                    <p className="text-sm text-slate-400">Falta repor ao ponto</p>
                    <p className="text-2xl font-bold text-cyan-400 tabular-nums">
                      {formatCurrency(resumoAcertoNegativo.valorRestanteReais)}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      {resumoAcertoNegativo.valorRestanteReais <= 0.009
                        ? "Você já informou todo o valor deste acerto."
                        : "Este é o restante depois do abatimento e do valor já informado."}
                    </p>
                  </div>

                  <div className="space-y-1.5 border-t border-cyan-500/15 pt-3 text-sm">
                    <div className="flex justify-between gap-4">
                      <span className="text-slate-400">Prejuízo da visita</span>
                      <span className="font-medium tabular-nums text-slate-200">
                        {formatCurrency(resumoAcertoNegativo.prejuizoVisitaReais)}
                      </span>
                    </div>
                    {resumoAcertoNegativo.abatidoPendenciaReais > 0.009 && (
                      <div className="flex justify-between gap-4">
                        <span className="text-slate-400">Abatido da pendência</span>
                        <span className="font-medium tabular-nums text-green-400">
                          - {formatCurrency(resumoAcertoNegativo.abatidoPendenciaReais)}
                        </span>
                      </div>
                    )}
                    {resumoAcertoNegativo.valorInformadoReais > 0.009 && (
                      <div className="flex justify-between gap-4">
                        <span className="text-slate-400">Já informado por você</span>
                        <span className="font-medium tabular-nums text-cyan-400">
                          - {formatCurrency(resumoAcertoNegativo.valorInformadoReais)}
                        </span>
                      </div>
                    )}
                    {resumoAcertoNegativo.negativoARecuperarReais > 0.009 && (
                      <div className="flex justify-between gap-4 border-t border-cyan-500/15 pt-2">
                        <span className="font-medium text-amber-300">Negativo a recuperar</span>
                        <span className="font-bold tabular-nums text-amber-400">
                          {formatCurrency(resumoAcertoNegativo.negativoARecuperarReais)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <PagamentoCaixaFields
                modo="saida"
                pix={pagamento.adiantamento_pix}
                dinheiro={pagamento.adiantamento_dinheiro}
                pixDoCaixa={pagamento.adiantamento_pix_do_caixa}
                dinheiroDoCaixa={pagamento.adiantamento_dinheiro_do_caixa}
                pixLabel="Pix que você deixou (R$)"
                dinheiroLabel="Dinheiro que você deixou (R$)"
                onPixChange={(v) => setPagamento((p) => ({ ...p, adiantamento_pix: v }))}
                onDinheiroChange={(v) => setPagamento((p) => ({ ...p, adiantamento_dinheiro: v }))}
                onPixDoCaixaChange={(checked) =>
                  setPagamento((p) => ({ ...p, adiantamento_pix_do_caixa: checked }))
                }
                onDinheiroDoCaixaChange={(checked) =>
                  setPagamento((p) => ({ ...p, adiantamento_dinheiro_do_caixa: checked }))
                }
              />

              {calculo.haverTotalReais > 0.009 &&
                Math.max(
                  0,
                  centesimosToReais(Math.abs(calculo.totalLucroCentavos)) -
                    (parseMoneyInput(pagamento.adiantamento_pix) +
                      parseMoneyInput(pagamento.adiantamento_dinheiro))
                ) > 0.009 && (
                  <label
                    htmlFor="incluir-usar-haver-negativo"
                    className={`flex cursor-pointer gap-3 rounded-lg border p-4 transition-colors ${
                      incluirUsarHaverNegativo
                        ? "border-cyan-500/35 bg-cyan-500/5"
                        : "border-slate-700/60 bg-slate-900/30 hover:border-slate-600"
                    }`}
                  >
                    <input
                      type="checkbox"
                      id="incluir-usar-haver-negativo"
                      checked={incluirUsarHaverNegativo}
                      onChange={(e) => setIncluirUsarHaverNegativo(e.target.checked)}
                      className="mt-0.5"
                    />
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                        <span className="flex items-center gap-2 text-sm font-medium text-white">
                          <HandCoins className="h-4 w-4 shrink-0 text-cyan-400" />
                          Usar haver do ponto no prejuízo
                        </span>
                        <span className="text-sm font-semibold tabular-nums text-cyan-400">
                          {formatCurrency(calculo.haverTotalReais)} em aberto
                        </span>
                      </div>
                      <p className="text-xs leading-relaxed text-slate-400">
                        Abate do haver existente antes de gerar haver novo — evita crédito
                        duplicado.
                      </p>
                    </div>
                  </label>
                )}

              <FormTextarea
                label="Observação"
                value={pagamento.observacao}
                onChange={(e) => setPagamento((p) => ({ ...p, observacao: e.target.value }))}
              />
            </div>
          )}

          {calculo && !calculo.saldoNegativo && !modoQuitarHaver && (
            <div className="glass-card p-6 space-y-4">
              <h2 className="font-semibold text-white">Pagamento do cliente</h2>
              <p className="text-xs text-slate-500">
                Registre quanto o <strong className="text-slate-400">cliente</strong> pagou nesta
                coleta (Pix + dinheiro). O valor a receber já está calculado no card abaixo.
              </p>

              <CobrancaClienteResumo calculo={calculo} />

              {calculo.pendenciaOperacaoTotalReais > 0.009 && (
                <label
                  htmlFor="incluir-pendencia-operacao"
                  className={`flex cursor-pointer gap-3 rounded-lg border p-4 transition-colors ${
                    incluirPendenciaOperacao
                      ? "border-primary-neon/35 bg-primary-neon/5"
                      : "border-slate-700/60 bg-slate-900/30 hover:border-slate-600"
                  }`}
                >
                  <input
                    type="checkbox"
                    id="incluir-pendencia-operacao"
                    checked={incluirPendenciaOperacao}
                    onChange={(e) => setIncluirPendenciaOperacao(e.target.checked)}
                    className="mt-0.5"
                  />
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                      <span className="flex items-center gap-2 text-sm font-medium text-white">
                        <Clock className="h-4 w-4 shrink-0 text-amber-400" />
                        Incluir pendência nesta cobrança
                      </span>
                      <span className="text-sm font-semibold tabular-nums text-amber-400">
                        {formatCurrency(calculo.pendenciaOperacaoTotalReais)}
                      </span>
                    </div>
                    <p className="text-xs leading-relaxed text-slate-400">
                      Soma ao total a cobrar desta visita. Se não marcar, o excedente do pagamento
                      ainda abate essa pendência automaticamente.
                    </p>
                  </div>
                </label>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                {calculo.debitoTotalReais <= 0.009 && calculo.haverTotalReais <= 0.009 && (
                  <FormInput
                    label="Desconto no lucro (R$)"
                    inputMode="decimal"
                    value={pagamento.desconto_manual}
                    onChange={(e) =>
                      setPagamento((p) => ({
                        ...p,
                        desconto_manual: formatMoneyInput(e.target.value),
                      }))
                    }
                    onBlur={(e) =>
                      setPagamento((p) => ({
                        ...p,
                        desconto_manual: formatMoneyInputOnBlur(e.target.value),
                      }))
                    }
                    hint="Abate do lucro antes de calcular a comissão"
                  />
                )}
                <FormInput
                  label="Desconto na operação (R$)"
                  inputMode="decimal"
                  value={pagamento.desconto_recebimento}
                  onChange={(e) =>
                    setPagamento((p) => ({
                      ...p,
                      desconto_recebimento: formatMoneyInput(e.target.value),
                    }))
                  }
                  onBlur={(e) =>
                    setPagamento((p) => ({
                      ...p,
                      desconto_recebimento: formatMoneyInputOnBlur(e.target.value),
                    }))
                  }
                  hint="Abate do valor da operação (depois da comissão)"
                />
              </div>

              <PagamentoCaixaFields
                modo="entrada"
                pix={pagamento.valor_pix}
                dinheiro={pagamento.valor_dinheiro}
                pixDoCaixa={pagamento.recebimento_pix_do_caixa}
                dinheiroDoCaixa={pagamento.recebimento_dinheiro_do_caixa}
                pixLabel="Quanto recebeu (Pix)"
                dinheiroLabel="Quanto recebeu (dinheiro)"
                onPixChange={(v) => setPagamento((p) => ({ ...p, valor_pix: v }))}
                onDinheiroChange={(v) => setPagamento((p) => ({ ...p, valor_dinheiro: v }))}
                onPixDoCaixaChange={(checked) =>
                  setPagamento((p) => ({ ...p, recebimento_pix_do_caixa: checked }))
                }
                onDinheiroDoCaixaChange={(checked) =>
                  setPagamento((p) => ({ ...p, recebimento_dinheiro_do_caixa: checked }))
                }
              />
              {calculo.pendenciaOperacaoAbatidaReais > 0.009 &&
                !incluirPendenciaOperacao &&
                calculo.pendenciaOperacaoIncluidaReais <= 0.009 && (
                  <p className="text-sm text-green-400">
                    Excedente abateu pendência anterior:{" "}
                    {formatCurrency(calculo.pendenciaOperacaoAbatidaReais)}
                  </p>
                )}
              {calculo.haverReais > 0.009 && (
                <p className="text-sm text-cyan-400">
                  Cliente pagou a mais: {formatCurrency(calculo.haverReais)} → crédito (haver)
                </p>
              )}
              <FormTextarea
                label="Observação"
                value={pagamento.observacao}
                onChange={(e) => setPagamento((p) => ({ ...p, observacao: e.target.value }))}
              />
            </div>
          )}

          {calculo && !calculo.saldoNegativo && modoQuitarHaver && (
            <div className="glass-card p-6 space-y-4 border border-cyan-500/20">
              <h2 className="font-semibold text-white">Quitar haver com o ponto</h2>
              <p className="text-xs text-slate-500">
                O lucro não cobriu o haver — <strong className="text-slate-400">você</strong> devolve
                ao ponto. Informe Pix ou dinheiro que você pagou.
              </p>
              <div className="rounded-lg border border-cyan-500/25 bg-cyan-500/5 px-4 py-3">
                <p className="text-sm text-slate-400">Total a pagar ao ponto</p>
                <p className="text-xl font-bold text-cyan-400 tabular-nums">
                  {formatCurrency(resumoTotalVisita(calculo).valorReais)}
                </p>
                {calculo.haverRestanteReais > 0.009 && (
                  <p className="text-xs text-slate-500 mt-1">
                    Restante: {formatCurrency(calculo.haverRestanteReais)}
                  </p>
                )}
              </div>
              <PagamentoCaixaFields
                modo="saida"
                pix={pagamento.valor_pix}
                dinheiro={pagamento.valor_dinheiro}
                pixDoCaixa={pagamento.adiantamento_pix_do_caixa}
                dinheiroDoCaixa={pagamento.adiantamento_dinheiro_do_caixa}
                pixLabel="Pix que você pagou (R$)"
                dinheiroLabel="Dinheiro que você pagou (R$)"
                onPixChange={(v) => setPagamento((p) => ({ ...p, valor_pix: v }))}
                onDinheiroChange={(v) => setPagamento((p) => ({ ...p, valor_dinheiro: v }))}
                onPixDoCaixaChange={(checked) =>
                  setPagamento((p) => ({ ...p, adiantamento_pix_do_caixa: checked }))
                }
                onDinheiroDoCaixaChange={(checked) =>
                  setPagamento((p) => ({ ...p, adiantamento_dinheiro_do_caixa: checked }))
                }
              />

              {resumoAcertoNegativo && resumoAcertoNegativo.saldoLiquidoAbsReais > 0.009 && (
                <div
                  className={cn(
                    "rounded-lg border px-4 py-3 space-y-1.5 text-sm",
                    calculo.saldoLiquidoReais > 0
                      ? "border-green-500/30 bg-green-500/5"
                      : "border-amber-500/30 bg-amber-500/5"
                  )}
                >
                  <div className="flex justify-between gap-4">
                    <span
                      className={cn(
                        "font-medium",
                        calculo.saldoLiquidoReais > 0 ? "text-green-300" : "text-amber-300"
                      )}
                    >
                      {resumoAcertoNegativo.saldoLabel}
                    </span>
                    <span
                      className={cn(
                        "text-lg font-bold tabular-nums",
                        calculo.saldoLiquidoReais > 0 ? "text-green-400" : "text-amber-400"
                      )}
                    >
                      {formatCurrency(resumoAcertoNegativo.saldoLiquidoAbsReais)}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Esse saldo ja considera o que foi abatido da pendência e o que você informou como
                    adiantamento.
                  </p>
                </div>
              )}

              <FormTextarea
                label="Observação"
                value={pagamento.observacao}
                onChange={(e) => setPagamento((p) => ({ ...p, observacao: e.target.value }))}
              />
            </div>
          )}

          {calculo && relatorioData && (
            <PreviaRelatorioPanel
              data={{ ...relatorioData, previa: true }}
              disabled={!leiturasCompletas}
            />
          )}

          {error && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || loadingPonto || leituras.length === 0}
            className="w-full rounded-lg bg-primary-neon py-3 font-semibold text-slate-900 hover:bg-cyan-300 disabled:opacity-50"
          >
            {loading ? "Enviando fotos e registrando..." : "Registrar coleta"}
          </button>
        </form>
      </div>

      {sucesso && ponto && (
        <ColetaCassinoSucessoModal
          open
          data={sucesso.relatorioData}
          visitaId={sucesso.visitaId}
          empresaId={sucesso.empresaId}
          pontoId={pontoId}
          onClose={handleConcluir}
        />
      )}

      <LoadingOverlay
        show={loading}
        messages={[
          "Enviando fotos das máquinas...",
          "Calculando a visita...",
          "Registrando coleta...",
          "Quase lá...",
        ]}
      />
    </>
  );
}

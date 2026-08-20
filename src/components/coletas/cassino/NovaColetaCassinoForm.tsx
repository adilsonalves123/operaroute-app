"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, Loader2, Clock, HandCoins } from "lucide-react";
import { FormInput } from "@/components/ui/FormInput";
import { ColetaPontoSearchSelect } from "@/components/coletas/ColetaPontoSearchSelect";
import {
  MaquinaColetaCard,
  leituraToInput,
  leiturasToCalculoInput,
  leituraEstaPronta,
  useLeituraUpdater,
  useFotoUpdater,
  useIaLeituraHandlers,
} from "@/components/coletas/cassino/MaquinaColetaCard";
import {
  buildCorrecaoHumana,
  correcaoIndicaManual,
} from "@/lib/nichos/cassino/correcao-humana";
import { PreviaRelatorioPanel } from "@/components/coletas/cassino/PreviaRelatorioPanel";
import { ResumoOperacaoNegativaView } from "@/components/coletas/cassino/ResumoOperacaoNegativaView";
import { CobrancaClienteResumo } from "@/components/coletas/cassino/CobrancaClienteResumo";
import { PagamentoCaixaFields } from "@/components/coletas/cassino/PagamentoCaixaFields";
import { ColetaStatusFaixa } from "@/components/coletas/ColetaHaverPendenciaPanel";
import { ColetaCassinoSucessoModal } from "@/components/coletas/cassino/ColetaCassinoSucessoModal";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";
import {
  ColetaNovaPageShell,
  ColetaNovaGrid,
  ColetaPontoBar,
  ColetaOperacaoSection,
  FecharColetaPanel,
} from "@/components/coletas/layout";
import {
  VisitaColetaModoPagamento,
  type VisitaColetaModoFechar,
} from "@/components/visitas-ponto/VisitaColetaModoPagamento";
import { useSubmitLock } from "@/hooks/use-submit-lock";
import { calcularVisitaCassino, centesimosToReais, formatContador, parseComissaoPercentual, baseComissaoReais, comissaoBloqueada } from "@/lib/nichos/cassino";
import {
  temErrosLeitura,
  validarLeiturasMaquina,
  type ErrosLeituraMaquina,
} from "@/lib/nichos/cassino/calculo-maquina";
import {
  saldoPendenciaReais,
  saldoHaverReais,
  isHaverDeNegativoCliente,
  isHaverCreditoComum,
} from "@/lib/nichos/cassino/pendencias";
import type { RelatorioColetaData } from "@/lib/nichos/cassino/relatorio";
import { uploadFotosMaquinasParalelo } from "@/lib/storage/coleta-fotos";
import { createClient } from "@/lib/supabase/client";
import { getEmpresaIdForUser } from "@/lib/supabase/empresa";
import {
  clearCassinoLeiturasDraft,
  loadCassinoLeiturasDraft,
  saveCassinoLeiturasDraft,
} from "@/lib/visitas-ponto/cassino-leitura-draft";
import {
  cn,
  formatCurrency,
  formatMoneyInput,
  formatMoneyInputOnBlur,
  parseMoneyInput,
} from "@/lib/utils";
import type { Equipamento, Ponto } from "@/lib/types/database";
import { getComissaoPercentualNicho } from "@/lib/pontos/comissao-nicho";
import { useVisitaPontoContext } from "@/components/visitas-ponto/useVisitaPontoContext";
import { VisitaPontoNav } from "@/components/visitas-ponto/VisitaPontoNav";

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
  /** Receber agora já fechou a visita ao ponto — ao sair, não vai pra tela Cobrar. */
  visitaJaFinalizada?: boolean;
}

type LeituraState = ReturnType<typeof leituraToInput>;

/** Evita zerar entrada/saída/foto se o operador já digitou enquanto um reload assíncrono rodava. */
function mesclarLeiturasPreservandoDigitacao(
  next: LeituraState[],
  prev: LeituraState[]
): LeituraState[] {
  if (prev.length === 0) return next;
  const prevById = new Map(prev.map((l) => [l.equipamentoId, l]));
  return next.map((l) => {
    const p = prevById.get(l.equipamentoId);
    if (!p) return l;
    const keepEntrada = Boolean(p.entradaAtualInput?.trim());
    const keepSaida = Boolean(p.saidaAtualInput?.trim());
    const keepFoto = Boolean(p.fotoFile || p.fotoPreview);
    return {
      ...l,
      entradaAtualInput: keepEntrada ? p.entradaAtualInput : l.entradaAtualInput,
      saidaAtualInput: keepSaida ? p.saidaAtualInput : l.saidaAtualInput,
      fotoFile: keepFoto ? p.fotoFile : l.fotoFile,
      fotoPreview: keepFoto ? p.fotoPreview : l.fotoPreview,
    };
  });
}

function moneyFieldFromReais(value: number | null | undefined): string {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n) || Math.abs(n) < 0.005) return "";
  return formatMoneyInputOnBlur(n.toFixed(2).replace(".", ","));
}

export function NovaColetaCassinoForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pontoInicial = searchParams.get("ponto") ?? "";
  const editarVisitaUrl = searchParams.get("editar_visita")?.trim() ?? "";
  const [pontoId, setPontoId] = useState(pontoInicial);
  const {
    visitaPontoId,
    emVisitaPonto,
    ensuringVisita,
    voltarAposColeta,
    finalizarVisitaAgora,
    confirmarReceberEncerrar,
    decisaoDialogEl,
  } =
    useVisitaPontoContext(pontoId);

  const [loading, setLoading] = useState(false);
  const submitLock = useSubmitLock();
  const [loadingPonto, setLoadingPonto] = useState(false);
  const [error, setError] = useState("");
  const [empresaId, setEmpresaId] = useState<string | null>(null);
  const [empresaNome, setEmpresaNome] = useState("Operação");
  const [chavePix, setChavePix] = useState<string | null>(null);
  const [pontos, setPontos] = useState<Ponto[]>([]);
  const [ponto, setPonto] = useState<Ponto | null>(null);
  const [leituras, setLeituras] = useState<ReturnType<typeof leituraToInput>[]>([]);
  /** Visita cassino já salva no rascunho — reabrir/corrigir (DELETE+POST). */
  const [editarVisitaId, setEditarVisitaId] = useState<string | null>(
    editarVisitaUrl || null
  );
  /** Corrige coleta ligada a visita ao ponto já finalizada (religar slot + pagamento no ato). */
  const [editandoVisitaFinalizada, setEditandoVisitaFinalizada] = useState(false);
  const [pendencias, setPendencias] = useState<PendenciaNegativa[]>([]);
  const [havers, setHavers] = useState<PendenciaNegativa[]>([]);
  const [pendenciasOperacao, setPendenciasOperacao] = useState<PendenciaNegativa[]>([]);
  const [incluirPendenciaOperacao, setIncluirPendenciaOperacao] = useState(false);
  const [abaterPendenciaOperacaoNegativa, setAbaterPendenciaOperacaoNegativa] = useState(true);
  const [descontarHaverNaCobranca, setDescontarHaverNaCobranca] = useState(false);
  /** Operador paga em dinheiro/Pix o haver (ou o que restar após descontar na cobrança). */
  const [pagarHaverRestante, setPagarHaverRestante] = useState(false);
  /** Saldo real do caixa (entradas − saídas) — saídas não podem zerar abaixo disso. */
  const [saldoCaixa, setSaldoCaixa] = useState<number | null>(null);
  /** Abater tipo=negativo anterior em visita positiva (default = config do ponto). */
  const [abaterNegativoAnterior, setAbaterNegativoAnterior] = useState(true);
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
  const [modoFecharVisita, setModoFecharVisita] =
    useState<VisitaColetaModoFechar>("continuar");
  /** Em correção de visita já finalizada, cobrança entra na própria coleta (não no checkout). */
  const emVisitaPontoAtiva = emVisitaPonto && !editandoVisitaFinalizada;
  const receberAgora =
    (emVisitaPontoAtiva && modoFecharVisita === "receber") ||
    (editandoVisitaFinalizada && modoFecharVisita !== "finalizar");
  const finalizarVisitaSemPagar = emVisitaPontoAtiva && modoFecharVisita === "finalizar";
  /** Fecha no submit: finalizar negativa sempre; receber depende da escolha do diálogo. */

  const updateLeitura = useLeituraUpdater(setLeituras);
  const updateFoto = useFotoUpdater(setLeituras);
  const { onIaSugestao, onConfirmarIa, onExcecaoContador, onIaErro } =
    useIaLeituraHandlers(setLeituras);
  /** Evita reaplicar edição/rascunho e apagar o que o operador está digitando. */
  const contextoVisitaAplicadoRef = useRef("");

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
      if (exigeFoto && !l.fotoFile && !l.fotoPreview) {
        errosFotoMap.set(l.equipamentoId, "Foto obrigatória");
      }
      if (exigirPreenchimento && l.iaPendenteConfirmacao) {
        errosFotoMap.set(
          l.equipamentoId,
          errosFotoMap.get(l.equipamentoId) ??
            "Confirme a leitura da IA nesta máquina"
        );
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
        supabase.from("empresas").select("nome_operacao, chave_pix").eq("id", eid).maybeSingle(),
      ]);

      setPontos(pontosData ?? []);
      if (empresa?.nome_operacao) setEmpresaNome(empresa.nome_operacao);
      setChavePix(empresa?.chave_pix ?? null);
    }
    loadPontos();
  }, []);

  useEffect(() => {
    if (!empresaId) {
      setSaldoCaixa(null);
      return;
    }
    let cancelled = false;
    async function loadSaldo() {
      const supabase = createClient();
      const { fetchSaldoCaixa } = await import("@/lib/financeiro/saldo-caixa");
      const saldo = await fetchSaldoCaixa(supabase, empresaId!);
      if (!cancelled) setSaldoCaixa(saldo);
    }
    void loadSaldo();
    return () => {
      cancelled = true;
    };
  }, [empresaId, sucesso]);

  useEffect(() => {
    contextoVisitaAplicadoRef.current = "";
    if (!pontoId) {
      setPonto(null);
      setLeituras([]);
      setPendencias([]);
      setHavers([]);
      setPendenciasOperacao([]);
      setIncluirPendenciaOperacao(false);
      setAbaterPendenciaOperacaoNegativa(true);
      setDescontarHaverNaCobranca(false);
      setPagarHaverRestante(false);
      setComissaoVisita("");
      setValidacaoVisivel(false);
      setEditarVisitaId(null);
      return;
    }

    let cancelled = false;

    async function loadPontoData() {
      setLoadingPonto(true);
      setError("");
      setEditarVisitaId(null);

      const supabase = createClient();
      const eid = empresaId ?? (await getEmpresaIdForUser(supabase));
      if (eid) {
        try {
          const { reconciliarPendenciasCobraveisPonto } = await import(
            "@/lib/visitas-ponto/reconciliar-pendencias-ponto"
          );
          await reconciliarPendenciasCobraveisPonto(supabase, {
            empresaId: eid,
            pontoId,
          });
        } catch {
          /* não bloqueia a coleta se a limpeza falhar */
        }
      }

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
            .in("tipo", ["pagamento_pendente", "parcial", "visita_consolidada"]),
        ]);

      if (cancelled) return;

      setPonto(pontoData);
      setComissaoVisita(String(getComissaoPercentualNicho(pontoData, "maquinas_cassino")));
      setPendencias(pendenciasData ?? []);
      setHavers(haverData ?? []);
      setPendenciasOperacao(operacaoData ?? []);
      setIncluirPendenciaOperacao(false);
      setAbaterPendenciaOperacaoNegativa(true);
      setDescontarHaverNaCobranca(false);
      setPagarHaverRestante(false);
      setAbaterNegativoAnterior(pontoData?.abater_automatico !== false);

      const cassinos = (equipamentos ?? []).filter((e: Equipamento) => e.tipo === "cassino");
      const nextLeituras = cassinos.map(leituraToInput);
      // Preserva digitação se o operador começou a preencher antes do fetch terminar
      setLeituras((prev) => mesclarLeiturasPreservandoDigitacao(nextLeituras, prev));
      setLoadingPonto(false);

      if (!pontoData) setError("Ponto não encontrado.");
      else if (cassinos.length === 0) setError("Este ponto não tem máquinas cassino cadastradas.");
    }

    loadPontoData();
    return () => {
      cancelled = true;
    };
  }, [pontoId]);

  // Aplica edição salva / rascunho quando a visita entra na URL — sem recarregar as máquinas
  useEffect(() => {
    if (!pontoId || loadingPonto || leituras.length === 0) return;
    if (!visitaPontoId && !editarVisitaUrl) return;

    const applyKey = `${pontoId}|${visitaPontoId}|${editarVisitaUrl}`;
    if (contextoVisitaAplicadoRef.current === applyKey) return;

    let cancelled = false;

    async function aplicarContextoVisita() {
      const supabase = createClient();
      let visitaParaEditar = editarVisitaUrl || null;
      let visitaPontoFinalizada = false;

      if (visitaPontoId) {
        try {
          const res = await fetch(`/api/visitas-ponto/${visitaPontoId}`, {
            credentials: "include",
          });
          const data = await res.json().catch(() => ({}));
          if (cancelled) return;
          if (res.ok) {
            const statusVisita = String(
              (data.resumo as { status?: string } | undefined)?.status ?? ""
            ).toLowerCase();
            const encerrada =
              statusVisita === "finalizada" || statusVisita === "cancelada";

            if (encerrada && !editarVisitaUrl) {
              // Encerrada sem pedido explícito de edição: não reabre sozinho
              // (pendências já baixadas + leituras antigas bagunçavam o cálculo).
              visitaParaEditar = null;
            } else if (encerrada && editarVisitaUrl) {
              if (statusVisita === "cancelada") {
                visitaParaEditar = null;
                const params = new URLSearchParams(searchParams.toString());
                params.delete("editar_visita");
                params.set("ponto", pontoId);
                router.replace(`/coletas/nova/cassino?${params.toString()}`);
              } else {
                visitaPontoFinalizada = true;
                visitaParaEditar = editarVisitaUrl;
              }
            } else if (!visitaParaEditar) {
              const fromItens = (data.itens as { cassino_visita_id?: string | null }[] | undefined)
                ?.map((i) => i.cassino_visita_id)
                .find((id): id is string => Boolean(id));
              const fromNeg = data.resumo?.cassinoNegativo?.visitaId as string | undefined;
              const fromNicho = (
                data.resumo?.nichos as { nicho: string; itemIds?: string[] }[] | undefined
              )?.find((n) => n.nicho === "cassino")?.itemIds?.[0];
              visitaParaEditar = fromItens || fromNeg || fromNicho || null;
            }
          }
        } catch {
          /* segue sem edição */
        }
      }

      if (cancelled) return;

      if (visitaParaEditar) {
        const [{ data: coletasEdit }, { data: visitaEdit }] = await Promise.all([
          supabase
            .from("coletas")
            .select(
              "equipamento_id, entrada_anterior, saida_anterior, entrada_atual, saida_atual, foto_url"
            )
            .eq("visita_id", visitaParaEditar),
          supabase
            .from("visitas")
            .select(
              "desconto, desconto_recebimento, valor_pix, valor_dinheiro, adiantamento_pix, adiantamento_dinheiro, adiantamento_pix_do_caixa, adiantamento_dinheiro_do_caixa, recebimento_pix_do_caixa, recebimento_dinheiro_do_caixa, observacao, saldo_negativo"
            )
            .eq("id", visitaParaEditar)
            .maybeSingle(),
        ]);

        if (cancelled) return;

        if (coletasEdit?.length) {
          // Garante visita_ponto na URL para religar após DELETE (mesmo se veio só do detalhe).
          let visitaPontoParaReligar = visitaPontoId;
          if (!visitaPontoParaReligar) {
            const { data: itemLink } = await supabase
              .from("visita_ponto_itens")
              .select("visita_ponto_id")
              .eq("cassino_visita_id", visitaParaEditar)
              .limit(1)
              .maybeSingle();
            visitaPontoParaReligar = itemLink?.visita_ponto_id ?? "";
            if (visitaPontoParaReligar) {
              const { data: vp } = await supabase
                .from("visitas_ponto")
                .select("status")
                .eq("id", visitaPontoParaReligar)
                .maybeSingle();
              const st = String(vp?.status ?? "").toLowerCase();
              if (st === "finalizada") {
                visitaPontoFinalizada = true;
              }
              contextoVisitaAplicadoRef.current = `${pontoId}|${visitaPontoParaReligar}|${visitaParaEditar}`;
              const params = new URLSearchParams(searchParams.toString());
              params.set("editar_visita", visitaParaEditar);
              params.set("ponto", pontoId);
              params.set("visita_ponto", visitaPontoParaReligar);
              router.replace(`/coletas/nova/cassino?${params.toString()}`);
            }
          }

          const byEq = new Map(
            coletasEdit
              .filter((c) => c.equipamento_id)
              .map((c) => [c.equipamento_id as string, c])
          );
          setLeituras((prev) =>
            mesclarLeiturasPreservandoDigitacao(
              prev.map((l) => {
                const c = byEq.get(l.equipamentoId);
                if (!c) return l;
                const foto = c.foto_url?.trim() || null;
                return {
                  ...l,
                  entradaAnterior: Math.round(Number(c.entrada_anterior ?? l.entradaAnterior)),
                  saidaAnterior: Math.round(Number(c.saida_anterior ?? l.saidaAnterior)),
                  // null no banco ≠ "0,00" — não apaga o que o operador está digitando
                  entradaAtualInput:
                    c.entrada_atual != null
                      ? formatContador(Number(c.entrada_atual))
                      : l.entradaAtualInput,
                  saidaAtualInput:
                    c.saida_atual != null
                      ? formatContador(Number(c.saida_atual))
                      : l.saidaAtualInput,
                  fotoPreview: foto || l.fotoPreview,
                  fotoFile: foto ? null : l.fotoFile,
                };
              }),
              prev
            )
          );

          if (visitaEdit) {
            const descontoManual = Number(visitaEdit.desconto ?? 0);
            const descontoReceb = Number(visitaEdit.desconto_recebimento ?? 0);
            const adiantPix = Number(visitaEdit.adiantamento_pix ?? 0);
            const adiantDin = Number(visitaEdit.adiantamento_dinheiro ?? 0);
            const temAdiantamento = adiantPix + adiantDin > 0.009;
            setPagamento((p) => ({
              ...p,
              desconto_manual: temAdiantamento
                ? ""
                : moneyFieldFromReais(descontoManual),
              desconto_recebimento: moneyFieldFromReais(descontoReceb),
              valor_pix: moneyFieldFromReais(visitaEdit.valor_pix),
              valor_dinheiro: moneyFieldFromReais(visitaEdit.valor_dinheiro),
              adiantamento_pix: moneyFieldFromReais(visitaEdit.adiantamento_pix),
              adiantamento_dinheiro: moneyFieldFromReais(visitaEdit.adiantamento_dinheiro),
              adiantamento_pix_do_caixa: Boolean(visitaEdit.adiantamento_pix_do_caixa),
              adiantamento_dinheiro_do_caixa: Boolean(
                visitaEdit.adiantamento_dinheiro_do_caixa
              ),
              recebimento_pix_do_caixa: Boolean(visitaEdit.recebimento_pix_do_caixa),
              recebimento_dinheiro_do_caixa: Boolean(
                visitaEdit.recebimento_dinheiro_do_caixa
              ),
              observacao: String(visitaEdit.observacao ?? ""),
            }));
            if (visitaPontoFinalizada) {
              setModoFecharVisita(
                visitaEdit.saldo_negativo ? "finalizar" : "receber"
              );
            }
          }

          setEditandoVisitaFinalizada(visitaPontoFinalizada);
          setEditarVisitaId(visitaParaEditar);
          // Marca a chave atual e a que o router.replace vai gerar, para não reaplicar
          contextoVisitaAplicadoRef.current = applyKey;
          if (visitaPontoId) {
            contextoVisitaAplicadoRef.current = `${pontoId}|${visitaPontoId}|${visitaParaEditar}`;
          }
          if (visitaPontoId && !editarVisitaUrl) {
            const params = new URLSearchParams(searchParams.toString());
            params.set("editar_visita", visitaParaEditar);
            params.set("ponto", pontoId);
            params.set("visita_ponto", visitaPontoId);
            router.replace(`/coletas/nova/cassino?${params.toString()}`);
          }
          return;
        }
      }

      setEditarVisitaId(null);
      setEditandoVisitaFinalizada(false);
      const draft =
        visitaPontoId && pontoId
          ? loadCassinoLeiturasDraft(visitaPontoId, pontoId)
          : null;
      if (draft?.length) {
        const byEq = new Map(draft.map((d) => [d.equipamentoId, d]));
        setLeituras((prev) =>
          prev.map((l) => {
            const d = byEq.get(l.equipamentoId);
            if (!d) return l;
            return {
              ...l,
              entradaAtualInput: l.entradaAtualInput || d.entradaAtualInput || "",
              saidaAtualInput: l.saidaAtualInput || d.saidaAtualInput || "",
              fotoPreview: l.fotoPreview || d.fotoUrl || null,
            };
          })
        );
      }
      if (!cancelled) {
        contextoVisitaAplicadoRef.current = applyKey;
      }
    }

    void aplicarContextoVisita();
    return () => {
      cancelled = true;
    };
    // leituras.length: só espera as máquinas existirem; não reaplicar a cada tecla
    // eslint-disable-next-line react-hooks/exhaustive-deps -- applyKey cobre visita/edição
  }, [pontoId, visitaPontoId, editarVisitaUrl, loadingPonto, leituras.length]);

  useEffect(() => {
    if (!visitaPontoId || !pontoId || editarVisitaId || loadingPonto) return;
    saveCassinoLeiturasDraft(
      visitaPontoId,
      pontoId,
      leituras.map((l) => ({
        equipamentoId: l.equipamentoId,
        entradaAtualInput: l.entradaAtualInput,
        saidaAtualInput: l.saidaAtualInput,
        fotoUrl:
          l.fotoPreview && /^https?:\/\//i.test(l.fotoPreview) ? l.fotoPreview : null,
      }))
    );
  }, [leituras, visitaPontoId, pontoId, editarVisitaId, loadingPonto]);

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
      descricao: p.descricao,
      titulo: p.titulo,
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

    const calcInputBase = {
      leituras: input,
      pendenciasNegativas,
      pendenciasHaver,
      pendenciasOperacao: pendenciasOperacaoMapped,
      incluirPendenciasOperacao: incluirPendenciaOperacao,
      abaterPendenciaOperacaoNegativa,
      incluirUsarHaverNegativo: false, // Negativo nunca consome haver — haver só abate em visita positiva.
      descontarHaverNaCobranca,
      comissaoPercentual,
      descontoRecebimentoReais: parseMoneyInput(pagamento.desconto_recebimento),
      abaterAutomatico: abaterNegativoAnterior,
    };

    try {
      const calcProbe = calcularVisitaCassino({
        ...calcInputBase,
        descontoManualReais: 0,
        descontoRecebimentoReais: 0,
        valorPixReais: 0,
        valorDinheiroReais: 0,
      });

      const temHaverProbe = pendenciasHaver.some((p) => p.valor > 0.009);
      const descontoManualReais = calcProbe.saldoNegativo
        ? adiantamentoTotal
        : temHaverProbe && pagarHaverRestante
          ? adiantamentoTotal
          : descontoManualInput;

      return calcularVisitaCassino({
        ...calcInputBase,
        descontoManualReais,
        valorPixReais: valorPix,
        valorDinheiroReais: valorDinheiro,
      });
    } catch {
      return null;
    }
  }, [leituras, pendencias, havers, pendenciasOperacao, incluirPendenciaOperacao, abaterPendenciaOperacaoNegativa, descontarHaverNaCobranca, pagarHaverRestante, abaterNegativoAnterior, ponto, pagamento, errosMaquinas, comissaoPercentual]);

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

  const descontoOperacaoExibido = calculo
    ? Math.max(0, calculo.valorOperacaoReais - calculo.valorOperacaoEfetivoReais)
    : 0;
  const resumoAcertoNegativo = useMemo(() => {
    if (!calculo || !calculo.saldoNegativo) return null;

    const prejuizoVisitaReais = centesimosToReais(Math.abs(calculo.totalLucroCentavos));
    const abatidoPendenciaReais = calculo.pendenciaOperacaoAbatidaReais;
    const valorBaseAcertoReais = Math.max(0, prejuizoVisitaReais - abatidoPendenciaReais);
    const valorInformadoReais = calculo.valorDeixadoOperadorReais;
    const valorAplicadoReais = Math.min(valorInformadoReais, valorBaseAcertoReais);
    const valorRestanteReais = Math.max(0, valorBaseAcertoReais - valorAplicadoReais);
    const excedenteReais = calculo.excedenteDeixadoReais ?? 0;
    return {
      prejuizoVisitaReais,
      abatidoPendenciaReais,
      valorBaseAcertoReais,
      valorInformadoReais,
      valorRestanteReais,
      excedenteReais,
      negativoARecuperarReais: calculo.novoDebitoReais,
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

  useEffect(() => {
    if (!calculo) return;
    if (calculo.saldoNegativo && modoFecharVisita === "receber") {
      setModoFecharVisita("continuar");
    } else if (!calculo.saldoNegativo && modoFecharVisita === "finalizar") {
      setModoFecharVisita("continuar");
    }
  }, [calculo?.saldoNegativo]); // eslint-disable-line react-hooks/exhaustive-deps -- só ao mudar sinal

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

  const haverAberto = havers.reduce(
    (s, p) =>
      s +
      saldoHaverReais({
        valor: Number(p.valor ?? 0),
        descricao: p.descricao,
      }),
    0
  );
  const haverDeNegativoAberto = havers
    .filter((p) =>
      isHaverDeNegativoCliente({ titulo: p.titulo, descricao: p.descricao })
    )
    .reduce(
      (s, p) =>
        s +
        saldoHaverReais({
          valor: Number(p.valor ?? 0),
          descricao: p.descricao,
        }),
      0
    );
  const haverCreditoAberto = havers
    .filter((p) => isHaverCreditoComum({ titulo: p.titulo, descricao: p.descricao }))
    .reduce(
      (s, p) =>
        s +
        saldoHaverReais({
          valor: Number(p.valor ?? 0),
          descricao: p.descricao,
        }),
      0
    );
  const haverRegistrado = havers.reduce((s, p) => s + Number(p.valor ?? 0), 0);
  // Só faz sentido no estilo antigo (valor bruto − Abatido). No moderno, valor já é o saldo.
  const haverCompensadoAnterior = havers.some((p) =>
    /Compensado R\$/i.test(p.descricao ?? "")
  )
    ? 0
    : Math.max(0, haverRegistrado - haverAberto);
  const haverSaldoAberto = haverAberto;

  const pendenciaOperacaoAberta = pendenciasOperacao.reduce(
    (s, p) => s + Number(p.valor ?? 0),
    0
  );
  const temPagamentoParcial = pendenciasOperacao.some(
    (p) => p.tipo?.toLowerCase() === "parcial"
  );

  const leiturasCompletas =
    leituras.length > 0 && leituras.every((l) => leituraEstaPronta(l));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // Trava síncrona: sem isso, 2 cliques no loading criam 2 visitas + 2x caixa.
    if (sucesso || submitLock.isLocked() || loading) return;

    setError("");
    setValidacaoVisivel(true);

    if (!pontoId || !empresaId || leituras.length === 0) {
      setError("Selecione um ponto com máquinas cadastradas.");
      return;
    }

    const { errosLeitura, errosFotoMap } = validarFormulario(true);

    if (
      !leituras.every((l) => leituraEstaPronta(l)) ||
      errosLeitura.size > 0 ||
      errosFotoMap.size > 0
    ) {
      scrollParaPrimeiroErro(errosLeitura, errosFotoMap);
      if (leituras.some((l) => l.iaPendenteConfirmacao)) {
        setError("Confirme a leitura da IA em todas as máquinas sugeridas.");
      }
      return;
    }

    if (!calculo || !relatorioData) {
      setError("Não foi possível calcular a visita.");
      return;
    }

    let fecharVisitaAposReceber = finalizarVisitaSemPagar;
    if (receberAgora && !editandoVisitaFinalizada) {
      const decisao = await confirmarReceberEncerrar();
      if (decisao === "abortar") return;
      fecharVisitaAposReceber = decisao === "encerrar";
    }

    if (!submitLock.tryLock()) return;
    setLoading(true);
    let concluido = false;

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

      const finalizarDireto =
        emVisitaPontoAtiva && fecharVisitaAposReceber;

      let visitaPontoParaSalvar = visitaPontoId || null;

      if (editarVisitaId) {
        const delRes = await fetch(
          `/api/visitas/cassino/${editarVisitaId}?preservar_slot=1`,
          {
            method: "DELETE",
            credentials: "include",
          }
        );
        const delData = await delRes.json().catch(() => ({}));
        if (!delRes.ok) {
          setError(delData.error ?? "Não foi possível atualizar a coleta anterior.");
          return;
        }
        const idsReligar = Array.isArray(delData.visita_ponto_ids)
          ? (delData.visita_ponto_ids as string[]).filter(Boolean)
          : [];
        if (!visitaPontoParaSalvar && idsReligar[0]) {
          visitaPontoParaSalvar = idsReligar[0];
        }
      }

      const res = await fetch("/api/visitas/cassino", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          ponto_id: pontoId,
          leituras: leituras.map((l) => {
            const correcao =
              l.iaReadingId
                ? buildCorrecaoHumana({
                    entradaSugerida: l.iaSugestaoEntrada ?? null,
                    saidaSugerida: l.iaSugestaoSaida ?? null,
                    entradaFinal: l.entradaAtualInput,
                    saidaFinal: l.saidaAtualInput,
                    alternativas: l.iaAlternativas,
                    revisaoObrigatoria: l.iaRevisaoObrigatoria,
                    score: l.iaScore,
                    statusIa: l.iaStatus,
                    flags: l.iaFlags,
                    excecaoContador: l.iaExcecaoContador ?? null,
                  })
                : null;
            const manual =
              Boolean(l.iaFoiCorrigidaManualmente) || correcaoIndicaManual(correcao);
            return {
              equipamento_id: l.equipamentoId,
              entrada_atual: l.entradaAtualInput.replace(/\D/g, ""),
              saida_atual: l.saidaAtualInput.replace(/\D/g, ""),
              ia_reading_id: l.iaReadingId ?? null,
              ia_status_final: l.iaReadingId ? (manual ? "approved_manual" : "approved_ai") : null,
              ia_excecao_contador: l.iaExcecaoContador ?? null,
              ia_correcao: correcao,
              foto_url:
                fotoUrls.get(l.equipamentoId) ??
                (l.fotoPreview && /^https?:\/\//i.test(l.fotoPreview) ? l.fotoPreview : null),
            };
          }),
          desconto_manual: pagamento.desconto_manual,
          adiantamento_pix: pagamento.adiantamento_pix,
          adiantamento_dinheiro: pagamento.adiantamento_dinheiro,
          adiantamento_pix_do_caixa: pagamento.adiantamento_pix_do_caixa,
          adiantamento_dinheiro_do_caixa: pagamento.adiantamento_dinheiro_do_caixa,
          recebimento_pix_do_caixa: recebimentoPixReais > 0.009 || pagamento.recebimento_pix_do_caixa,
          recebimento_dinheiro_do_caixa:
            recebimentoDinheiroReais > 0.009 || pagamento.recebimento_dinheiro_do_caixa,
          desconto_recebimento: pagamento.desconto_recebimento,
          valor_pix: finalizarVisitaSemPagar ? "" : pagamento.valor_pix,
          valor_dinheiro: finalizarVisitaSemPagar ? "" : pagamento.valor_dinheiro,
          incluir_pendencia_operacao: incluirPendenciaOperacao,
          abater_pendencia_operacao_negativa: abaterPendenciaOperacaoNegativa,
          incluir_usar_haver_negativo: false,
          descontar_haver_na_cobranca: descontarHaverNaCobranca,
          // Espelha o checkbox "Abater este negativo nesta coleta"
          abater_automatico: abaterNegativoAnterior,
          comissao_percentual: comissaoPercentual,
          observacao: pagamento.observacao || null,
          latitude: gps?.latitude ?? null,
          longitude: gps?.longitude ?? null,
          visita_ponto_id: visitaPontoParaSalvar,
          religar_visita_finalizada: editandoVisitaFinalizada,
          // Receber agora: aplica pagamento na coleta e fecha.
          // Finalizar (negativo): só fecha depois, sem cobrança.
          // Continuar: defere o pagamento para o checkout.
          // Correção pós-finalização: sempre aplica pagamento na coleta.
          receber_agora: receberAgora || editandoVisitaFinalizada,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        // Já gravou na 1ª tentativa — não trata como erro fatal se veio do 2º clique.
        if (res.status === 409 && data.already_done && data.visita_id) {
          setEditarVisitaId(null);
          setSucesso({
            visitaId: data.visita_id,
            empresaId,
            relatorioData: { ...relatorioData, previa: false },
            visitaJaFinalizada: finalizarDireto,
          });
          concluido = true;
          return;
        }
        setError(data.error ?? "Erro ao registrar coleta.");
        return;
      }

      if (visitaPontoId && pontoId) {
        clearCassinoLeiturasDraft(visitaPontoId, pontoId);
      }

      if (finalizarDireto) {
        await finalizarVisitaAgora({
          pix: finalizarVisitaSemPagar ? 0 : recebimentoPixReais,
          dinheiro: finalizarVisitaSemPagar ? 0 : recebimentoDinheiroReais,
          desconto: finalizarVisitaSemPagar
            ? 0
            : parseMoneyInput(pagamento.desconto_recebimento),
          somenteFechar: true,
        });
      }

      const eraEdicaoFinalizada = editandoVisitaFinalizada;
      setEditarVisitaId(null);
      setEditandoVisitaFinalizada(false);
      setSucesso({
        visitaId: data.visita_id,
        empresaId,
        relatorioData: { ...relatorioData, previa: false },
        visitaJaFinalizada: finalizarDireto || eraEdicaoFinalizada,
      });
      concluido = true;

      // Evita F5 reabrir a coleta já salva (leituras + pendências já baixadas = números loucos).
      {
        const params = new URLSearchParams();
        if (pontoId) params.set("ponto", pontoId);
        if (visitaPontoParaSalvar && !finalizarDireto && !eraEdicaoFinalizada) {
          params.set("visita_ponto", visitaPontoParaSalvar);
        }
        router.replace(
          params.toString()
            ? `/coletas/nova/cassino?${params.toString()}`
            : "/coletas/nova/cassino"
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro de conexão. Tente novamente.");
    } finally {
      setLoading(false);
      // Sucesso: mantém travado pra não reenviar. Erro: libera novo intento.
      if (!concluido) submitLock.unlock();
    }
  }

  function handleConcluir() {
    const jaFinalizada = sucesso?.visitaJaFinalizada === true;
    setSucesso(null);
    voltarAposColeta(jaFinalizada ? { visitaJaFinalizada: true } : undefined);
  }

  return (
    <>
      <ColetaNovaPageShell
        title="Coleta cassino"
        subtitle={
          ensuringVisita
            ? "Entrando na visita do ponto…"
            : editarVisitaId
              ? editandoVisitaFinalizada
                ? "Corrigindo coleta já finalizada — máquinas, descontos e valores."
                : "Corrigindo coleta cassino já salva nesta visita."
            : calculo?.saldoNegativo
              ? "Visita negativa — Continuar (outros nichos) ou Finalizar sem cobrar."
              : emVisitaPontoAtiva
                ? "Leitura das máquinas. Depois: Continuar ou Receber."
                : "Leitura das máquinas e fechamento ao lado."
        }
        backHref={emVisitaPonto ? `/visitas-ponto/${visitaPontoId}` : "/coletas"}
        topSlot={
          emVisitaPonto ? (
            <VisitaPontoNav visitaPontoId={visitaPontoId} pontoId={pontoId || undefined} active="cassino" />
          ) : ensuringVisita ? (
            <div className="rounded-xl border border-primary-neon/20 bg-primary-neon/5 px-3 py-2 text-xs text-slate-400">
              Preparando visita multi-nicho…
            </div>
          ) : undefined
        }
      >
        <form onSubmit={handleSubmit} className="space-y-5">
          <ColetaPontoBar
            className={cn(
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
            pontoField={
              <ColetaPontoSearchSelect
                label="Ponto *"
                value={pontoId}
                onChange={setPontoId}
                options={pontos.map((p) => ({ value: p.id, label: p.nome }))}
                placeholder="Digite para buscar o ponto…"
              />
            }
            alert={
              ponto ? (
                <div className="mt-3 space-y-3">
                  {(debitoAberto > 0.009 ||
                    haverAberto > 0.009 ||
                    pendenciaOperacaoAberta > 0.009) && (
                    <div className="space-y-2">
                      {debitoAberto > 0.009 && (
                        <div className="space-y-2 rounded-xl border border-amber-500/40 bg-amber-500/[0.08] px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-500/20">
                              <AlertTriangle className="h-5 w-5 text-amber-400" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-400/90">
                                Negativo em aberto
                              </p>
                              <p className="text-xl font-bold tabular-nums text-amber-300">
                                {formatCurrency(debitoAberto)}
                              </p>
                              <p className="mt-0.5 text-xs text-amber-400/75">
                                Você adiantou — recuperar nesta coleta
                              </p>
                            </div>
                          </div>
                          {calculo && !calculo.saldoNegativo && (
                            <label
                              htmlFor="abater-negativo-anterior"
                              className={`flex cursor-pointer gap-3 rounded-xl border p-3 transition-colors ${
                                abaterNegativoAnterior
                                  ? "border-emerald-500/40 bg-emerald-500/10"
                                  : "border-amber-500/30 bg-black/20"
                              }`}
                            >
                              <input
                                type="checkbox"
                                id="abater-negativo-anterior"
                                className="mt-0.5 h-4 w-4 accent-emerald-400"
                                checked={abaterNegativoAnterior}
                                onChange={(e) => setAbaterNegativoAnterior(e.target.checked)}
                              />
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium text-emerald-200">
                                  Abater este negativo nesta coleta
                                </p>
                                <p className="mt-0.5 text-xs text-slate-400">
                                  {abaterNegativoAnterior
                                    ? "O lucro de hoje reduz o negativo e a comissão."
                                    : "Negativo fica de fora — cobrança só do lucro de hoje."}
                                </p>
                              </div>
                            </label>
                          )}
                          {pendencias.length > 0 && (
                            <div className="space-y-1.5 border-t border-amber-500/20 pt-2 text-xs">
                              {pendencias.map((p) => {
                                const saldo = saldoPendenciaReais({
                                  id: p.id,
                                  valor: Number(p.valor ?? 0),
                                  observacao: p.descricao,
                                });
                                if (saldo <= 0.009) return null;
                                return (
                                  <div
                                    key={p.id}
                                    className="flex justify-between gap-3 text-slate-400"
                                  >
                                    <span className="min-w-0 truncate">
                                      {p.titulo ?? "Saldo negativo"}
                                      {p.descricao && (
                                        <span className="block truncate text-[10px] text-slate-500">
                                          {p.descricao.split("\n")[0]}
                                        </span>
                                      )}
                                    </span>
                                    <span className="shrink-0 font-semibold tabular-nums text-amber-300">
                                      {formatCurrency(saldo)}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                      {haverDeNegativoAberto > 0.009 && (
                        <ColetaStatusFaixa
                          tom="negativo"
                          titulo="Haver — cliente pagou o negativo"
                          valor={formatCurrency(haverDeNegativoAberto)}
                          icon={<HandCoins className="h-4 w-4" />}
                          descricao="Ponto pagou ganhadores — comissão bloqueada até o lucro superar este valor. Zera sozinho no cálculo (sem descontar/pagar haver)."
                        />
                      )}
                      {haverCreditoAberto > 0.009 && (
                        <ColetaStatusFaixa
                          tom="haver"
                          titulo="Haver — crédito (troco / a mais)"
                          valor={formatCurrency(haverCreditoAberto)}
                          icon={<HandCoins className="h-4 w-4" />}
                          descricao={
                            haverCompensadoAnterior > 0.009 && haverDeNegativoAberto <= 0.009
                              ? `Registrado ${formatCurrency(haverRegistrado)} · já compensado ${formatCurrency(haverCompensadoAnterior)}`
                              : "Cliente pagou a mais ou sem troco — abate da cobrança ou você devolve"
                          }
                        />
                      )}
                      {pendenciaOperacaoAberta > 0.009 && (
                        <ColetaStatusFaixa
                          tom={temPagamentoParcial ? "alerta" : "pendencia"}
                          titulo={
                            temPagamentoParcial
                              ? "Pagamento parcial em aberto"
                              : "Pagamento pendente"
                          }
                          valor={formatCurrency(pendenciaOperacaoAberta)}
                          icon={<Clock className="h-4 w-4" />}
                          descricao="Dívida da operação de coletas anteriores — pode incluir na cobrança"
                        >
                          {pendenciasOperacao.length > 0 && (
                            <div className="space-y-1.5 text-[12px]">
                              {pendenciasOperacao.map((p) => (
                                <div
                                  key={p.id}
                                  className="flex justify-between gap-3 text-white/85"
                                >
                                  <span className="min-w-0 truncate">
                                    {p.titulo ?? "Dívida da operação"}
                                    {p.descricao && (
                                      <span className="block truncate text-[11px] text-white/70">
                                        {p.descricao.split("\n")[0]}
                                      </span>
                                    )}
                                  </span>
                                  <span className="shrink-0 tabular-nums text-white">
                                    {formatCurrency(Number(p.valor ?? 0))}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </ColetaStatusFaixa>
                      )}
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-white/[0.05] pt-3 text-sm text-slate-500">
                    <span>
                      Comissão:{" "}
                      <strong className="tabular-nums text-slate-200">{comissaoPercentual}%</strong>
                    </span>
                    {gps ? (
                      <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400/90">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                        GPS capturado
                      </span>
                    ) : null}
                  </div>
                </div>
              ) : undefined
            }
          />

          <ColetaNovaGrid
            operacao={
              <ColetaOperacaoSection
                title="Máquinas"
                subtitle={
                  leituras.length > 0
                    ? `${leituras.filter((l) => leituraEstaPronta(l)).length}/${leituras.length} prontas`
                    : undefined
                }
                loading={loadingPonto}
                loadingLabel="Carregando máquinas..."
                empty={
                  !loadingPonto && leituras.length === 0 && pontoId ? (
                    <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-950/40 px-6 py-10 text-center text-sm text-slate-500">
                      Nenhuma máquina ativa neste ponto.
                    </div>
                  ) : undefined
                }
              >
                {leituras.map((l, index) => {
                  const erros = errosMaquinas.get(l.equipamentoId);
                  return (
                    <MaquinaColetaCard
                      key={l.equipamentoId}
                      pontoId={pontoId}
                      leitura={l}
                      index={index}
                      onUpdate={updateLeitura}
                      onFotoChange={updateFoto}
                      onIaSugestao={onIaSugestao}
                      onConfirmarIa={onConfirmarIa}
                      onExcecaoContador={onExcecaoContador}
                      onIaErro={onIaErro}
                      erroEntrada={erros?.entrada}
                      erroSaida={erros?.saida}
                      erroFoto={errosFoto.get(l.equipamentoId)}
                    />
                  );
                })}
              </ColetaOperacaoSection>
            }
            fechar={
              <FecharColetaPanel
                accent={
                  calculo?.saldoNegativo
                    ? "red"
                    : receberAgora || editandoVisitaFinalizada
                      ? "emerald"
                      : "cyan"
                }
                title={
                  calculo?.saldoNegativo
                    ? "Visita negativa"
                    : editandoVisitaFinalizada
                      ? "Corrigir e salvar"
                      : emVisitaPonto && receberAgora
                        ? "Receber agora"
                        : "Fechar coleta"
                }
                subtitle={
                  calculo?.saldoNegativo
                    ? "Sem cobrança nesta coleta"
                    : editandoVisitaFinalizada
                      ? "Máquinas, descontos e pagamento desta coleta"
                      : emVisitaPonto && !receberAgora
                        ? "Desconto aqui · Pix/dinheiro na aba Cobrar"
                        : "Resultado e pagamento"
                }
                empty={
                  !calculo || !relatorioData ? (
                    <p className="rounded-xl border border-dashed border-slate-700/80 bg-slate-950/40 px-3.5 py-5 text-center text-sm text-slate-500">
                      Preencha as leituras das máquinas para ver o resultado.
                    </p>
                  ) : undefined
                }
                resumo={
                  calculo && relatorioData ? (
                    <div className="space-y-4">
                {calculo.saldoNegativo ? (
                  <ResumoOperacaoNegativaView
                    calculo={calculo}
                    adiantamento={adiantamentoDetalhe}
                  />
                ) : (
                  <>
                    <div className="rounded-2xl border border-emerald-500/20 bg-gradient-to-b from-emerald-500/[0.08] to-transparent px-4 py-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-400/90">
                        Valor da operação
                      </p>
                      <p className="mt-1.5 text-3xl font-bold tabular-nums tracking-tight text-white">
                        {formatCurrency(
                          descontoOperacaoExibido > 0.009
                            ? calculo.valorOperacaoEfetivoReais
                            : calculo.valorOperacaoReais
                        )}
                      </p>
                      <div className="mt-3 space-y-1.5 border-t border-white/[0.06] pt-3 text-sm">
                        <div className="flex justify-between gap-3 text-slate-500">
                          <span>Lucro da visita</span>
                          <span className="tabular-nums text-slate-300">
                            {formatContador(calculo.totalLucroCentavos)}
                          </span>
                        </div>
                        <div className="flex justify-between gap-3 text-slate-500">
                          <span>
                            {comissaoBloqueada(calculo) ? "Comissão bloqueada" : "Comissão"}
                            {!comissaoBloqueada(calculo) ? ` (${comissaoPercentual}%)` : ""}
                          </span>
                          <span className="tabular-nums text-orange-400">
                            {formatCurrency(calculo.valorClienteReais)}
                          </span>
                        </div>
                        {descontoOperacaoExibido > 0.009 && (
                          <div className="flex justify-between gap-3 text-slate-500">
                            <span>Desconto na operação</span>
                            <span className="tabular-nums text-orange-400">
                              − {formatCurrency(descontoOperacaoExibido)}
                            </span>
                          </div>
                        )}
                      </div>
                      {calculo.haverCompensadoReais > 0.009 &&
                        calculo.totalACobrarReais <= 0.009 && (
                          <p className="mt-3 text-xs leading-relaxed text-cyan-300/90">
                            Cliente não paga nesta visita — a operação é menor que o haver do ponto
                            (você deve a ele)
                            {calculo.haverRestanteReais > 0.009
                              ? `; restam ${formatCurrency(calculo.haverRestanteReais)} em aberto`
                              : ""}
                            .
                          </p>
                        )}
                    </div>

                    <details className="rounded-xl border border-white/[0.06] bg-white/[0.02] text-sm">
                      <summary className="cursor-pointer list-none px-3.5 py-2.5 text-slate-400 marker:content-none [&::-webkit-details-marker]:hidden">
                        Detalhes da visita
                      </summary>
                      <div className="space-y-2 border-t border-white/[0.06] px-3.5 py-3">
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
                      {calculo.recuperacaoNegativoReais > 0.009 && (
                        <div className="flex items-baseline justify-between gap-4">
                          <p className="text-slate-500">− Recuperação de negativo</p>
                          <p className="font-semibold text-amber-400 tabular-nums">
                            {formatCurrency(calculo.recuperacaoNegativoReais)}
                          </p>
                        </div>
                      )}
                      {baseComissaoReais(calculo) > 0.009 && (
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
                            {comissaoBloqueada(calculo) ? "Comissão %" : "Ajustar comissão"}
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
                            Informe a comissão (%) — incide sobre o lucro da visita.
                          </p>
                        )}
                      </div>
                    </details>

                    {(calculo.debitoTotalReais > 0.009 ||
                      calculo.recuperacaoNegativoReais > 0.009 ||
                      calculo.descontoManualReais > 0.009 ||
                      calculo.descontoRecebimentoReais > 0.009 ||
                      calculo.pendenciaOperacaoIncluidaReais > 0.009 ||
                      calculo.haverCompensadoReais > 0.009 ||
                      calculo.haverQuitadoReais > 0.009) && (
                      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 text-sm">
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
                        {calculo.haverCompensadoReais > 0.009 && (
                          <div>
                            <p className="text-slate-500">Haver abatido</p>
                            <p className="font-semibold text-cyan-400">
                              − {formatCurrency(calculo.haverCompensadoReais)}
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
                          (calculo.haverCompensadoReais > 0.009 ||
                            calculo.haverQuitadoReais > 0.009) && (
                            <div>
                              <p className="text-slate-500">Haver restante</p>
                              <p className="font-semibold text-slate-200">
                                {formatCurrency(calculo.haverRestanteReais)}
                              </p>
                            </div>
                          )}
                      </div>
                    )}
                  </>
                )}

          {calculo && calculo.saldoNegativo && calculo.pendenciaOperacaoTotalReais > 0.009 && (
            <div className="space-y-4 border-t border-slate-800 pt-4">
              <h2 className="text-sm font-medium text-slate-200">Pendência da coleta anterior</h2>
              <p className="text-xs text-slate-400">
                Ponto deve{" "}
                <strong className="tabular-nums text-slate-100">
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
                    <span className="flex items-center gap-2 text-sm text-slate-200">
                      <Clock className="h-3.5 w-3.5 shrink-0 text-slate-500" />
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
            <div className="space-y-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3.5">
              <div>
                <h2 className="text-sm font-semibold text-white">Você adiantou algo?</h2>
                <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
                  Se o ponto pagou sozinho, deixe zerado. Só preencha se você repôs na máquina.
                </p>
              </div>

              {resumoAcertoNegativo &&
                (resumoAcertoNegativo.abatidoPendenciaReais > 0.009 ||
                  resumoAcertoNegativo.valorInformadoReais > 0.009) && (
                  <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/[0.05] px-3 py-2.5 space-y-1.5">
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="text-xs text-slate-400">
                        {resumoAcertoNegativo.valorRestanteReais <= 0.009
                          ? "Acerto informado"
                          : "Falta repor ao ponto"}
                      </p>
                      <p className="text-lg font-bold text-cyan-400 tabular-nums">
                        {formatCurrency(resumoAcertoNegativo.valorRestanteReais)}
                      </p>
                    </div>
                    <div className="space-y-1 border-t border-cyan-500/15 pt-2 text-xs">
                      {resumoAcertoNegativo.abatidoPendenciaReais > 0.009 && (
                        <div className="flex justify-between gap-3 text-slate-500">
                          <span>Abatido da pendência</span>
                          <span className="tabular-nums text-green-400">
                            − {formatCurrency(resumoAcertoNegativo.abatidoPendenciaReais)}
                          </span>
                        </div>
                      )}
                      {resumoAcertoNegativo.valorInformadoReais > 0.009 && (
                        <div className="flex justify-between gap-3 text-slate-500">
                          <span>Já informado por você</span>
                          <span className="tabular-nums text-cyan-400">
                            − {formatCurrency(resumoAcertoNegativo.valorInformadoReais)}
                          </span>
                        </div>
                      )}
                      {resumoAcertoNegativo.excedenteReais > 0.009 && (
                        <div className="flex justify-between gap-3 text-slate-500">
                          <span>Excedente (vira pendência)</span>
                          <span className="tabular-nums text-amber-300">
                            {formatCurrency(resumoAcertoNegativo.excedenteReais)}
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
              {saldoCaixa != null && (
                <div className="rounded-lg border border-slate-700/60 bg-slate-900/40 px-3 py-2.5 text-xs leading-relaxed text-slate-400">
                  <p>
                    Saldo do caixa agora:{" "}
                    <span className="font-semibold tabular-nums text-slate-200">
                      {formatCurrency(Math.max(0, saldoCaixa))}
                    </span>
                  </p>
                  {(() => {
                    const deixado =
                      parseMoneyInput(pagamento.adiantamento_pix) +
                      parseMoneyInput(pagamento.adiantamento_dinheiro);
                    const disponivel = Math.max(0, saldoCaixa);
                    if (deixado <= 0.009 || deixado <= disponivel + 0.009) return null;
                    return (
                      <p className="mt-1.5 text-amber-300/90">
                        Você está deixando {formatCurrency(deixado)}, mas o caixa só tem{" "}
                        {formatCurrency(disponivel)}. A visita registra o valor total no ponto; no
                        financeiro só sai {formatCurrency(disponivel)} — o caixa fica em R$ 0,00, não
                        negativo. O restante conta como fora do caixa.
                      </p>
                    );
                  })()}
                </div>
              )}
            </div>
          )}

          {calculo && !calculo.saldoNegativo && (
            <div className="space-y-4 border-t border-slate-800 pt-4">
              {emVisitaPontoAtiva && !receberAgora ? (
                <>
                  <h2 className="font-semibold text-white">Valor da operação</h2>
                  <p className="text-xs text-slate-500">
                    Desconto da operação fica aqui. Continuando, pix e dinheiro no Cobrar.
                  </p>
                  <CobrancaClienteResumo calculo={calculo} />
                  <div className="grid gap-4 sm:grid-cols-2">
                    {calculo.debitoTotalReais <= 0.009 && calculo.haverTotalReais <= 0.009 && (
                      <FormInput
                        label="Desconto no lucro (R$)"
                        inputMode="numeric"
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
                      inputMode="numeric"
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
                      hint="Ex.: máquina engoliu notas — abate do valor a cobrar"
                    />
                  </div>
                  <div className="rounded-lg border border-primary-neon/20 bg-primary-neon/5 px-4 py-3 text-sm leading-relaxed text-slate-400">
                    Continuando: pix, dinheiro, haver e dívida ficam para a aba{" "}
                    <strong className="text-primary-neon">Cobrar</strong>, no final da visita.
                    Aqui só o valor desta operação (e desconto, se houver).
                  </div>
                </>
              ) : (
                <>
              <h2 className="font-semibold text-white">Pagamento do cliente</h2>
              <p className="text-xs text-slate-500">
                Registre quanto o <strong className="text-slate-400">cliente</strong> pagou nesta
                coleta (Pix + dinheiro). O valor a receber já está calculado no card abaixo.
              </p>

              {haverCreditoAberto > 0.009 && (
                <label
                  htmlFor="descontar-haver-cobranca"
                  className={`flex cursor-pointer gap-3 rounded-lg border p-4 transition-colors ${
                    descontarHaverNaCobranca
                      ? "border-[#c4a574]/35 bg-[#c4a574]/[0.06]"
                      : "border-white/[0.08] bg-transparent hover:border-white/15"
                  }`}
                >
                  <input
                    type="checkbox"
                    id="descontar-haver-cobranca"
                    checked={descontarHaverNaCobranca}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setDescontarHaverNaCobranca(checked);
                      if (pagarHaverRestante) {
                        const operacaoCobranca =
                          calculo.valorOperacaoEfetivoReais > 0.009
                            ? calculo.valorOperacaoEfetivoReais
                            : calculo.valorOperacaoReais;
                        const totalSemHaver =
                          operacaoCobranca +
                          (calculo.debitoTotalReais > 0.009 &&
                          calculo.recuperacaoNegativoReais > 0.009
                            ? calculo.recuperacaoNegativoReais
                            : calculo.debitoTotalReais) +
                          calculo.pendenciaOperacaoIncluidaReais;
                        const restante = checked
                          ? Math.max(
                              0,
                              haverCreditoAberto - Math.min(haverCreditoAberto, totalSemHaver)
                            )
                          : haverCreditoAberto;
                        if (restante <= 0.009) {
                          setPagarHaverRestante(false);
                          setPagamento((p) => ({
                            ...p,
                            adiantamento_pix: "",
                            adiantamento_dinheiro: "",
                            adiantamento_pix_do_caixa: false,
                            adiantamento_dinheiro_do_caixa: false,
                          }));
                        } else {
                          setPagamento((p) => ({
                            ...p,
                            adiantamento_dinheiro: formatMoneyInputOnBlur(
                              restante.toFixed(2).replace(".", ",")
                            ),
                            adiantamento_pix: "",
                          }));
                        }
                      }
                    }}
                    className="mt-0.5"
                  />
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                      <span className="flex items-center gap-2 text-sm text-slate-200">
                        <HandCoins className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                        Descontar haver nesta cobrança?
                      </span>
                      <span className="text-sm tabular-nums text-slate-300">
                        {formatCurrency(haverCreditoAberto)}
                      </span>
                    </div>
                    <p className="text-xs leading-relaxed text-slate-400">
                      {(() => {
                        const operacaoCobranca =
                          calculo.valorOperacaoEfetivoReais > 0.009
                            ? calculo.valorOperacaoEfetivoReais
                            : calculo.valorOperacaoReais;
                        const totalSemHaver =
                          operacaoCobranca +
                          (calculo.debitoTotalReais > 0.009 &&
                          calculo.recuperacaoNegativoReais > 0.009
                            ? calculo.recuperacaoNegativoReais
                            : calculo.debitoTotalReais) +
                          calculo.pendenciaOperacaoIncluidaReais;
                        if (haverCreditoAberto + 0.009 >= totalSemHaver && totalSemHaver > 0.009) {
                          return (
                            <>
                              Crédito de troco/a mais. Se marcar, a operação abate do haver — o
                              cliente não paga nada nesta visita (é você quem deve), e o que sobrar
                              fica para a próxima.
                            </>
                          );
                        }
                        return (
                          <>
                            Crédito de troco/a mais. Se marcar, abate da cobrança — o cliente paga
                            só a diferença e o haver zera.
                          </>
                        );
                      })()}
                    </p>
                  </div>
                </label>
              )}

              <CobrancaClienteResumo calculo={calculo} />

              {(() => {
                if (haverCreditoAberto <= 0.009) return null;
                const operacaoCobranca =
                  calculo.valorOperacaoEfetivoReais > 0.009
                    ? calculo.valorOperacaoEfetivoReais
                    : calculo.valorOperacaoReais;
                const totalSemHaver =
                  operacaoCobranca +
                  (calculo.debitoTotalReais > 0.009 &&
                  calculo.recuperacaoNegativoReais > 0.009
                    ? calculo.recuperacaoNegativoReais
                    : calculo.debitoTotalReais) +
                  calculo.pendenciaOperacaoIncluidaReais;
                const haverAposCobranca = descontarHaverNaCobranca
                  ? Math.max(
                      0,
                      haverCreditoAberto - Math.min(haverCreditoAberto, totalSemHaver)
                    )
                  : haverCreditoAberto;
                const haverParaPagar = pagarHaverRestante
                  ? Math.max(calculo.haverRestanteReais, 0)
                  : haverAposCobranca;
                if (haverAposCobranca <= 0.009 && !pagarHaverRestante) return null;

                return (
                  <div className="space-y-3">
                    <label
                      htmlFor="pagar-haver-restante"
                      className={`flex cursor-pointer gap-3 rounded-lg border p-4 transition-colors ${
                        pagarHaverRestante
                          ? "border-[#c4a574]/35 bg-[#c4a574]/[0.06]"
                          : "border-white/[0.08] bg-transparent hover:border-white/15"
                      }`}
                    >
                      <input
                        type="checkbox"
                        id="pagar-haver-restante"
                        checked={pagarHaverRestante}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setPagarHaverRestante(checked);
                          if (!checked) {
                            setPagamento((p) => ({
                              ...p,
                              adiantamento_pix: "",
                              adiantamento_dinheiro: "",
                              adiantamento_pix_do_caixa: false,
                              adiantamento_dinheiro_do_caixa: false,
                            }));
                          } else if (haverAposCobranca > 0.009) {
                            setPagamento((p) => ({
                              ...p,
                              adiantamento_dinheiro: formatMoneyInputOnBlur(
                                haverAposCobranca.toFixed(2).replace(".", ",")
                              ),
                              adiantamento_pix: "",
                            }));
                          }
                        }}
                        className="mt-0.5"
                      />
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                          <span className="flex items-center gap-2 text-sm text-slate-200">
                            <HandCoins className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                            Pagar haver restante ao ponto?
                          </span>
                          <span className="text-sm tabular-nums text-slate-300">
                            {formatCurrency(haverAposCobranca)}
                          </span>
                        </div>
                        <p className="text-xs leading-relaxed text-slate-400">
                          Se quiser quitar agora o que ainda deve ao ponto, informe Pix ou dinheiro
                          que você pagou. Pode pagar parcial — o restante fica em aberto.
                        </p>
                      </div>
                    </label>

                    {pagarHaverRestante && (
                      <div className="space-y-3 border border-white/[0.08] bg-white/[0.02] p-4">
                        <p className="text-xs text-slate-500">
                          Saída do seu caixa para o ponto — não é pagamento do cliente.
                        </p>
                        <PagamentoCaixaFields
                          modo="saida"
                          pix={pagamento.adiantamento_pix}
                          dinheiro={pagamento.adiantamento_dinheiro}
                          pixDoCaixa={pagamento.adiantamento_pix_do_caixa}
                          dinheiroDoCaixa={pagamento.adiantamento_dinheiro_do_caixa}
                          pixLabel="Pix que você pagou (R$)"
                          dinheiroLabel="Dinheiro que você pagou (R$)"
                          onPixChange={(v) =>
                            setPagamento((p) => ({ ...p, adiantamento_pix: v }))
                          }
                          onDinheiroChange={(v) =>
                            setPagamento((p) => ({ ...p, adiantamento_dinheiro: v }))
                          }
                          onPixDoCaixaChange={(checked) =>
                            setPagamento((p) => ({
                              ...p,
                              adiantamento_pix_do_caixa: checked,
                            }))
                          }
                          onDinheiroDoCaixaChange={(checked) =>
                            setPagamento((p) => ({
                              ...p,
                              adiantamento_dinheiro_do_caixa: checked,
                            }))
                          }
                        />
                        {calculo.haverQuitadoReais > 0.009 && (
                          <p className="text-sm text-slate-300">
                            Haver quitado agora: {formatCurrency(calculo.haverQuitadoReais)}
                            {haverParaPagar > 0.009
                              ? ` · ainda resta ${formatCurrency(calculo.haverRestanteReais)}`
                              : " · haver zerado"}
                          </p>
                        )}
                        {saldoCaixa != null &&
                          parseMoneyInput(pagamento.adiantamento_pix) +
                            parseMoneyInput(pagamento.adiantamento_dinheiro) >
                            Math.max(0, saldoCaixa) + 0.009 && (
                            <p className="text-xs text-amber-300/90">
                              Saldo do caixa: {formatCurrency(Math.max(0, saldoCaixa))}. Só esse
                              valor sai do financeiro — o caixa não fica negativo.
                            </p>
                          )}
                      </div>
                    )}
                  </div>
                );
              })()}

              {calculo.pendenciaOperacaoTotalReais > 0.009 && (
                <label
                  htmlFor="incluir-pendencia-operacao"
                  className={`flex cursor-pointer gap-3 rounded-lg border p-4 transition-colors ${
                    incluirPendenciaOperacao
                      ? "border-amber-600/40 bg-amber-950/20"
                      : "border-white/[0.08] bg-transparent hover:border-white/15"
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
                      <span className="flex items-center gap-2 text-sm text-slate-200">
                        <Clock className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                        Incluir pendência nesta cobrança
                      </span>
                      <span className="text-sm tabular-nums text-slate-300">
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
                    inputMode="numeric"
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
                  inputMode="numeric"
                  enterKeyHint="done"
                  autoComplete="off"
                  placeholder="0,00"
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

              {calculo.totalACobrarReais > 0.009 && (
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
              )}
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
                  Cliente pagou a mais: {formatCurrency(calculo.haverReais)} → crédito (troco/a mais)
                </p>
              )}
                </>
              )}
            </div>
          )}
                    </div>
                  ) : undefined
                }
                previa={
                  calculo && relatorioData ? (
                    <PreviaRelatorioPanel
                      data={{ ...relatorioData, previa: true }}
                      disabled={!leiturasCompletas}
                      chavePix={chavePix}
                    />
                  ) : undefined
                }
                observacao
                observacaoValue={pagamento.observacao}
                onObservacaoChange={(v) =>
                  setPagamento((p) => ({ ...p, observacao: v }))
                }
                error={error}
                depoisDaColeta={
                  emVisitaPontoAtiva && calculo ? (
                    <VisitaColetaModoPagamento
                      value={
                        calculo.saldoNegativo && modoFecharVisita === "receber"
                          ? "continuar"
                          : modoFecharVisita
                      }
                      onChange={(v) => {
                        setModoFecharVisita(v);
                        if (v !== "receber") {
                          setDescontarHaverNaCobranca(false);
                          setPagarHaverRestante(false);
                          setIncluirPendenciaOperacao(false);
                        }
                      }}
                      accent={calculo.saldoNegativo ? "rose" : "emerald"}
                      varianteSegundo={calculo.saldoNegativo ? "finalizar" : "receber"}
                    />
                  ) : undefined
                }
                submitLabel={
                  editandoVisitaFinalizada
                    ? "Salvar correção completa"
                    : emVisitaPontoAtiva
                    ? finalizarVisitaSemPagar
                      ? "Encerrar sem cobrar"
                      : receberAgora
                        ? "Receber agora"
                        : editarVisitaId
                          ? "Salvar correção e seguir"
                          : "Salvar e seguir"
                    : editarVisitaId
                      ? "Salvar correção"
                      : "Salvar coleta cassino"
                }
                submitDisabled={loadingPonto || leituras.length === 0 || !!sucesso}
                loading={loading}
              />
            }
          />
        </form>
      </ColetaNovaPageShell>

      {sucesso && ponto && (
        <ColetaCassinoSucessoModal
          open
          data={sucesso.relatorioData}
          visitaId={sucesso.visitaId}
          empresaId={sucesso.empresaId}
          pontoId={pontoId}
          visitaPontoId={visitaPontoId || null}
          onClose={handleConcluir}
        />
      )}

      {decisaoDialogEl}

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

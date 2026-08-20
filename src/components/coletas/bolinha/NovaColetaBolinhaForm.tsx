"use client";

import { useEffect, useMemo, useState } from "react";
import { useSubmitLock } from "@/hooks/use-submit-lock";
import { useRouter, useSearchParams } from "next/navigation";
import { Circle } from "lucide-react";
import { ExpandableImage } from "@/components/ui/ExpandableImage";
import { FotoColetaCaptura } from "@/components/coletas/FotoColetaCaptura";
import { createClient } from "@/lib/supabase/client";
import { getEmpresaIdForUser } from "@/lib/supabase/empresa";
import { uploadFotosMaquinasParalelo } from "@/lib/storage/coleta-fotos";
import { useVisitaPontoContext } from "@/components/visitas-ponto/useVisitaPontoContext";
import { VisitaPontoNav } from "@/components/visitas-ponto/VisitaPontoNav";
import {
  formatCurrency,
  cn,
  parseMoneyInput,
  formatMoneyInput,
  formatMoneyInputOnBlur,
} from "@/lib/utils";
import { calcularColetaBolinha, NICHO_MODULO_BOLINHA } from "@/lib/nichos/bolinha";
import {
  normalizarEstoqueBrindesPonto,
  restaurarEstoqueBrindes,
  type BrindeEntreguePonto,
  type EstoqueBrindePonto,
} from "@/lib/estoque/brindes-ponto";
import { agregarDividaCobravelPorPonto } from "@/lib/visitas-ponto/divida-ponto";
import { getEquipamentoDisplayNome } from "@/lib/equipamentos";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";
import { ColetaBolinhaResumo } from "@/components/coletas/bolinha/ColetaBolinhaResumo";
import { PreviaRelatorioBolinhaPanel } from "@/components/coletas/bolinha/PreviaRelatorioBolinhaPanel";
import {
  VisitaColetaModoPagamento,
  type VisitaColetaModoFechar,
} from "@/components/visitas-ponto/VisitaColetaModoPagamento";
import {
  ColetaNovaPageShell,
  ColetaPontoBar,
  ColetaNovaGrid,
  ColetaOperacaoSection,
  FecharColetaPanel,
  ColetaPreviaSection,
  coletaInputClass,
} from "@/components/coletas/layout";
import { ColetaHaverPendenciaPanel } from "@/components/coletas/ColetaHaverPendenciaPanel";
import { ColetaPontoSearchSelect } from "@/components/coletas/ColetaPontoSearchSelect";
import { somarHaverNichoAberto } from "@/lib/coletas/haver-nicho";
import { totalCobrancaNicho, detalheCobrancaParaComprovante } from "@/lib/coletas/total-cobranca-nicho";
import type { RelatorioBolinhaData } from "@/lib/nichos/bolinha/relatorio";
import { AbrirChamadoButton } from "@/components/chamados/AbrirChamadoButton";
import type { Equipamento, Ponto } from "@/lib/types/database";
import { getComissaoPercentualNicho } from "@/lib/pontos/comissao-nicho";

type MaquinaForm = {
  equipamentoId: string;
  nome: string;
  entradaAnterior: number;
  valorContadoInput: string;
  precoJogada: number;
  fotoReferenciaUrl: string | null;
  fotoFile: File | null;
  fotoPreview: string | null;
  estoqueBrindes: EstoqueBrindePonto[];
};

function maquinaToForm(eq: Equipamento): MaquinaForm {
  return {
    equipamentoId: eq.id,
    nome: getEquipamentoDisplayNome(eq),
    entradaAnterior: Math.round(Number(eq.entrada_atual ?? 0)),
    valorContadoInput: "",
    precoJogada: Number(eq.preco_jogada ?? 0),
    fotoReferenciaUrl: eq.foto_url ?? null,
    fotoFile: null,
    fotoPreview: null,
    estoqueBrindes: normalizarEstoqueBrindesPonto(eq.estoque_brindes),
  };
}

function inputClass(hasError: boolean) {
  return coletaInputClass(hasError);
}

export function NovaColetaBolinhaForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pontoInicial = searchParams.get("ponto") ?? "";
  const editarColetaId =
    searchParams.get("editar_coleta")?.trim() ||
    searchParams.get("editar_visita")?.trim() ||
    "";
  const [pontoId, setPontoId] = useState(pontoInicial);
  const {
    visitaPontoId,
    emVisitaPonto,
    ensuringVisita,
    voltarAposColeta,
    finalizarVisitaAgora,
    confirmarReceberEncerrar,
    decisaoDialogEl,
  } = useVisitaPontoContext(pontoId);

  const [loading, setLoading] = useState(false);
  const submitLock = useSubmitLock();
  const [loadingPonto, setLoadingPonto] = useState(false);
  const [editandoCarregado, setEditandoCarregado] = useState(!editarColetaId);
  const [error, setError] = useState("");
  const [empresaId, setEmpresaId] = useState<string | null>(null);
  const [empresaNome, setEmpresaNome] = useState("Operação");
  const [chavePix, setChavePix] = useState<string | null>(null);
  const [pontos, setPontos] = useState<Ponto[]>([]);
  const [ponto, setPonto] = useState<Ponto | null>(null);
  const [maquinas, setMaquinas] = useState<MaquinaForm[]>([]);
  const [comissaoPercentual, setComissaoPercentual] = useState("");
  const [desconto, setDesconto] = useState("");
  const [valorPix, setValorPix] = useState("");
  const [valorDinheiro, setValorDinheiro] = useState("");
  const [modoFecharVisita, setModoFecharVisita] =
    useState<VisitaColetaModoFechar>("continuar");
  const receberAgora = emVisitaPonto && modoFecharVisita === "receber";
  /** Fora da visita multi-nicho, a coleta cobra na hora — Pix/dinheiro devem ir pro servidor. */
  const cobrandoAgora = !emVisitaPonto || receberAgora;
  const [haverSaldo, setHaverSaldo] = useState(0);
  const [descontarHaver, setDescontarHaver] = useState(false);
  const [incluirPendencia, setIncluirPendencia] = useState(false);
  const [pendenciasPorPonto, setPendenciasPorPonto] = useState(
    new Map<string, { totalPendente: number; coletasAbertas: number }>()
  );
  const [observacao, setObservacao] = useState("");
  const [gps, setGps] = useState<{ latitude: number; longitude: number } | null>(null);

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
      const [{ data }, { data: pendRows }, { data: empresa }] = await Promise.all([
        supabase
          .from("pontos")
          .select("*")
          .eq("empresa_id", eid)
          .eq("status", "ativo")
          .order("nome"),
        supabase
          .from("pendencias")
          .select("ponto_id, tipo, titulo, valor, descricao")
          .eq("empresa_id", eid)
          .eq("status", "aberta"),
        supabase.from("empresas").select("nome_operacao, chave_pix").eq("id", eid).maybeSingle(),
      ]);
      setPontos(data ?? []);
      setPendenciasPorPonto(agregarDividaCobravelPorPonto(pendRows ?? []));
      if (empresa?.nome_operacao) setEmpresaNome(empresa.nome_operacao);
      setChavePix(empresa?.chave_pix ?? null);
    }
    loadPontos();
  }, []);

  useEffect(() => {
    if (!pontoId) {
      setPonto(null);
      setMaquinas([]);
      if (!editarColetaId) {
        setComissaoPercentual("");
        setDescontarHaver(false);
        setIncluirPendencia(false);
      }
      return;
    }

    if (editarColetaId && !empresaId) return;

    if (!editarColetaId) {
      setDescontarHaver(false);
      setIncluirPendencia(false);
    }

    async function loadPontoData() {
      setLoadingPonto(true);
      setError("");
      const supabase = createClient();
      const [{ data: pontoData }, { data: equipamentos }] = await Promise.all([
        supabase.from("pontos").select("*").eq("id", pontoId).maybeSingle(),
        supabase
          .from("equipamentos")
          .select("*")
          .eq("ponto_id", pontoId)
          .eq("tipo", "bolinha")
          .eq("status", "ativo")
          .order("nome"),
      ]);

      setPonto(pontoData);

      let forms = (equipamentos ?? []).map((eq: Equipamento) => maquinaToForm(eq));

      if (editarColetaId && empresaId) {
        const { data: coleta, error: coletaErr } = await supabase
          .from("coletas")
          .select("*")
          .eq("id", editarColetaId)
          .eq("empresa_id", empresaId)
          .eq("nicho_modulo", NICHO_MODULO_BOLINHA)
          .maybeSingle();

        if (coletaErr || !coleta) {
          setError("Coleta para edição não encontrada.");
          setEditandoCarregado(true);
          setLoadingPonto(false);
          return;
        }

        const eqId = String(coleta.equipamento_id ?? "");
        forms = forms.filter((m) => m.equipamentoId === eqId);
        if (forms.length === 0 && eqId) {
          const { data: eqRow } = await supabase
            .from("equipamentos")
            .select("*")
            .eq("id", eqId)
            .maybeSingle();
          if (eqRow) forms = [maquinaToForm(eqRow as Equipamento)];
        }

        const brindesSalvos = (
          Array.isArray(coleta.brindes_entregues) ? coleta.brindes_entregues : []
        ) as BrindeEntreguePonto[];

        forms = forms.map((m) => {
          const estoqueComOriginais =
            brindesSalvos.length > 0
              ? restaurarEstoqueBrindes(m.estoqueBrindes, brindesSalvos)
              : m.estoqueBrindes;
          return {
            ...m,
            entradaAnterior: Math.round(
              Number(coleta.entrada_anterior ?? m.entradaAnterior)
            ),
            valorContadoInput: formatMoneyInput(Number(coleta.valor_bruto ?? 0)),
            fotoPreview: coleta.foto_url ? String(coleta.foto_url) : null,
            estoqueBrindes: estoqueComOriginais,
          };
        });

        setComissaoPercentual(String(coleta.comissao_percentual ?? ""));
        setDesconto(Number(coleta.desconto ?? 0) > 0.009 ? String(coleta.desconto) : "");
        setValorPix(Number(coleta.valor_pix ?? 0) > 0.009 ? String(coleta.valor_pix) : "");
        setValorDinheiro(
          Number(coleta.valor_dinheiro ?? 0) > 0.009 ? String(coleta.valor_dinheiro) : ""
        );
        setObservacao(String(coleta.observacao ?? ""));
        setEditandoCarregado(true);
      } else {
        setComissaoPercentual(String(getComissaoPercentualNicho(pontoData, "bolinha")));
      }

      setMaquinas(forms);
      setLoadingPonto(false);

      if (!pontoData) setError("Ponto não encontrado.");
      else if (forms.length === 0) {
        setError("Este ponto não tem máquinas de Bolinha cadastradas.");
      }
    }

    void loadPontoData();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- empresaId só importa na edição
  }, [pontoId, editarColetaId, editarColetaId ? empresaId : null]);

  useEffect(() => {
    if (!pontoId || !empresaId) {
      setHaverSaldo(0);
      return;
    }
    let cancelled = false;
    async function loadHaver() {
      const supabase = createClient();
      const { data } = await supabase
        .from("pendencias")
        .select("id, tipo, titulo, valor, status")
        .eq("empresa_id", empresaId)
        .eq("ponto_id", pontoId)
        .eq("status", "aberta")
        .ilike("tipo", "haver");
      if (cancelled) return;
      setHaverSaldo(somarHaverNichoAberto(data ?? [], "bolinha"));
    }
    void loadHaver();
    return () => {
      cancelled = true;
    };
  }, [pontoId, empresaId]);

  const pendenciaPonto = pontoId ? pendenciasPorPonto.get(pontoId) : undefined;
  const valorRecebido =
    emVisitaPonto && !receberAgora
      ? 0
      : parseMoneyInput(valorPix) + parseMoneyInput(valorDinheiro);

  const calculo = useMemo(() => {
    const leituras = maquinas
      .filter((maquina) => maquina.valorContadoInput.trim())
      .map((maquina) => ({
        equipamentoId: maquina.equipamentoId,
        nome: maquina.nome,
        valorContado: parseMoneyInput(maquina.valorContadoInput),
        precoJogada: maquina.precoJogada,
        entradaAnteriorCentavos: maquina.entradaAnterior,
        fotoUrl: maquina.fotoPreview,
        estoqueMaquina: maquina.estoqueBrindes,
      }));

    try {
      return calcularColetaBolinha({
        leituras,
        comissaoPercentual: Number(comissaoPercentual) || 0,
        desconto: Number(desconto) || 0,
        valorPagoRecebido: valorRecebido,
      });
    } catch {
      return null;
    }
  }, [maquinas, comissaoPercentual, desconto, valorRecebido]);

  const totalACobrarAgora = useMemo(() => {
    if (emVisitaPonto && !receberAgora) return calculo?.valorAReceber ?? 0;
    return totalCobrancaNicho({
      valorOperacao: calculo?.valorAReceber ?? 0,
      pendenciaSaldo: pendenciaPonto?.totalPendente ?? 0,
      incluirPendencia,
      haverSaldo,
      descontarHaver,
    }).totalACobrar;
  }, [
    emVisitaPonto,
    receberAgora,
    calculo?.valorAReceber,
    pendenciaPonto?.totalPendente,
    incluirPendencia,
    haverSaldo,
    descontarHaver,
  ]);

  const calculoError = useMemo(() => {
    const leituras = maquinas
      .filter((maquina) => maquina.valorContadoInput.trim())
      .map((maquina) => ({
        equipamentoId: maquina.equipamentoId,
        nome: maquina.nome,
        valorContado: parseMoneyInput(maquina.valorContadoInput),
        precoJogada: maquina.precoJogada,
        entradaAnteriorCentavos: maquina.entradaAnterior,
        fotoUrl: maquina.fotoPreview,
        estoqueMaquina: maquina.estoqueBrindes,
      }));

    if (leituras.length === 0) return null;

    try {
      calcularColetaBolinha({
        leituras,
        comissaoPercentual: Number(comissaoPercentual) || 0,
        desconto: Number(desconto) || 0,
        valorPagoRecebido: valorRecebido,
      });
      return null;
    } catch (err) {
      return err instanceof Error ? err.message : "Erro no cálculo da coleta.";
    }
  }, [maquinas, comissaoPercentual, desconto, valorRecebido]);

  const leiturasCompletas =
    maquinas.length > 0 &&
    maquinas.every(
      (maquina) =>
        maquina.valorContadoInput.trim() && (maquina.fotoFile || maquina.fotoPreview)
    );

  const maquinasProntas = maquinas.filter(
    (maquina) =>
      maquina.valorContadoInput.trim() && (maquina.fotoFile || maquina.fotoPreview)
  ).length;

  const relatorioData: RelatorioBolinhaData | null = useMemo(() => {
    if (!calculo || !ponto || calculo.maquinas.length === 0) return null;
    return {
      empresaNome,
      pontoNome: ponto.nome,
      pontoWhatsapp: ponto.whatsapp,
      comissaoPercentual: Number(comissaoPercentual) || 0,
      data: new Date(),
      previa: false,
      maquinas: calculo.maquinas.map((maquina) => ({
        nome: maquina.nome,
        valorContado: maquina.valorContado,
        precoJogada: maquina.precoJogada,
        unidadesSaiu: maquina.unidadesSaiu,
        entradaAnterior: maquina.entradaAnterior,
        entradaAtual: maquina.entradaAtual,
        entradaPeriodo: maquina.entradaPeriodo,
        valorBruto: maquina.valorBruto,
        custoBrindes: maquina.custoBrindes,
        lucroReal: maquina.lucroReal,
        fotoUrl: maquinas.find((item) => item.equipamentoId === maquina.equipamentoId)?.fotoPreview,
      })),
      calculo,
    };
  }, [calculo, ponto, empresaNome, maquinas, comissaoPercentual]);

  function updateMaquina(id: string, patch: Partial<MaquinaForm>) {
    setMaquinas((prev) =>
      prev.map((maquina) => (maquina.equipamentoId === id ? { ...maquina, ...patch } : maquina))
    );
  }

  function handleFoto(maquinaId: string, file: File | null) {
    setMaquinas((prev) =>
      prev.map((maquina) => {
        if (maquina.equipamentoId !== maquinaId) return maquina;
        if (maquina.fotoPreview) URL.revokeObjectURL(maquina.fotoPreview);
        return {
          ...maquina,
          fotoFile: file,
          fotoPreview: file ? URL.createObjectURL(file) : null,
        };
      })
    );
  }

  function validar(): string | null {
    if (!pontoId) return "Selecione um ponto.";
    if (maquinas.length === 0) return "Cadastre ao menos uma máquina de Bolinha neste ponto.";

    for (const maquina of maquinas) {
      if (!(maquina.precoJogada > 0)) {
        return `Cadastre o valor da jogada em ${maquina.nome} (cadastro do equipamento).`;
      }
      if (!maquina.valorContadoInput.trim()) {
        return `Informe o dinheiro contado de ${maquina.nome}.`;
      }
      if (!maquina.fotoFile && !maquina.fotoPreview) {
        return `A foto da máquina ${maquina.nome} é obrigatória.`;
      }
    }

    if (calculoError) return calculoError;
    if (!calculo || calculo.maquinas.length === 0) {
      return "Não foi possível calcular a coleta. Verifique os valores.";
    }

    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const validation = validar();
    if (validation) {
      setError(validation);
      return;
    }

    if (!empresaId) {
      setError("Empresa não encontrada.");
      return;
    }

    let fecharVisitaAgora = false;
    if (receberAgora && !editarColetaId) {
      const decisao = await confirmarReceberEncerrar();
      if (decisao === "abortar") return;
      fecharVisitaAgora = decisao === "encerrar";
    }

    if (loading || !submitLock.tryLock()) return;
    setLoading(true);
    setError("");
    let concluido = false;

    try {
      const supabase = createClient();
      const fotos = maquinas
        .filter((maquina) => maquina.fotoFile)
        .map((maquina) => ({
          equipamentoId: maquina.equipamentoId,
          file: maquina.fotoFile!,
        }));
      const fotoUrls = await uploadFotosMaquinasParalelo(
        supabase,
        empresaId,
        `Bolinha-${Date.now()}`,
        fotos
      );

      let visitaPontoParaSalvar = visitaPontoId || null;
      if (editarColetaId) {
        const delRes = await fetch(`/api/coletas/bolinha/${editarColetaId}`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "preparar_edicao", preservar_slot: true }),
        });
        const delData = await delRes.json().catch(() => ({}));
        if (!delRes.ok) {
          setError(
            typeof delData.error === "string"
              ? delData.error
              : "Não foi possível atualizar a coleta anterior."
          );
          return;
        }
        const idsReligar = Array.isArray(delData.visita_ponto_ids)
          ? (delData.visita_ponto_ids as string[]).filter(Boolean)
          : [];
        if (!visitaPontoParaSalvar && idsReligar[0]) {
          visitaPontoParaSalvar = idsReligar[0];
        }
      }

      const res = await fetch("/api/coletas/bolinha", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          ponto_id: pontoId,
          comissao_percentual: Number(comissaoPercentual) || 0,
          desconto: Number(desconto) || 0,
          valor_pix: cobrandoAgora ? parseMoneyInput(valorPix) : 0,
          valor_dinheiro: cobrandoAgora ? parseMoneyInput(valorDinheiro) : 0,
          observacao: observacao || null,
          latitude: gps?.latitude ?? null,
          longitude: gps?.longitude ?? null,
          leituras: maquinas.map((maquina) => ({
            equipamento_id: maquina.equipamentoId,
            valor_contado: parseMoneyInput(maquina.valorContadoInput),
            preco_jogada: maquina.precoJogada,
            entrada_anterior: maquina.entradaAnterior,
            foto_url:
              fotoUrls.get(maquina.equipamentoId) ??
              (maquina.fotoPreview && !maquina.fotoFile ? maquina.fotoPreview : null),
          })),
          visita_ponto_id: visitaPontoParaSalvar,
          receber_agora: receberAgora,
          descontar_haver_na_cobranca: cobrandoAgora && descontarHaver,
          incluir_pendencia_operacao: cobrandoAgora && incluirPendencia,
          religar_visita_finalizada: Boolean(editarColetaId && visitaPontoParaSalvar),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Erro ao registrar coleta de Bolinha.");
        return;
      }

      if (fecharVisitaAgora) {
        await finalizarVisitaAgora({
          pix: parseMoneyInput(valorPix),
          dinheiro: parseMoneyInput(valorDinheiro),
          desconto: parseMoneyInput(desconto),
          somenteFechar: true,
        });
      }

      if (editarColetaId) {
        const params = new URLSearchParams();
        if (pontoId) params.set("ponto", pontoId);
        if (visitaPontoId && !fecharVisitaAgora) {
          params.set("visita_ponto", visitaPontoId);
        }
        router.replace(
          params.toString()
            ? `/coletas/nova/bolinha?${params.toString()}`
            : "/coletas/nova/bolinha"
        );
      }

      voltarAposColeta(fecharVisitaAgora ? { visitaJaFinalizada: true } : undefined);
      concluido = true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao registrar coleta.");
    } finally {
      setLoading(false);
      if (!concluido) submitLock.unlock();
    }
  }

  if (editarColetaId && !editandoCarregado) {
    return (
      <ColetaNovaPageShell title="Editar coleta Bolinha" subtitle="Carregando coleta…" backHref="/coletas">
        <p className="text-sm text-slate-500">Carregando dados da coleta…</p>
      </ColetaNovaPageShell>
    );
  }

  return (
    <ColetaNovaPageShell
      title={editarColetaId ? "Editar coleta Bolinha" : "Coleta Bolinha"}
      subtitle={
        editarColetaId
          ? "Corrigir valores contados e pagamento — salva no lugar da coleta anterior."
          : ensuringVisita
          ? "Entrando na visita do ponto…"
          : emVisitaPonto
            ? "Dinheiro contado por máquina — Salvar e seguir ou Receber agora."
            : "Informe o dinheiro contado por máquina — pagamento opcional no painel à direita."
      }
      backHref={emVisitaPonto ? `/visitas-ponto/${visitaPontoId}` : "/coletas"}
      topSlot={
        emVisitaPonto ? (
          <VisitaPontoNav visitaPontoId={visitaPontoId} pontoId={pontoId || undefined} active="bolinha" />
        ) : ensuringVisita ? (
          <div className="rounded-xl border border-orange-500/20 bg-orange-500/5 px-3 py-2 text-xs text-slate-400">
            Preparando visita multi-nicho…
          </div>
        ) : undefined
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <ColetaPontoBar
          pontoField={
            <ColetaPontoSearchSelect
              label="Ponto *"
              value={pontoId}
              onChange={(id) => {
                if (editarColetaId) return;
                setPontoId(id);
              }}
              options={pontos.map((item) => ({ value: item.id, label: item.nome }))}
              inputClassName={inputClass(false)}
              placeholder={
                editarColetaId ? "Ponto da coleta (não alterável)" : undefined
              }
            />
          }
          comissaoField={
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-300">Comissão (%)</label>
              <input
                type="number"
                step="0.01"
                value={comissaoPercentual}
                onChange={(e) => setComissaoPercentual(e.target.value)}
                className={inputClass(false)}
              />
            </div>
          }
          alert={
            pontoId ? (
              <div className="mt-3 space-y-3">
                <ColetaHaverPendenciaPanel
                  variante="alertas"
                  haverSaldo={haverSaldo}
                  pendenciaSaldo={pendenciaPonto?.totalPendente ?? 0}
                  pendenciaColetas={pendenciaPonto?.coletasAbertas ?? 0}
                  descontarHaver={descontarHaver}
                  onDescontarHaverChange={setDescontarHaver}
                  incluirPendencia={incluirPendencia}
                  onIncluirPendenciaChange={setIncluirPendencia}
                />
              </div>
            ) : undefined
          }
        />

        <ColetaNovaGrid
          operacao={
            <ColetaOperacaoSection
              title="Máquinas"
              subtitle={
                maquinas.length > 0
                  ? `${maquinasProntas}/${maquinas.length} prontas`
                  : undefined
              }
              loading={loadingPonto}
              empty={
                !loadingPonto && maquinas.length === 0 && pontoId ? (
                  <div className="glass-card border border-dashed border-slate-700 p-6 text-center text-sm text-slate-500">
                    Nenhuma máquina de Bolinha ativa neste ponto.
                  </div>
                ) : undefined
              }
            >
            {maquinas.map((maquina, index) => {
              const maquinaCalc = calculo?.maquinas.find(
                (item) => item.equipamentoId === maquina.equipamentoId
              );
              const pronta =
                Boolean(maquina.valorContadoInput.trim()) &&
                Boolean(maquina.fotoFile || maquina.fotoPreview);
              const estoqueDisponivel = maquina.estoqueBrindes.reduce(
                (acc, item) => acc + Math.max(0, Number(item.quantidade) || 0),
                0
              );

              return (
                <div
                  key={maquina.equipamentoId}
                  className={cn(
                    "glass-card border p-4 sm:p-5 space-y-4",
                    pronta ? "border-orange-500/20" : "border-slate-800"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className="relative shrink-0">
                      {maquina.fotoReferenciaUrl ? (
                        <ExpandableImage
                          src={maquina.fotoReferenciaUrl}
                          alt={`Foto ${maquina.nome}`}
                          className="h-14 w-14 rounded-lg object-cover ring-1 ring-white/10"
                          fullWidth={false}
                        />
                      ) : (
                        <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-orange-500/10 ring-1 ring-orange-500/15">
                          <Circle className="h-6 w-6 text-orange-400/70" />
                        </div>
                      )}
                      <span className="absolute -left-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-md bg-orange-500 text-[10px] font-bold text-slate-950">
                        {index + 1}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate font-medium text-white">{maquina.nome}</p>
                        <AbrirChamadoButton
                          pontoId={pontoId}
                          equipamentoId={maquina.equipamentoId}
                          equipamentoNome={maquina.nome}
                          variant="icon"
                        />
                      </div>
                      <p className="text-xs text-slate-500">
                        Jogada:{" "}
                        {maquina.precoJogada > 0
                          ? formatCurrency(maquina.precoJogada)
                          : "não cadastrada"}
                        {pronta && <span className="ml-2 text-green-400">· Pronta</span>}
                      </p>
                      {!maquina.fotoReferenciaUrl && (
                        <p className="mt-0.5 text-[11px] text-slate-600">
                          Sem foto cadastrada — edite a máquina no ponto
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <label className="block text-sm font-medium text-slate-300">
                        Dinheiro contado (R$) *
                      </label>
                      <input
                        type="text"
                        inputMode="decimal"
                        placeholder="0,00"
                        value={maquina.valorContadoInput}
                        onChange={(e) =>
                          updateMaquina(maquina.equipamentoId, {
                            valorContadoInput: formatMoneyInput(e.target.value),
                          })
                        }
                        onBlur={(e) =>
                          updateMaquina(maquina.equipamentoId, {
                            valorContadoInput: formatMoneyInputOnBlur(e.target.value),
                          })
                        }
                        className={inputClass(false)}
                      />
                    </div>
                    <div className="rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2.5">
                      <p className="text-xs text-slate-500">Saiu de cápsulas</p>
                      <p className="mt-1 text-lg font-semibold text-emerald-300">
                        {maquinaCalc
                          ? `${maquinaCalc.unidadesSaiu} ${
                              maquinaCalc.unidadesSaiu === 1 ? "cápsula" : "cápsulas"
                            }`
                          : maquina.valorContadoInput.trim()
                            ? "—"
                            : "Preencha o valor"}
                      </p>
                      <p className="mt-0.5 text-[11px] text-slate-500">
                        Estoque na máquina: {estoqueDisponivel}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div>
                      <p className="text-sm font-medium text-slate-300">Baixa automática de brindes</p>
                      <p className="text-xs text-slate-500">
                        O sistema deduz do estoque alocado nesta máquina conforme o dinheiro
                        contado ÷ preço da jogada.
                      </p>
                    </div>

                    {!maquinaCalc || maquinaCalc.brindes.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-slate-700 px-3 py-3 text-xs text-slate-500">
                        {maquina.valorContadoInput.trim()
                          ? estoqueDisponivel <= 0
                            ? "Nenhum brinde alocado. Aloque em Pontos → equipamento → aba Brindes."
                            : "Nenhuma cápsula calculada ainda."
                          : "Informe o dinheiro contado para calcular as cápsulas."}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {maquinaCalc.brindes.map((brinde, brindeIndex) => (
                          <div
                            key={`${brinde.item_id ?? brinde.nome}-${brindeIndex}`}
                            className="grid gap-2 rounded-lg border border-slate-800 bg-slate-950/40 p-3 sm:grid-cols-[minmax(0,1fr)_90px_100px] items-end"
                          >
                            <div>
                              <p className="text-xs text-slate-500">Item</p>
                              <p className="text-sm font-medium text-white">{brinde.nome}</p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-500">Qtd</p>
                              <p className="py-2 text-sm tabular-nums text-slate-300">
                                {brinde.quantidade}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-500">Custo un.</p>
                              <p className="py-2 text-sm tabular-nums text-slate-300">
                                {formatCurrency(brinde.custo_unitario)}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <FotoColetaCaptura
                    preview={maquina.fotoPreview}
                    onChange={(file) => handleFoto(maquina.equipamentoId, file)}
                    hint="Tire uma foto do dinheiro contado e/ou da máquina para validar a coleta."
                    alt={`Foto ${maquina.nome}`}
                    buttonClassName="py-6 hover:border-orange-500/40 hover:text-orange-300"
                  />
                </div>
              );
            })}
            </ColetaOperacaoSection>
          }
          fechar={
            <FecharColetaPanel
              accent="amber"
              empty={
                !calculo || calculo.maquinas.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-slate-700 bg-slate-950/30 px-3 py-4 text-sm text-slate-500">
                    Informe o dinheiro contado de pelo menos uma máquina para ver o resumo e
                    registrar o pagamento.
                    {calculoError ? (
                      <span className="mt-2 block text-amber-300">{calculoError}</span>
                    ) : null}
                  </p>
                ) : undefined
              }
              resumo={
                calculo && calculo.maquinas.length > 0 ? (
                  <ColetaBolinhaResumo
                    calculo={calculo}
                    pendenciaPonto={pendenciaPonto}
                    haverSaldo={haverSaldo}
                    descontarHaver={descontarHaver}
                    onDescontarHaverChange={setDescontarHaver}
                    incluirPendencia={incluirPendencia}
                    onIncluirPendenciaChange={setIncluirPendencia}
                    modoVisitaPonto={emVisitaPonto}
                    receberAgora={receberAgora}
                    modoFecharSlot={
                      emVisitaPonto ? (
                        <VisitaColetaModoPagamento
                          value={modoFecharVisita === "finalizar" ? "continuar" : modoFecharVisita}
                          onChange={(v) => {
                            setModoFecharVisita(v);
                            if (v !== "receber") {
                              setDescontarHaver(false);
                              setIncluirPendencia(false);
                            }
                          }}
                          accent="amber"
                          varianteSegundo="receber"
                        />
                      ) : undefined
                    }
                    recebimento={{
                      desconto,
                      pix: valorPix,
                      dinheiro: valorDinheiro,
                      onDescontoChange: setDesconto,
                      onPixChange: setValorPix,
                      onDinheiroChange: setValorDinheiro,
                    }}
                  />
                ) : undefined
              }
              previa={
                relatorioData ? (
                  <ColetaPreviaSection>
                    <PreviaRelatorioBolinhaPanel
                      embedded
                      data={{ ...relatorioData, previa: true }}
                      disabled={!leiturasCompletas}
                      chavePix={chavePix}
                      valorACobrar={totalACobrarAgora}
                    />
                  </ColetaPreviaSection>
                ) : undefined
              }
              observacao
              observacaoValue={observacao}
              onObservacaoChange={setObservacao}
              error={error}
              submitLabel={
                editarColetaId
                  ? "Salvar correção"
                  : emVisitaPonto
                    ? receberAgora
                      ? "Receber agora"
                      : "Salvar e seguir"
                    : "Salvar coleta de Bolinha"
              }
              submitDisabled={loadingPonto || maquinas.length === 0}
              loading={loading}
            />
          }
        />
      </form>

      <LoadingOverlay show={loading || loadingPonto} message="Salvando coleta de Bolinha..." />
      {decisaoDialogEl}
    </ColetaNovaPageShell>
  );
}

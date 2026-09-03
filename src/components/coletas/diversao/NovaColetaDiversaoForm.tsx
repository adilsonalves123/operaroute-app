"use client";

import { useEffect, useMemo, useState } from "react";
import { useSubmitLock } from "@/hooks/use-submit-lock";
import { useRouter, useSearchParams } from "next/navigation";
import { FotoColetaLeitura } from "@/components/coletas/FotoColetaLeitura";
import { createClient } from "@/lib/supabase/client";
import { getEmpresaIdForUser } from "@/lib/supabase/empresa";
import { uploadFotosMaquinasParalelo } from "@/lib/storage/coleta-fotos";
import { useVisitaPontoContext } from "@/components/visitas-ponto/useVisitaPontoContext";
import { VisitaPontoNav } from "@/components/visitas-ponto/VisitaPontoNav";
import { formatCurrency, cn, parseMoneyInput } from "@/lib/utils";
import { formatContador, formatContadorInput, parseContadorInput } from "@/lib/nichos/cassino";
import {
  calcularColetaDiversao,
  DIVERSAO_EQUIPAMENTO_TIPOS,
  NICHO_MODULO_DIVERSAO,
} from "@/lib/nichos/diversao";
import { agregarDividaCobravelPorPonto, fetchAgregadoDividaCobravelEmpresa } from "@/lib/visitas-ponto/divida-ponto";
import { getEquipamentoDisplayNome } from "@/lib/equipamentos";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";
import { ColetaDiversaoResumo } from "@/components/coletas/diversao/ColetaDiversaoResumo";
import { PreviaRelatorioDiversaoPanel } from "@/components/coletas/diversao/PreviaRelatorioDiversaoPanel";
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
import { detalheCobrancaParaComprovante } from "@/lib/coletas/total-cobranca-nicho";
import type { RelatorioDiversaoData } from "@/lib/nichos/diversao/relatorio";
import { AbrirChamadoButton } from "@/components/chamados/AbrirChamadoButton";
import type { Equipamento, Ponto } from "@/lib/types/database";
import { getComissaoPercentualNicho } from "@/lib/pontos/comissao-nicho";

type MaquinaForm = {
  equipamentoId: string;
  nome: string;
  entradaAnterior: number;
  entradaAtualInput: string;
  fotoReferenciaUrl: string | null;
  fotoFile: File | null;
  fotoPreview: string | null;
};

function maquinaToForm(eq: Equipamento): MaquinaForm {
  return {
    equipamentoId: eq.id,
    nome: getEquipamentoDisplayNome(eq),
    entradaAnterior: Math.round(Number(eq.entrada_atual ?? 0)),
    entradaAtualInput: "",
    fotoReferenciaUrl: eq.foto_url ?? null,
    fotoFile: null,
    fotoPreview: null,
  };
}

function inputClass(hasError: boolean) {
  return coletaInputClass(hasError);
}

export function NovaColetaDiversaoForm() {
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
    if (!empresaId) return;
    let cancelled = false;
    void (async () => {
      const supabase = createClient();
      const map = await fetchAgregadoDividaCobravelEmpresa(supabase, empresaId);
      if (!cancelled) setPendenciasPorPonto(map);
    })();
    return () => {
      cancelled = true;
    };
  }, [empresaId, pontoId]);

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
          .in("tipo", DIVERSAO_EQUIPAMENTO_TIPOS)
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
          .eq("nicho_modulo", NICHO_MODULO_DIVERSAO)
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

        forms = forms.map((m) => ({
          ...m,
          entradaAnterior: Math.round(Number(coleta.entrada_anterior ?? m.entradaAnterior)),
          entradaAtualInput: formatContadorInput(
            String(Math.round(Number(coleta.entrada_atual ?? 0)))
          ),
          fotoPreview: coleta.foto_url ? String(coleta.foto_url) : null,
        }));

        setComissaoPercentual(String(coleta.comissao_percentual ?? ""));
        setDesconto(Number(coleta.desconto ?? 0) > 0.009 ? String(coleta.desconto) : "");
        setValorPix(Number(coleta.valor_pix ?? 0) > 0.009 ? String(coleta.valor_pix) : "");
        setValorDinheiro(
          Number(coleta.valor_dinheiro ?? 0) > 0.009 ? String(coleta.valor_dinheiro) : ""
        );
        setObservacao(String(coleta.observacao ?? ""));
        setEditandoCarregado(true);
      } else {
        setComissaoPercentual(String(getComissaoPercentualNicho(pontoData, "diversao")));
      }

      setMaquinas(forms);
      setLoadingPonto(false);

      if (!pontoData) setError("Ponto não encontrado.");
      else if (forms.length === 0) {
        setError("Este ponto não tem máquinas de diversão cadastradas.");
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
      setHaverSaldo(somarHaverNichoAberto(data ?? [], "divers"));
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
      .filter((maquina) => maquina.entradaAtualInput.trim())
      .map((maquina) => ({
        equipamentoId: maquina.equipamentoId,
        nome: maquina.nome,
        entradaAnterior: maquina.entradaAnterior,
        entradaAtual: parseContadorInput(maquina.entradaAtualInput),
        fotoUrl: maquina.fotoPreview,
      }));

    try {
      return calcularColetaDiversao({
        leituras,
        comissaoPercentual: Number(comissaoPercentual) || 0,
        desconto: Number(desconto) || 0,
        valorPagoRecebido: valorRecebido,
      });
    } catch {
      return null;
    }
  }, [maquinas, comissaoPercentual, desconto, valorRecebido]);

  const cobrancaComprovante = useMemo(() => {
    if (emVisitaPonto && !receberAgora) {
      return { totalACobrar: calculo?.valorAReceber ?? 0, cobranca: null };
    }
    return detalheCobrancaParaComprovante({
      valorOperacao: calculo?.valorAReceber ?? 0,
      pendenciaSaldo: pendenciaPonto?.totalPendente ?? 0,
      incluirPendencia,
      haverSaldo,
      descontarHaver,
    });
  }, [
    emVisitaPonto,
    receberAgora,
    calculo?.valorAReceber,
    pendenciaPonto?.totalPendente,
    incluirPendencia,
    haverSaldo,
    descontarHaver,
  ]);
  const totalACobrarAgora = cobrancaComprovante.totalACobrar;

  const leiturasCompletas =
    maquinas.length > 0 &&
    maquinas.every(
      (maquina) =>
        maquina.entradaAtualInput.trim() && (maquina.fotoFile || maquina.fotoPreview)
    );

  const maquinasProntas = maquinas.filter(
    (maquina) =>
      maquina.entradaAtualInput.trim() && (maquina.fotoFile || maquina.fotoPreview)
  ).length;

  const relatorioData: RelatorioDiversaoData | null = useMemo(() => {
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
        entradaAnterior: maquina.entradaAnterior,
        entradaAtual: maquina.entradaAtual,
        entradaPeriodo: maquina.entradaPeriodo,
        valorBruto: maquina.valorBruto,
        lucroReal: maquina.lucroReal,
        fotoUrl: maquinas.find((item) => item.equipamentoId === maquina.equipamentoId)?.fotoPreview,
      })),
      calculo,
      cobranca: cobrancaComprovante.cobranca,
    };
  }, [calculo, ponto, empresaNome, maquinas, comissaoPercentual, cobrancaComprovante.cobranca]);

  function updateMaquina(id: string, patch: Partial<MaquinaForm>) {
    setMaquinas((prev) => prev.map((maquina) => (maquina.equipamentoId === id ? { ...maquina, ...patch } : maquina)));
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
    if (maquinas.length === 0) return "Cadastre ao menos uma máquina de diversão neste ponto.";

    for (const maquina of maquinas) {
      if (!maquina.entradaAtualInput.trim()) {
        return `Informe a entrada atual de ${maquina.nome}.`;
      }
      if (parseContadorInput(maquina.entradaAtualInput) < maquina.entradaAnterior) {
        return `A entrada atual de ${maquina.nome} não pode ser menor que a anterior.`;
      }
      if (!maquina.fotoFile && !maquina.fotoPreview) {
        return `A foto da máquina ${maquina.nome} é obrigatória.`;
      }
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
        `diversao-${Date.now()}`,
        fotos
      );

      let visitaPontoParaSalvar = visitaPontoId || null;
      if (editarColetaId) {
        const delRes = await fetch(`/api/coletas/diversao/${editarColetaId}`, {
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

      const res = await fetch("/api/coletas/diversao", {
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
            entrada_anterior: maquina.entradaAnterior,
            entrada_atual: parseContadorInput(maquina.entradaAtualInput),
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
        setError(data.error ?? "Erro ao registrar coleta de diversão.");
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
            ? `/coletas/nova/diversao?${params.toString()}`
            : "/coletas/nova/diversao"
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
      <ColetaNovaPageShell title="Editar coleta diversão" subtitle="Carregando coleta…" backHref="/coletas">
        <p className="text-sm text-at-muted">Carregando dados da coleta…</p>
      </ColetaNovaPageShell>
    );
  }

  return (
    <ColetaNovaPageShell
      title={editarColetaId ? "Editar coleta diversão" : "Coleta diversão"}
      subtitle={
        editarColetaId
          ? "Corrigir leituras e valores — salva no lugar da coleta anterior."
          : ensuringVisita
          ? "Entrando na visita do ponto…"
          : emVisitaPonto
            ? "Leitura e foto por máquina — Salvar e seguir ou Receber agora."
            : "Leitura e foto por máquina — pagamento opcional no painel à direita."
      }
      backHref={emVisitaPonto ? `/visitas-ponto/${visitaPontoId}` : "/coletas"}
      topSlot={
        emVisitaPonto ? (
          <VisitaPontoNav visitaPontoId={visitaPontoId} pontoId={pontoId || undefined} active="diversao" />
        ) : ensuringVisita ? (
          <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 px-3 py-2 text-xs text-at-muted">
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
              <label className="block text-sm font-medium text-at-primary/85">Comissão (%)</label>
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
                  <div className="glass-card border border-dashed border-slate-700 p-6 text-center text-sm text-at-muted">
                    Nenhuma máquina de diversão ativa neste ponto.
                  </div>
                ) : undefined
              }
            >
            {maquinas.map((maquina, index) => {
              const entradaAtual = maquina.entradaAtualInput
                ? parseContadorInput(maquina.entradaAtualInput)
                : maquina.entradaAnterior;
              const entradaPeriodo = Math.max(0, entradaAtual - maquina.entradaAnterior);
              const valorBruto = entradaPeriodo > 0 ? formatCurrency(entradaPeriodo / 100) : null;

              const pronta =
                Boolean(maquina.entradaAtualInput.trim()) &&
                Boolean(maquina.fotoFile || maquina.fotoPreview);

              return (
                <div
                  key={maquina.equipamentoId}
                  className={cn(
                    "glass-card border p-4 sm:p-5 space-y-4",
                    pronta ? "border-cyan-500/20" : "border-slate-800"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-cyan-500/10 text-sm font-bold text-cyan-400">
                      {index + 1}
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
                      <p className="text-xs text-at-muted">
                        Anterior {formatContador(maquina.entradaAnterior)}
                        {pronta && <span className="ml-2 text-green-400">· Pronta</span>}
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <label className="block text-sm font-medium text-at-primary/85">
                        Entrada atual (visor) *
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        placeholder="0,00"
                        value={maquina.entradaAtualInput}
                        onChange={(e) =>
                          updateMaquina(maquina.equipamentoId, {
                            entradaAtualInput: formatContadorInput(e.target.value),
                          })
                        }
                        className={inputClass(false)}
                      />
                    </div>
                    <div className="rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2.5">
                      <p className="text-xs text-at-muted">Arrecadação da máquina</p>
                      <p className="mt-1 text-lg font-semibold text-emerald-300">
                        {valorBruto ?? "Preencha a leitura"}
                      </p>
                    </div>
                  </div>

                  <FotoColetaLeitura
                    preview={maquina.fotoPreview}
                    file={maquina.fotoFile}
                    onChange={(file) => handleFoto(maquina.equipamentoId, file)}
                    onContador={(valor) =>
                      updateMaquina(maquina.equipamentoId, {
                        entradaAtualInput: valor,
                      })
                    }
                    alt={`Foto ${maquina.nome}`}
                    buttonClassName="py-6 hover:border-cyan-500/40 hover:text-cyan-300"
                  />
                </div>
              );
            })}
            </ColetaOperacaoSection>
          }
          fechar={
            <FecharColetaPanel
              accent="cyan"
              empty={
                !calculo || calculo.maquinas.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-slate-700 bg-slate-950/30 px-3 py-4 text-sm text-at-muted">
                    Preencha a entrada de pelo menos uma máquina para ver o resumo e registrar o
                    pagamento.
                  </p>
                ) : undefined
              }
              resumo={
                calculo && calculo.maquinas.length > 0 ? (
                  <ColetaDiversaoResumo
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
                          accent="cyan"
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
                    <PreviaRelatorioDiversaoPanel
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
                    : "Salvar coleta de diversão"
              }
              submitDisabled={loadingPonto || maquinas.length === 0}
              loading={loading}
            />
          }
        />
      </form>

      <LoadingOverlay show={loading || loadingPonto} message="Salvando coleta de diversão..." />
      {decisaoDialogEl}
    </ColetaNovaPageShell>
  );
}

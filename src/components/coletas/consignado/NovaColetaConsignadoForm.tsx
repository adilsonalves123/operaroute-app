"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSubmitLock } from "@/hooks/use-submit-lock";
import { useSearchParams } from "next/navigation";
import { Package, Minus, Plus, Search } from "lucide-react";
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
} from "@/lib/utils";
import {
  calcularColetaConsignado,
  type CalculoColetaConsignado,
  type LinhaConsignadoInput,
  type ModoComissaoConsignado,
} from "@/lib/nichos/consignado";
import { normalizarEstoqueBrindesPonto } from "@/lib/estoque/brindes-ponto";
import { agregarDividaCobravelPorPonto } from "@/lib/visitas-ponto/divida-ponto";
import { getEquipamentoDisplayNome } from "@/lib/equipamentos";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";
import { ColetaConsignadoResumo } from "@/components/coletas/consignado/ColetaConsignadoResumo";
import { PreviaRelatorioConsignadoPanel } from "@/components/coletas/consignado/PreviaRelatorioConsignadoPanel";
import {
  ColetaConsignadoSucessoModal,
  type ExpositorReporConsignado,
} from "@/components/coletas/consignado/ColetaConsignadoSucessoModal";
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
import { totalCobrancaNicho } from "@/lib/coletas/total-cobranca-nicho";
import type { RelatorioConsignadoData } from "@/lib/nichos/consignado/relatorio";
import { AbrirChamadoButton } from "@/components/chamados/AbrirChamadoButton";
import type { Equipamento, Ponto, ProdutoConsignado } from "@/lib/types/database";

type LinhaForm = {
  produtoId: string;
  codigo: string | null;
  nome: string;
  deixado: number;
  sobrouInput: string;
  custoUnitario: number;
  precoVenda: number;
  comissaoFixa: number | null;
  fotoUrl: string | null;
};

type ExpositorForm = {
  equipamentoId: string;
  nome: string;
  fotoReferenciaUrl: string | null;
  fotoFile: File | null;
  fotoPreview: string | null;
  linhas: LinhaForm[];
};

function inputClass(hasError: boolean) {
  return coletaInputClass(hasError);
}

function parseIntInput(value: string): number {
  return Math.max(0, Math.floor(Number(value) || 0));
}

function QtyStepper({
  value,
  onChange,
  max,
  hasError,
}: {
  value: string;
  onChange: (next: string) => void;
  max?: number;
  hasError?: boolean;
}) {
  const n = parseIntInput(value);
  function set(next: number) {
    const capped = max != null ? Math.min(max, Math.max(0, next)) : Math.max(0, next);
    onChange(String(capped));
  }
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => set(n - 1)}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800"
        aria-label="Diminuir"
      >
        <Minus className="h-4 w-4" />
      </button>
      <input
        type="text"
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, ""))}
        className={cn(inputClass(Boolean(hasError)), "min-w-0 flex-1 text-center tabular-nums")}
      />
      <button
        type="button"
        onClick={() => set(n + 1)}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800"
        aria-label="Aumentar"
      >
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );
}

function expositorToForm(
  eq: Equipamento,
  catalogo: Map<string, ProdutoConsignado>
): ExpositorForm {
  const linhas: LinhaForm[] = normalizarEstoqueBrindesPonto(eq.estoque_brindes).map((item) => {
    const produto = item.item_id ? catalogo.get(item.item_id) : undefined;
    const deixado = Math.max(0, Math.floor(Number(item.quantidade) || 0));
    return {
      produtoId: item.item_id ?? "",
      codigo: produto?.codigo ?? null,
      nome: produto?.nome ?? item.nome,
      deixado,
      // Default: nada vendido — o operador reduz "Sobrou" conforme as vendas.
      sobrouInput: String(deixado),
      custoUnitario: Number(produto?.custo_unitario ?? item.custo_unitario ?? 0),
      precoVenda: Number(produto?.preco_venda ?? 0),
      comissaoFixa: produto?.comissao_fixa ?? null,
      fotoUrl: produto?.foto_url ?? null,
    };
  });

  return {
    equipamentoId: eq.id,
    nome: getEquipamentoDisplayNome(eq),
    fotoReferenciaUrl: eq.foto_url ?? null,
    fotoFile: null,
    fotoPreview: null,
    linhas,
  };
}

function linhaToInput(linha: LinhaForm): LinhaConsignadoInput {
  return {
    produtoId: linha.produtoId,
    codigo: linha.codigo,
    nome: linha.nome,
    deixado: linha.deixado,
    sobrou: parseIntInput(linha.sobrouInput),
    // Reposição fica depois da coleta (modal), para não confundir o recolhe.
    reposto: 0,
    custoUnitario: linha.custoUnitario,
    precoVenda: linha.precoVenda,
    comissaoFixa: linha.comissaoFixa,
  };
}

export function NovaColetaConsignadoForm() {
  const searchParams = useSearchParams();
  const pontoInicial = searchParams.get("ponto") ?? "";
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
  const [error, setError] = useState("");
  const [empresaId, setEmpresaId] = useState<string | null>(null);
  const [empresaNome, setEmpresaNome] = useState("Operação");
  const [chavePix, setChavePix] = useState<string | null>(null);
  const [pontos, setPontos] = useState<Ponto[]>([]);
  const [ponto, setPonto] = useState<Ponto | null>(null);
  const [expositores, setExpositores] = useState<ExpositorForm[]>([]);
  const [modoComissao, setModoComissao] = useState<ModoComissaoConsignado>("tabela");
  const [comissaoPercentual, setComissaoPercentual] = useState("0");
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
  const [buscaCodigo, setBuscaCodigo] = useState<Record<string, string>>({});
  const [destaqueProdutoId, setDestaqueProdutoId] = useState<string | null>(null);
  const linhaRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [sucessoOpen, setSucessoOpen] = useState(false);
  const [sucessoVisitaJaFinalizada, setSucessoVisitaJaFinalizada] = useState(false);
  const [sucessoRelatorio, setSucessoRelatorio] = useState<RelatorioConsignadoData | null>(null);
  const [sucessoRepor, setSucessoRepor] = useState<ExpositorReporConsignado[]>([]);

  function buscarPorCodigo(expositorId: string) {
    const codigo = (buscaCodigo[expositorId] ?? "").trim().toLowerCase();
    if (!codigo) return;
    const exp = expositores.find((e) => e.equipamentoId === expositorId);
    const linha = exp?.linhas.find((l) => (l.codigo ?? "").trim().toLowerCase() === codigo);
    if (!linha) {
      setError(`Código "${buscaCodigo[expositorId]}" não encontrado neste expositor.`);
      return;
    }
    setError("");
    setDestaqueProdutoId(linha.produtoId);
    const el = linhaRefs.current[`${expositorId}:${linha.produtoId}`];
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    window.setTimeout(() => setDestaqueProdutoId(null), 2500);
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
      setExpositores([]);
      // Consignado usa tabela (custo / valor final / repasse do produto) — não % do ponto.
      setModoComissao("tabela");
      setComissaoPercentual("0");
      setDescontarHaver(false);
      setIncluirPendencia(false);
      return;
    }

    setDescontarHaver(false);
    setIncluirPendencia(false);

    async function loadPontoData() {
      setLoadingPonto(true);
      setError("");
      const supabase = createClient();
      const eid = empresaId ?? (await getEmpresaIdForUser(supabase));
      const [{ data: pontoData }, { data: equipamentos }, { data: produtos }] = await Promise.all([
        supabase.from("pontos").select("*").eq("id", pontoId).maybeSingle(),
        supabase
          .from("equipamentos")
          .select("*")
          .eq("ponto_id", pontoId)
          .eq("tipo", "consignado")
          .eq("status", "ativo")
          .order("nome"),
        eid
          ? supabase.from("produtos_consignados").select("*").eq("empresa_id", eid)
          : Promise.resolve({ data: [] as ProdutoConsignado[] }),
      ]);

      const catalogo = new Map<string, ProdutoConsignado>(
        (produtos ?? []).map((p: ProdutoConsignado) => [p.id, p])
      );

      setPonto(pontoData);
      // Sempre tabela no recolhe: preço e repasse vêm do cadastro do produto.
      setModoComissao("tabela");
      setComissaoPercentual("0");
      setExpositores(
        (equipamentos ?? []).map((eq: Equipamento) => expositorToForm(eq, catalogo))
      );
      setLoadingPonto(false);

      if (!pontoData) setError("Ponto não encontrado.");
      else if ((equipamentos ?? []).length === 0) {
        setError("Este ponto não tem expositores de Consignado cadastrados.");
      }
    }

    loadPontoData();
  }, [pontoId, empresaId]);

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
      setHaverSaldo(somarHaverNichoAberto(data ?? [], "consignado"));
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
    const linhas = expositores.flatMap((exp) =>
      exp.linhas.filter((l) => l.sobrouInput.trim()).map(linhaToInput)
    );
    if (linhas.length === 0) return null;

    try {
      return calcularColetaConsignado({
        linhas,
        modoComissao,
        comissaoPercentual: Number(comissaoPercentual) || 0,
        desconto: Number(desconto) || 0,
        valorPagoRecebido: valorRecebido,
      });
    } catch {
      return null;
    }
  }, [expositores, modoComissao, comissaoPercentual, desconto, valorRecebido]);

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
    const linhas = expositores.flatMap((exp) =>
      exp.linhas.filter((l) => l.sobrouInput.trim()).map(linhaToInput)
    );
    if (linhas.length === 0) return null;

    try {
      calcularColetaConsignado({
        linhas,
        modoComissao,
        comissaoPercentual: Number(comissaoPercentual) || 0,
        desconto: Number(desconto) || 0,
        valorPagoRecebido: valorRecebido,
      });
      return null;
    } catch (err) {
      return err instanceof Error ? err.message : "Erro no cálculo da coleta.";
    }
  }, [expositores, modoComissao, comissaoPercentual, desconto, valorRecebido]);

  const expositorCalcs = useMemo(() => {
    const map = new Map<string, CalculoColetaConsignado>();
    for (const exp of expositores) {
      const linhas = exp.linhas.filter((l) => l.sobrouInput.trim()).map(linhaToInput);
      if (linhas.length === 0) continue;
      try {
        map.set(
          exp.equipamentoId,
          calcularColetaConsignado({
            linhas,
            modoComissao,
            comissaoPercentual: Number(comissaoPercentual) || 0,
          })
        );
      } catch {
        // Linha inválida (sobrou > deixado) — exibida inline no formulário.
      }
    }
    return map;
  }, [expositores, modoComissao, comissaoPercentual]);

  const relatorioData: RelatorioConsignadoData | null = useMemo(() => {
    if (!calculo || !ponto || calculo.linhas.length === 0) return null;
    return {
      empresaNome,
      pontoNome: ponto.nome,
      pontoWhatsapp: ponto.whatsapp,
      data: new Date(),
      previa: false,
      expositores: expositores
        .map((exp) => {
          const expCalc = expositorCalcs.get(exp.equipamentoId);
          if (!expCalc) return null;
          return {
            nome: exp.nome,
            linhas: expCalc.linhas,
            valorBruto: expCalc.valorBruto,
            custoProdutos: expCalc.custoProdutos,
            lucroReal: expCalc.lucroReal,
            fotoUrl: exp.fotoPreview,
          };
        })
        .filter((exp): exp is NonNullable<typeof exp> => exp != null),
      calculo,
    };
  }, [calculo, ponto, empresaNome, expositores, expositorCalcs]);

  function updateLinha(
    expositorId: string,
    produtoId: string,
    patch: Partial<LinhaForm>
  ) {
    setExpositores((prev) =>
      prev.map((exp) => {
        if (exp.equipamentoId !== expositorId) return exp;
        return {
          ...exp,
          linhas: exp.linhas.map((linha) =>
            linha.produtoId === produtoId ? { ...linha, ...patch } : linha
          ),
        };
      })
    );
  }

  function handleFoto(expositorId: string, file: File | null) {
    setExpositores((prev) =>
      prev.map((exp) => {
        if (exp.equipamentoId !== expositorId) return exp;
        if (exp.fotoPreview) URL.revokeObjectURL(exp.fotoPreview);
        return {
          ...exp,
          fotoFile: file,
          fotoPreview: file ? URL.createObjectURL(file) : null,
        };
      })
    );
  }

  function validar(): string | null {
    if (!pontoId) return "Selecione um ponto.";
    if (expositores.length === 0) {
      return "Cadastre ao menos um expositor de Consignado neste ponto.";
    }

    for (const exp of expositores) {
      for (const linha of exp.linhas) {
        if (!linha.sobrouInput.trim()) {
          return `Conte quanto sobrou de ${linha.nome} em ${exp.nome}.`;
        }
      }
    }

    if (calculoError) return calculoError;
    if (!calculo || calculo.linhas.length === 0) {
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
    if (receberAgora) {
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
      const fotos = expositores
        .filter((exp) => exp.fotoFile)
        .map((exp) => ({
          equipamentoId: exp.equipamentoId,
          file: exp.fotoFile!,
        }));
      const fotoUrls = await uploadFotosMaquinasParalelo(
        supabase,
        empresaId,
        `Consignado-${Date.now()}`,
        fotos
      );

      const res = await fetch("/api/coletas/consignado", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          ponto_id: pontoId,
          desconto: Number(desconto) || 0,
          valor_pix: cobrandoAgora ? parseMoneyInput(valorPix) : 0,
          valor_dinheiro: cobrandoAgora ? parseMoneyInput(valorDinheiro) : 0,
          observacao: observacao || null,
          latitude: gps?.latitude ?? null,
          longitude: gps?.longitude ?? null,
          visita_ponto_id: visitaPontoId || null,
          receber_agora: receberAgora,
          descontar_haver_na_cobranca: cobrandoAgora && descontarHaver,
          incluir_pendencia_operacao: cobrandoAgora && incluirPendencia,
          comissao_percentual: Number(comissaoPercentual) || 0,
          modo_comissao: "tabela",
          expositores: expositores.map((exp) => ({
            equipamento_id: exp.equipamentoId,
            foto_url: fotoUrls.get(exp.equipamentoId) ?? null,
            linhas: exp.linhas.map((linha) => ({
              produto_id: linha.produtoId,
              sobrou: parseIntInput(linha.sobrouInput),
              reposto: 0,
            })),
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Erro ao registrar coleta de Consignado.");
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

      if (relatorioData) {
        setSucessoRelatorio({ ...relatorioData, previa: false, data: new Date() });
        setSucessoRepor(
          expositores.map((exp) => ({
            equipamentoId: exp.equipamentoId,
            nome: exp.nome,
            linhas: exp.linhas.map((linha) => ({
              produtoId: linha.produtoId,
              codigo: linha.codigo,
              nome: linha.nome,
              saldoAtual: parseIntInput(linha.sobrouInput),
              precoVenda: linha.precoVenda,
              reporInput: "",
              fotoUrl: linha.fotoUrl,
            })),
          }))
        );
        setSucessoVisitaJaFinalizada(fecharVisitaAgora);
        setSucessoOpen(true);
      } else {
        voltarAposColeta(fecharVisitaAgora ? { visitaJaFinalizada: true } : undefined);
      }
      concluido = true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao registrar coleta.");
    } finally {
      setLoading(false);
      if (!concluido) submitLock.unlock();
    }
  }

  const totalExpositores = expositores.length;
  const expositoresComVenda = expositores.filter(
    (exp) => (expositorCalcs.get(exp.equipamentoId)?.totalVendido ?? 0) > 0
  ).length;

  return (
    <ColetaNovaPageShell
      title="Recolhe Consignado"
      subtitle={
        ensuringVisita
          ? "Entrando na visita do ponto…"
          : emVisitaPonto
            ? "Conte o que sobrou — Salvar e seguir ou Receber agora."
            : "Conte o que sobrou de cada produto — reposição só depois de finalizar."
      }
      backHref={emVisitaPonto ? `/visitas-ponto/${visitaPontoId}` : "/coletas"}
      topSlot={
        emVisitaPonto ? (
          <VisitaPontoNav
            visitaPontoId={visitaPontoId}
            pontoId={pontoId || undefined}
            active="consignado"
          />
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
              onChange={setPontoId}
              options={pontos.map((item) => ({ value: item.id, label: item.nome }))}
              inputClassName={inputClass(false)}
            />
          }
          comissaoField={
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-300">Repasse</label>
              <div className="rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2.5 text-sm text-slate-300">
                Tabela do produto
                <p className="mt-0.5 text-[11px] text-slate-500">
                  Valor final − o que o cliente ganha (cadastro)
                </p>
              </div>
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
              title="Expositores"
              subtitle={
                totalExpositores > 0
                  ? `${expositoresComVenda}/${totalExpositores} com venda`
                  : undefined
              }
              loading={loadingPonto}
              empty={
                !loadingPonto && expositores.length === 0 && pontoId ? (
                  <div className="glass-card border border-dashed border-slate-700 p-6 text-center text-sm text-slate-500">
                    Nenhum expositor de Consignado ativo neste ponto.
                  </div>
                ) : undefined
              }
            >
              {expositores.map((exp, index) => {
                const expCalc = expositorCalcs.get(exp.equipamentoId);
                const totalDeixado = exp.linhas.reduce((acc, l) => acc + l.deixado, 0);

                return (
                  <div
                    key={exp.equipamentoId}
                    className="glass-card border border-slate-800 p-4 sm:p-5 space-y-4"
                  >
                    <div className="flex items-start gap-3">
                      <div className="relative shrink-0">
                        {exp.fotoReferenciaUrl ? (
                          <ExpandableImage
                            src={exp.fotoReferenciaUrl}
                            alt={`Foto ${exp.nome}`}
                            className="h-14 w-14 rounded-lg object-cover ring-1 ring-white/10"
                            fullWidth={false}
                          />
                        ) : (
                          <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-orange-500/10 ring-1 ring-orange-500/15">
                            <Package className="h-6 w-6 text-orange-400/70" />
                          </div>
                        )}
                        <span className="absolute -left-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-md bg-orange-500 text-[10px] font-bold text-slate-950">
                          {index + 1}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate font-medium text-white">{exp.nome}</p>
                          <AbrirChamadoButton
                            pontoId={pontoId}
                            equipamentoId={exp.equipamentoId}
                            equipamentoNome={exp.nome}
                            variant="icon"
                          />
                        </div>
                        <p className="text-xs text-slate-500">
                          {exp.linhas.length} produtos · {totalDeixado} un. deixadas
                          {expCalc && expCalc.totalVendido > 0 && (
                            <span className="ml-2 text-green-400">
                              · vendeu {expCalc.totalVendido}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>

                    {exp.linhas.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-slate-700 px-3 py-3 text-xs text-slate-500">
                        Nenhum produto no expositor. Deixe produtos em Pontos → equipamento → aba
                        Estoque.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="flex gap-2">
                          <div className="relative min-w-0 flex-1">
                            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
                            <input
                              type="text"
                              value={buscaCodigo[exp.equipamentoId] ?? ""}
                              onChange={(e) =>
                                setBuscaCodigo((prev) => ({
                                  ...prev,
                                  [exp.equipamentoId]: e.target.value,
                                }))
                              }
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  buscarPorCodigo(exp.equipamentoId);
                                }
                              }}
                              placeholder="Buscar pelo código do produto"
                              className={cn(coletaInputClass(false), "pl-8")}
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => buscarPorCodigo(exp.equipamentoId)}
                            className="shrink-0 rounded-lg border border-cyan-500/30 px-3 text-sm text-cyan-300 hover:bg-cyan-500/10"
                          >
                            Achar
                          </button>
                        </div>

                        <div className="space-y-2">
                          {exp.linhas.map((linha) => {
                            const sobrouNum = parseIntInput(linha.sobrouInput);
                            const sobrouError =
                              Boolean(linha.sobrouInput.trim()) && sobrouNum > linha.deixado;
                            const linhaCalc = expCalc?.linhas.find(
                              (l) => l.produtoId === linha.produtoId
                            );
                            const destacado = destaqueProdutoId === linha.produtoId;

                            return (
                              <div
                                key={linha.produtoId || linha.nome}
                                ref={(el) => {
                                  linhaRefs.current[`${exp.equipamentoId}:${linha.produtoId}`] = el;
                                }}
                                className={cn(
                                  "rounded-lg border bg-slate-950/40 p-3 space-y-3 transition",
                                  destacado
                                    ? "border-cyan-400/60 ring-2 ring-cyan-400/30"
                                    : "border-slate-800"
                                )}
                              >
                                <div className="flex items-center gap-3">
                                  {linha.fotoUrl ? (
                                    <ExpandableImage
                                      src={linha.fotoUrl}
                                      alt={linha.nome}
                                      className="h-12 w-12 shrink-0 rounded-lg object-cover ring-1 ring-white/10"
                                      fullWidth={false}
                                    />
                                  ) : (
                                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-slate-800/80 ring-1 ring-white/5">
                                      <Package className="h-5 w-5 text-slate-500" />
                                    </div>
                                  )}
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                      <span className="rounded-md bg-cyan-500/15 px-2 py-0.5 text-xs font-semibold tabular-nums text-cyan-300">
                                        {linha.codigo?.trim() || "s/ cód."}
                                      </span>
                                      <p className="min-w-0 flex-1 truncate text-sm font-medium text-white">
                                        {linha.nome}
                                      </p>
                                    </div>
                                    <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] tabular-nums text-slate-400">
                                      <span>
                                        Custo{" "}
                                        <strong className="font-medium text-slate-300">
                                          {formatCurrency(linha.custoUnitario)}
                                        </strong>
                                      </span>
                                      <span>
                                        Vende{" "}
                                        <strong className="font-medium text-orange-200">
                                          {formatCurrency(linha.precoVenda)}
                                        </strong>
                                      </span>
                                      <span>
                                        Cliente{" "}
                                        <strong className="font-medium text-amber-300">
                                          {formatCurrency(Number(linha.comissaoFixa) || 0)}
                                        </strong>
                                        /un
                                      </span>
                                      <span>
                                        Você{" "}
                                        <strong className="font-medium text-emerald-300">
                                          {formatCurrency(
                                            Math.max(
                                              0,
                                              linha.precoVenda - (Number(linha.comissaoFixa) || 0)
                                            )
                                          )}
                                        </strong>
                                        /un
                                      </span>
                                    </div>
                                    {(linha.comissaoFixa == null ||
                                      Number(linha.comissaoFixa) <= 0) &&
                                      linha.precoVenda > 0 && (
                                        <p className="mt-1 text-[11px] text-amber-400/90">
                                          Sem repasse cadastrado neste produto — edite em Produtos
                                          consignados.
                                        </p>
                                      )}
                                  </div>
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                  <div className="rounded-lg border border-slate-800 bg-slate-950/60 px-2.5 py-2">
                                    <p className="text-[11px] text-slate-500">Deixado</p>
                                    <p className="mt-0.5 text-sm font-semibold tabular-nums text-slate-300">
                                      {linha.deixado}
                                    </p>
                                  </div>
                                  <div className="space-y-1">
                                    <label className="block text-[11px] text-slate-400">
                                      Sobrou
                                    </label>
                                    <QtyStepper
                                      value={linha.sobrouInput}
                                      max={linha.deixado}
                                      hasError={sobrouError}
                                      onChange={(next) =>
                                        updateLinha(exp.equipamentoId, linha.produtoId, {
                                          sobrouInput: next,
                                        })
                                      }
                                    />
                                  </div>
                                </div>

                                {sobrouError ? (
                                  <p className="text-[11px] text-red-400">
                                    Sobrou não pode ser maior que o deixado ({linha.deixado}).
                                  </p>
                                ) : linhaCalc ? (
                                  <div className="space-y-1 text-xs">
                                    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                                      <span className="text-slate-400">
                                        Vendeu{" "}
                                        <span className="font-semibold text-emerald-300">
                                          {linhaCalc.vendido}
                                        </span>
                                        {" · "}
                                        {linhaCalc.vendido} × {formatCurrency(linha.precoVenda)} ={" "}
                                        <span className="font-semibold text-white">
                                          {formatCurrency(linhaCalc.receita)}
                                        </span>
                                      </span>
                                    </div>
                                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-slate-500">
                                      <span>
                                        Cliente{" "}
                                        <span className="tabular-nums text-amber-300">
                                          {formatCurrency(linhaCalc.comissao)}
                                        </span>
                                      </span>
                                      <span>
                                        A receber{" "}
                                        <span className="font-semibold tabular-nums text-orange-200">
                                          {formatCurrency(linhaCalc.aReceber)}
                                        </span>
                                      </span>
                                      <span>
                                        Custo{" "}
                                        <span className="tabular-nums text-slate-400">
                                          {formatCurrency(linhaCalc.custo)}
                                        </span>
                                      </span>
                                      <span>
                                        Lucro{" "}
                                        <span className="tabular-nums text-emerald-300">
                                          {formatCurrency(linhaCalc.lucro)}
                                        </span>
                                      </span>
                                    </div>
                                  </div>
                                ) : null}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    <FotoColetaCaptura
                      preview={exp.fotoPreview}
                      onChange={(file) => handleFoto(exp.equipamentoId, file)}
                      label="Foto do expositor (opcional)"
                      hint="Tire uma foto da prateleira para registrar a contagem."
                      alt={`Foto ${exp.nome}`}
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
                !calculo || calculo.linhas.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-slate-700 bg-slate-950/30 px-3 py-4 text-sm text-slate-500">
                    Conte o que sobrou de pelo menos um produto para ver o resumo e registrar o
                    pagamento.
                    {calculoError ? (
                      <span className="mt-2 block text-amber-300">{calculoError}</span>
                    ) : null}
                  </p>
                ) : undefined
              }
              resumo={
                calculo && calculo.linhas.length > 0 ? (
                  <ColetaConsignadoResumo
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
                    <PreviaRelatorioConsignadoPanel
                      embedded
                      data={{ ...relatorioData, previa: true }}
                      disabled={!calculo}
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
                emVisitaPonto
                  ? receberAgora
                    ? "Receber agora"
                    : "Salvar e seguir"
                  : "Salvar coleta de Consignado"
              }
              submitDisabled={loadingPonto || expositores.length === 0}
              loading={loading}
            />
          }
        />
      </form>

      <LoadingOverlay show={loading || loadingPonto} message="Salvando coleta de Consignado..." />
      {decisaoDialogEl}

      {sucessoOpen && sucessoRelatorio && (
        <ColetaConsignadoSucessoModal
          open={sucessoOpen}
          data={sucessoRelatorio}
          expositores={sucessoRepor}
          onClose={() => {
            setSucessoOpen(false);
            voltarAposColeta(
              sucessoVisitaJaFinalizada ? { visitaJaFinalizada: true } : undefined
            );
          }}
        />
      )}
    </ColetaNovaPageShell>
  );
}

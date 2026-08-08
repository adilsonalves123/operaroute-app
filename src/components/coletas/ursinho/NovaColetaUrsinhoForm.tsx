"use client";

import { useEffect, useMemo, useState } from "react";
import { useSubmitLock } from "@/hooks/use-submit-lock";
import { useRouter, useSearchParams } from "next/navigation";
import { Trash2 } from "lucide-react";
import { FotoColetaCaptura } from "@/components/coletas/FotoColetaCaptura";
import { createClient } from "@/lib/supabase/client";
import { getEmpresaIdForUser } from "@/lib/supabase/empresa";
import { uploadFotosMaquinasParalelo } from "@/lib/storage/coleta-fotos";
import { useVisitaPontoContext } from "@/components/visitas-ponto/useVisitaPontoContext";
import { VisitaPontoNav } from "@/components/visitas-ponto/VisitaPontoNav";
import { formatCurrency, cn, parseMoneyInput } from "@/lib/utils";
import { formatContador, formatContadorInput, parseContadorInput } from "@/lib/nichos/cassino";
import { calcularColetaUrsinho, NICHO_MODULO_URSINHO } from "@/lib/nichos/ursinho";
import {
  maxQuantidadeBrindeMaquina,
  quantidadeRestanteBrindeColeta,
} from "@/lib/nichos/ursinho/brindes-coleta";
import {
  normalizarEstoqueBrindesPonto,
  validarBrindesContraEstoquePonto,
  type EstoqueBrindePonto,
} from "@/lib/estoque/brindes-ponto";
import { agregarPendenciasPorPonto } from "@/lib/nichos/fura-fura/pendencia-ponto";
import { getEquipamentoDisplayNome } from "@/lib/equipamentos";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";
import { ColetaUrsinhoResumo } from "@/components/coletas/ursinho/ColetaUrsinhoResumo";
import { PreviaRelatorioUrsinhoPanel } from "@/components/coletas/ursinho/PreviaRelatorioUrsinhoPanel";
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
import { somarHaverNichoAberto } from "@/lib/coletas/haver-nicho";
import { totalCobrancaNicho } from "@/lib/coletas/total-cobranca-nicho";
import type { RelatorioUrsinhoData } from "@/lib/nichos/ursinho/relatorio";
import { AbrirChamadoButton } from "@/components/chamados/AbrirChamadoButton";
import type { Equipamento, Ponto } from "@/lib/types/database";
import { getComissaoPercentualNicho } from "@/lib/pontos/comissao-nicho";

type BrindeForm = {
  id: string;
  item_id?: string;
  nome: string;
  quantidade: number;
  custo_unitario: number;
};

type MaquinaForm = {
  equipamentoId: string;
  nome: string;
  entradaAnterior: number;
  entradaAtualInput: string;
  fotoReferenciaUrl: string | null;
  fotoFile: File | null;
  fotoPreview: string | null;
  brindes: BrindeForm[];
  estoqueBrindes: EstoqueBrindePonto[];
};

function parseBrindes(brindes: BrindeForm[]) {
  return brindes
    .map((item) => ({
      item_id: item.item_id,
      nome: item.nome.trim(),
      quantidade: Math.max(0, Math.floor(Number(item.quantidade) || 0)),
      custo_unitario: Math.max(0, Number(item.custo_unitario) || 0),
    }))
    .filter((item) => item.nome && item.quantidade > 0);
}

function maquinaToForm(eq: Equipamento): MaquinaForm {
  return {
    equipamentoId: eq.id,
    nome: getEquipamentoDisplayNome(eq),
    entradaAnterior: Math.round(Number(eq.entrada_atual ?? 0)),
    entradaAtualInput: "",
    fotoReferenciaUrl: eq.foto_url ?? null,
    fotoFile: null,
    fotoPreview: null,
    brindes: [],
    estoqueBrindes: normalizarEstoqueBrindesPonto(eq.estoque_brindes),
  };
}

function inputClass(hasError: boolean) {
  return coletaInputClass(hasError);
}

export function NovaColetaUrsinhoForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pontoInicial = searchParams.get("ponto") ?? "";
  const [pontoId, setPontoId] = useState(pontoInicial);
  const { visitaPontoId, emVisitaPonto, ensuringVisita, voltarAposColeta, finalizarVisitaAgora, confirmarReceberEncerrar } =
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
  const [maquinas, setMaquinas] = useState<MaquinaForm[]>([]);
  const [comissaoPercentual, setComissaoPercentual] = useState("");
  const [desconto, setDesconto] = useState("");
  const [valorPix, setValorPix] = useState("");
  const [valorDinheiro, setValorDinheiro] = useState("");
  const [modoFecharVisita, setModoFecharVisita] =
    useState<VisitaColetaModoFechar>("continuar");
  const receberAgora = emVisitaPonto && modoFecharVisita === "receber";
  const fecharVisitaAgora = receberAgora;
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
      const [{ data }, { data: coletasPend }, { data: empresa }] = await Promise.all([
        supabase
          .from("pontos")
          .select("*")
          .eq("empresa_id", eid)
          .eq("status", "ativo")
          .order("nome"),
        supabase
          .from("coletas")
          .select("ponto_id, valor_a_receber, valor_pago_recebido")
          .eq("empresa_id", eid)
          .eq("nicho_modulo", NICHO_MODULO_URSINHO),
        supabase.from("empresas").select("nome_operacao, chave_pix").eq("id", eid).maybeSingle(),
      ]);
      setPontos(data ?? []);
      setPendenciasPorPonto(agregarPendenciasPorPonto(coletasPend ?? []));
      if (empresa?.nome_operacao) setEmpresaNome(empresa.nome_operacao);
      setChavePix(empresa?.chave_pix ?? null);
    }
    loadPontos();
  }, []);

  useEffect(() => {
    if (!pontoId) {
      setPonto(null);
      setMaquinas([]);
      setComissaoPercentual("");
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
      const [{ data: pontoData }, { data: equipamentos }] = await Promise.all([
        supabase.from("pontos").select("*").eq("id", pontoId).maybeSingle(),
        supabase
          .from("equipamentos")
          .select("*")
          .eq("ponto_id", pontoId)
          .eq("tipo", "ursinho")
          .eq("status", "ativo")
          .order("nome"),
      ]);

      setPonto(pontoData);
      setComissaoPercentual(String(getComissaoPercentualNicho(pontoData, "ursinho")));
      setMaquinas((equipamentos ?? []).map((eq: Equipamento) => maquinaToForm(eq)));
      setLoadingPonto(false);

      if (!pontoData) setError("Ponto não encontrado.");
      else if ((equipamentos ?? []).length === 0) {
        setError("Este ponto não tem máquinas de ursinho cadastradas.");
      }
    }

    loadPontoData();
  }, [pontoId]);

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
      setHaverSaldo(somarHaverNichoAberto(data ?? [], "ursinho"));
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
        brindes: parseBrindes(maquina.brindes),
      }));

    try {
      return calcularColetaUrsinho({
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

  const leiturasCompletas =
    maquinas.length > 0 &&
    maquinas.every((maquina) => maquina.entradaAtualInput.trim() && maquina.fotoFile);

  const maquinasProntas = maquinas.filter(
    (maquina) => maquina.entradaAtualInput.trim() && maquina.fotoFile
  ).length;

  const relatorioData: RelatorioUrsinhoData | null = useMemo(() => {
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
        custoBrindes: maquina.custoBrindes,
        lucroReal: maquina.lucroReal,
        fotoUrl: maquinas.find((item) => item.equipamentoId === maquina.equipamentoId)?.fotoPreview,
      })),
      calculo,
    };
  }, [calculo, ponto, empresaNome, maquinas, comissaoPercentual]);

  function updateMaquina(id: string, patch: Partial<MaquinaForm>) {
    setMaquinas((prev) => prev.map((maquina) => (maquina.equipamentoId === id ? { ...maquina, ...patch } : maquina)));
  }

  function updateBrindeQuantidade(maquinaId: string, brindeId: string, raw: string) {
    const maquina = maquinas.find((m) => m.equipamentoId === maquinaId);
    if (!maquina) return;
    const max = maxQuantidadeBrindeMaquina(
      maquina.estoqueBrindes,
      [{ equipamentoId: maquinaId, brindes: maquina.brindes }],
      maquinaId,
      brindeId
    );
    if (max <= 0) return;
    const qty = Math.min(Math.max(1, Math.floor(Number(raw) || 1)), max);
    setMaquinas((prev) =>
      prev.map((maquina) =>
        maquina.equipamentoId !== maquinaId
          ? maquina
          : {
              ...maquina,
              brindes: maquina.brindes.map((brinde) =>
                brinde.id === brindeId ? { ...brinde, quantidade: qty } : brinde
              ),
            }
      )
    );
  }

  function addBrindeFromEstoque(maquinaId: string, item: EstoqueBrindePonto) {
    const maquina = maquinas.find((m) => m.equipamentoId === maquinaId);
    if (!maquina) return;

    const restante = quantidadeRestanteBrindeColeta(
      maquina.estoqueBrindes,
      [{ equipamentoId: maquinaId, brindes: maquina.brindes }],
      item
    );
    if (restante <= 0) return;

    const key = item.item_id ?? item.nome;
    setMaquinas((prev) =>
      prev.map((maquina) => {
        if (maquina.equipamentoId !== maquinaId) return maquina;
        const idx = maquina.brindes.findIndex((brinde) => (brinde.item_id ?? brinde.nome) === key);
        if (idx >= 0) {
          const brinde = maquina.brindes[idx];
          const max = maxQuantidadeBrindeMaquina(
            maquina.estoqueBrindes,
            [{ equipamentoId: maquinaId, brindes: maquina.brindes }],
            maquinaId,
            brinde.id
          );
          if (max <= brinde.quantidade) return maquina;
          return {
            ...maquina,
            brindes: maquina.brindes.map((entry, j) =>
              j === idx ? { ...entry, quantidade: entry.quantidade + 1 } : entry
            ),
          };
        }
        return {
          ...maquina,
          brindes: [
            ...maquina.brindes,
            {
              id: crypto.randomUUID(),
              item_id: item.item_id,
              nome: item.nome,
              quantidade: 1,
              custo_unitario: Number(item.custo_unitario ?? 0),
            },
          ],
        };
      })
    );
  }

  function removeBrinde(maquinaId: string, brindeId: string) {
    setMaquinas((prev) =>
      prev.map((maquina) =>
        maquina.equipamentoId === maquinaId
          ? { ...maquina, brindes: maquina.brindes.filter((item) => item.id !== brindeId) }
          : maquina
      )
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
    if (maquinas.length === 0) return "Cadastre ao menos uma máquina de ursinho neste ponto.";

    for (const maquina of maquinas) {
      if (!maquina.entradaAtualInput.trim()) {
        return `Informe a entrada atual de ${maquina.nome}.`;
      }
      if (parseContadorInput(maquina.entradaAtualInput) < maquina.entradaAnterior) {
        return `A entrada atual de ${maquina.nome} não pode ser menor que a anterior.`;
      }
      if (!maquina.fotoFile) {
        return `A foto da máquina ${maquina.nome} é obrigatória.`;
      }
    }

    for (const maquina of maquinas) {
      const brindes = parseBrindes(maquina.brindes);
      const erroEstoque = validarBrindesContraEstoquePonto(brindes, maquina.estoqueBrindes);
      if (erroEstoque) return `${maquina.nome}: ${erroEstoque}`;
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

    if (receberAgora) {
      const ok = await confirmarReceberEncerrar();
      if (!ok) return;
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
        `ursinho-${Date.now()}`,
        fotos
      );

      const res = await fetch("/api/coletas/ursinho", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          ponto_id: pontoId,
          comissao_percentual: Number(comissaoPercentual) || 0,
          desconto: Number(desconto) || 0,
          valor_pix: receberAgora ? parseMoneyInput(valorPix) : 0,
          valor_dinheiro: receberAgora ? parseMoneyInput(valorDinheiro) : 0,
          observacao: observacao || null,
          latitude: gps?.latitude ?? null,
          longitude: gps?.longitude ?? null,
          leituras: maquinas.map((maquina) => ({
            equipamento_id: maquina.equipamentoId,
            entrada_anterior: maquina.entradaAnterior,
            entrada_atual: parseContadorInput(maquina.entradaAtualInput),
            foto_url: fotoUrls.get(maquina.equipamentoId) ?? null,
            brindes: parseBrindes(maquina.brindes),
          })),
          visita_ponto_id: visitaPontoId || null,
          receber_agora: receberAgora,
          descontar_haver_na_cobranca: receberAgora && descontarHaver,
          incluir_pendencia_operacao: receberAgora && incluirPendencia,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Erro ao registrar coleta de ursinho.");
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

      voltarAposColeta(fecharVisitaAgora ? { visitaJaFinalizada: true } : undefined);
      concluido = true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao registrar coleta.");
    } finally {
      setLoading(false);
      if (!concluido) submitLock.unlock();
    }
  }

  return (
    <ColetaNovaPageShell
      title="Coleta ursinho"
      subtitle={
        ensuringVisita
          ? "Entrando na visita do ponto…"
          : emVisitaPonto
            ? "Leitura, foto e brindes — Salvar e seguir ou Receber e encerrar."
            : "Leitura, foto e brindes por máquina — pagamento opcional no painel à direita."
      }
      backHref={emVisitaPonto ? `/visitas-ponto/${visitaPontoId}` : "/coletas"}
      topSlot={
        emVisitaPonto ? (
          <VisitaPontoNav visitaPontoId={visitaPontoId} pontoId={pontoId || undefined} active="ursinho" />
        ) : ensuringVisita ? (
          <div className="rounded-xl border border-pink-500/20 bg-pink-500/5 px-3 py-2 text-xs text-slate-400">
            Preparando visita multi-nicho…
          </div>
        ) : undefined
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <ColetaPontoBar
          pontoField={
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-300">Ponto *</label>
              <select
                value={pontoId}
                onChange={(e) => setPontoId(e.target.value)}
                className={inputClass(false)}
              >
                <option value="">Selecione...</option>
                {pontos.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.nome}
                  </option>
                ))}
              </select>
            </div>
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
                    Nenhuma máquina de ursinho ativa neste ponto.
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
                Boolean(maquina.entradaAtualInput.trim()) && Boolean(maquina.fotoFile);

              return (
                <div
                  key={maquina.equipamentoId}
                  className={cn(
                    "glass-card border p-4 sm:p-5 space-y-4",
                    pronta ? "border-pink-500/20" : "border-slate-800"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-pink-500/10 text-sm font-bold text-pink-400">
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
                      <p className="text-xs text-slate-500">
                        Anterior {formatContador(maquina.entradaAnterior)}
                        {pronta && <span className="ml-2 text-green-400">· Pronta</span>}
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <label className="block text-sm font-medium text-slate-300">
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
                      <p className="text-xs text-slate-500">Arrecadação da máquina</p>
                      <p className="mt-1 text-lg font-semibold text-emerald-300">
                        {valorBruto ?? "Preencha a leitura"}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div>
                      <p className="text-sm font-medium text-slate-300">Brindes / itens que saíram</p>
                      <p className="text-xs text-slate-500">
                        Selecione itens alocados nesta máquina. A quantidade não pode ultrapassar o
                        estoque da máquina.
                      </p>
                    </div>

                    {maquina.estoqueBrindes.filter((item) => item.quantidade > 0).length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {maquina.estoqueBrindes
                          .filter((item) => item.quantidade > 0)
                          .map((item) => {
                            const restante = quantidadeRestanteBrindeColeta(
                              maquina.estoqueBrindes,
                              [{ equipamentoId: maquina.equipamentoId, brindes: maquina.brindes }],
                              item
                            );
                            return (
                              <button
                                key={item.item_id ?? item.nome}
                                type="button"
                                disabled={restante <= 0}
                                onClick={() => addBrindeFromEstoque(maquina.equipamentoId, item)}
                                className={cn(
                                  "rounded-md border px-2 py-1 text-xs",
                                  restante <= 0
                                    ? "border-slate-800 text-slate-600 cursor-not-allowed"
                                    : "border-pink-500/25 text-pink-300 hover:bg-pink-500/10"
                                )}
                              >
                                + {item.nome} ({restante}/{item.quantidade})
                              </button>
                            );
                          })}
                      </div>
                    ) : (
                      <p className="text-xs italic text-slate-600">
                        Nenhum brinde nesta máquina. Aloque em Pontos → equipamento → aba Brindes.
                      </p>
                    )}

                    {maquina.brindes.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-slate-700 px-3 py-3 text-xs text-slate-500">
                        Nenhum item informado para esta máquina.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {maquina.brindes.map((brinde) => {
                          const maxQtd = maxQuantidadeBrindeMaquina(
                            maquina.estoqueBrindes,
                            [{ equipamentoId: maquina.equipamentoId, brindes: maquina.brindes }],
                            maquina.equipamentoId,
                            brinde.id
                          );
                          return (
                            <div
                              key={brinde.id}
                              className="grid gap-2 rounded-lg border border-slate-800 bg-slate-950/40 p-3 sm:grid-cols-[minmax(0,1fr)_90px_100px_36px] items-end"
                            >
                              <div>
                                <p className="text-xs text-slate-500">Item</p>
                                <p className="text-sm font-medium text-white">{brinde.nome}</p>
                              </div>
                              <div className="space-y-1">
                                <label className="block text-xs text-slate-500">
                                  Qtd (máx. {maxQtd})
                                </label>
                                <input
                                  type="number"
                                  min={1}
                                  max={maxQtd}
                                  value={String(brinde.quantidade)}
                                  onChange={(e) =>
                                    updateBrindeQuantidade(
                                      maquina.equipamentoId,
                                      brinde.id,
                                      e.target.value
                                    )
                                  }
                                  className={inputClass(false)}
                                />
                              </div>
                              <div>
                                <p className="text-xs text-slate-500">Custo un.</p>
                                <p className="py-2 text-sm tabular-nums text-slate-300">
                                  {formatCurrency(brinde.custo_unitario)}
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => removeBrinde(maquina.equipamentoId, brinde.id)}
                                className="rounded-lg border border-slate-700 text-slate-400 hover:text-red-400"
                              >
                                <Trash2 className="mx-auto h-4 w-4" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <FotoColetaCaptura
                    preview={maquina.fotoPreview}
                    onChange={(file) => handleFoto(maquina.equipamentoId, file)}
                    hint="Tire uma foto da numeração/visor da máquina para validar a leitura."
                    alt={`Foto ${maquina.nome}`}
                    buttonClassName="py-6 hover:border-pink-500/40 hover:text-pink-300"
                  />
                </div>
              );
            })}
            </ColetaOperacaoSection>
          }
          fechar={
            <FecharColetaPanel
              accent="pink"
              empty={
                !calculo || calculo.maquinas.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-slate-700 bg-slate-950/30 px-3 py-4 text-sm text-slate-500">
                    Preencha a entrada de pelo menos uma máquina para ver o resumo e registrar o
                    pagamento.
                  </p>
                ) : undefined
              }
              resumo={
                calculo && calculo.maquinas.length > 0 ? (
                  <ColetaUrsinhoResumo
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
                          accent="pink"
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
                    <PreviaRelatorioUrsinhoPanel
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
                emVisitaPonto
                  ? receberAgora
                    ? "Receber e encerrar"
                    : "Salvar e seguir"
                  : "Salvar coleta de ursinho"
              }
              submitDisabled={loadingPonto || maquinas.length === 0}
              loading={loading}
            />
          }
        />
      </form>

      <LoadingOverlay show={loading || loadingPonto} message="Salvando coleta de ursinho..." />
    </ColetaNovaPageShell>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { useSubmitLock } from "@/hooks/use-submit-lock";
import { useRouter, useSearchParams } from "next/navigation";
import { Navigation, Trash2, ImageIcon } from "lucide-react";
import { FormInput } from "@/components/ui/FormInput";
import { ColetaPontoSearchSelect } from "@/components/coletas/ColetaPontoSearchSelect";
import { parseMoneyInput } from "@/lib/utils";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";
import { ColetaFuraFuraResumo } from "./ColetaFuraFuraResumo";
import { FotoColetaFuraFura, type UltimaColetaFoto } from "./FotoColetaFuraFura";
import { PontoFuraAlertas } from "./PontoFuraAlertas";
import {
  ColetaNovaPageShell,
  ColetaPontoBar,
  ColetaNovaGrid,
  ColetaOperacaoSection,
  FecharColetaPanel,
  ColetaPreviaSection,
} from "@/components/coletas/layout";
import { ColetaHaverPendenciaPanel } from "@/components/coletas/ColetaHaverPendenciaPanel";
import { PreviaRelatorioFuraFuraPanel } from "@/components/coletas/fura-fura/PreviaRelatorioFuraFuraPanel";
import { ColetaFuraFuraSucessoModal } from "@/components/coletas/fura-fura/ColetaFuraFuraSucessoModal";
import { AbrirChamadoButton } from "@/components/chamados/AbrirChamadoButton";
import { somarHaverNichoAberto } from "@/lib/coletas/haver-nicho";
import {
  detalheCobrancaParaComprovante,
} from "@/lib/coletas/total-cobranca-nicho";
import { createClient } from "@/lib/supabase/client";
import { getEmpresaIdForUser } from "@/lib/supabase/empresa";
import { uploadFotoFuraFura } from "@/lib/storage/coleta-fotos";
import { useVisitaPontoContext } from "@/components/visitas-ponto/useVisitaPontoContext";
import { parseFetchJson } from "@/lib/http/parse-fetch-json";
import { VisitaPontoNav } from "@/components/visitas-ponto/VisitaPontoNav";
import {
  VisitaColetaModoPagamento,
  type VisitaColetaModoFechar,
} from "@/components/visitas-ponto/VisitaColetaModoPagamento";
import {
  calcularColetaFuraFura,
  linksNavegacaoPonto,
  NICHO_MODULO_FURA_FURA,
  validarBrindesContraEstoquePonto,
  validarQuantidadeFurosColeta,
  quantidadeRestanteBrindeNoPonto,
  maxQuantidadeLinhaBrinde,
  labelPontoComPendencia,
  parseBrindesSalvos,
  type ResumoPendenciaPonto,
  type BrindeEntregue,
  type EstoqueBrindePonto,
  type CalculoColetaFuraFuraResult,
} from "@/lib/nichos/fura-fura";
import { agregarDividaCobravelPorPonto, fetchAgregadoDividaCobravelEmpresa } from "@/lib/visitas-ponto/divida-ponto";
import type { RelatorioFuraFuraData } from "@/lib/nichos/fura-fura/relatorio";
import {
  estoqueAvulsosDoKit,
  validarBrindesContraPremiosKit,
  type FuraKitPremio,
  type FuraKitReposicaoItem,
} from "@/lib/nichos/fura-fura/kits";
import type { Ponto } from "@/lib/types/database";
import { getComissaoPercentualNicho } from "@/lib/pontos/comissao-nicho";
import { cn, formatCurrency } from "@/lib/utils";

type PontoFura = Ponto & {
  preco_furo?: number | null;
  furos_estoque?: number | null;
  furos_minimo?: number | null;
  kit_ativo_id?: string | null;
  estoque_brindes?: { item_id?: string; nome: string; quantidade: number; custo_unitario?: number }[];
};

export function NovaColetaFuraFuraForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const submitLock = useSubmitLock();
  const [error, setError] = useState("");
  const [pontos, setPontos] = useState<PontoFura[]>([]);
  const [pendenciasPorPonto, setPendenciasPorPonto] = useState<
    Map<string, ResumoPendenciaPonto>
  >(new Map());
  const [relatorioEnviado, setRelatorioEnviado] = useState(false);
  const [form, setForm] = useState({
    ponto_id: searchParams.get("ponto") ?? "",
    quantidade_furos: "",
    preco_furo: "",
    comissao_percentual: "",
    desconto: "",
    valor_pix: "",
    valor_dinheiro: "",
    brindes_repostos: "",
    brindes_restantes: "",
    observacao: "",
  });
  const editarColetaId =
    searchParams.get("editar_coleta")?.trim() ||
    searchParams.get("editar_visita")?.trim() ||
    "";
  const [editandoCarregado, setEditandoCarregado] = useState(!editarColetaId);
  const [furosOriginaisEdicao, setFurosOriginaisEdicao] = useState(0);
  const [brindesOriginaisEdicao, setBrindesOriginaisEdicao] = useState<BrindeEntregue[]>([]);
  const [fotoUrlExistente, setFotoUrlExistente] = useState<string | null>(null);
  const {
    visitaPontoId,
    emVisitaPonto,
    ensuringVisita,
    voltarAposColeta,
    finalizarVisitaAgora,
    confirmarReceberEncerrar,
    decisaoDialogEl,
  } = useVisitaPontoContext(form.ponto_id);
  const [brindes, setBrindes] = useState<BrindeEntregue[]>([]);
  const [empresaId, setEmpresaId] = useState<string | null>(null);
  const [empresaNome, setEmpresaNome] = useState("Operação");
  const [chavePix, setChavePix] = useState<string | null>(null);
  const [gps, setGps] = useState<{ latitude: number; longitude: number } | null>(null);
  const [fotoFile, setFotoFile] = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);
  const [erroFoto, setErroFoto] = useState("");
  const [ultimaColetaFoto, setUltimaColetaFoto] = useState<UltimaColetaFoto | null>(null);
  const [kitAtivo, setKitAtivo] = useState<{ id: string; nome: string } | null>(null);
  const [premiosKit, setPremiosKit] = useState<FuraKitPremio[]>([]);
  const [reposicaoKit, setReposicaoKit] = useState<FuraKitReposicaoItem[]>([]);
  const [fotosEstoque, setFotosEstoque] = useState<Map<string, string>>(new Map());
  const [modoFecharVisita, setModoFecharVisita] =
    useState<VisitaColetaModoFechar>("continuar");
  const receberAgora = emVisitaPonto && modoFecharVisita === "receber";
  /** Fora da visita multi-nicho, a coleta cobra na hora — Pix/dinheiro devem ir pro servidor. */
  const cobrandoAgora = !emVisitaPonto || receberAgora;
  const [haverSaldo, setHaverSaldo] = useState(0);
  const [descontarHaver, setDescontarHaver] = useState(false);
  const [incluirPendencia, setIncluirPendencia] = useState(false);
  const [sucesso, setSucesso] = useState<{
    coletaId: string;
    relatorioData: RelatorioFuraFuraData;
    valorACobrar: number;
    visitaJaFinalizada: boolean;
  } | null>(null);

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
    async function load() {
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
      setPontos((data as PontoFura[]) ?? []);
      setPendenciasPorPonto(agregarDividaCobravelPorPonto(pendRows ?? []));
      if (empresa?.nome_operacao) setEmpresaNome(empresa.nome_operacao);
      setChavePix(empresa?.chave_pix ?? null);
    }
    load();
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
  }, [empresaId, form.ponto_id]);

  useEffect(() => {
    if (!editarColetaId || !empresaId) return;
    let cancelled = false;
    async function loadColetaEdicao() {
      const supabase = createClient();
      const { data: coleta, error: coletaErr } = await supabase
        .from("coletas")
        .select("*")
        .eq("id", editarColetaId)
        .eq("empresa_id", empresaId)
        .eq("nicho_modulo", NICHO_MODULO_FURA_FURA)
        .maybeSingle();
      if (cancelled) return;
      if (coletaErr || !coleta) {
        setError("Coleta para edição não encontrada.");
        setEditandoCarregado(true);
        return;
      }

      const brindesSalvos = parseBrindesSalvos(coleta.brindes_entregues);
      setFurosOriginaisEdicao(Number(coleta.quantidade_furos ?? 0));
      setBrindesOriginaisEdicao(brindesSalvos);
      setBrindes(brindesSalvos);
      setForm({
        ponto_id: String(coleta.ponto_id ?? ""),
        quantidade_furos: String(coleta.quantidade_furos ?? ""),
        preco_furo: String(coleta.preco_furo ?? ""),
        comissao_percentual: String(coleta.comissao_percentual ?? ""),
        desconto: String(coleta.desconto ?? ""),
        valor_pix: Number(coleta.valor_pix ?? 0) > 0.009 ? String(coleta.valor_pix) : "",
        valor_dinheiro:
          Number(coleta.valor_dinheiro ?? 0) > 0.009 ? String(coleta.valor_dinheiro) : "",
        brindes_repostos: coleta.brindes_repostos != null ? String(coleta.brindes_repostos) : "",
        brindes_restantes:
          coleta.brindes_restantes != null ? String(coleta.brindes_restantes) : "",
        observacao: String(coleta.observacao ?? ""),
      });
      if (coleta.foto_url) {
        setFotoUrlExistente(String(coleta.foto_url));
        setFotoPreview(String(coleta.foto_url));
      }
      setEditandoCarregado(true);
    }
    void loadColetaEdicao();
    return () => {
      cancelled = true;
    };
  }, [editarColetaId, empresaId]);

  const ponto = pontos.find((p) => p.id === form.ponto_id);
  const pendenciaPonto = form.ponto_id ? pendenciasPorPonto.get(form.ponto_id) : undefined;

  useEffect(() => {
    if (!ponto) {
      if (editarColetaId) return;
      setForm((prev) => ({
        ...prev,
        comissao_percentual: "",
        preco_furo: "",
      }));
      setBrindes([]);
      setDescontarHaver(false);
      setIncluirPendencia(false);
      return;
    }
    // Edição: valores já vieram da coleta salva — não sobrescreve nem zera brindes.
    if (editarColetaId) return;
    setForm((prev) => ({
      ...prev,
      comissao_percentual: String(getComissaoPercentualNicho(ponto, "fura_fura")),
      preco_furo: String(ponto.preco_furo ?? 1),
    }));
    setBrindes([]);
    setDescontarHaver(false);
    setIncluirPendencia(false);
  }, [ponto?.id, editarColetaId]);

  useEffect(() => {
    if (!form.ponto_id || !empresaId) {
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
        .eq("ponto_id", form.ponto_id)
        .eq("status", "aberta")
        .ilike("tipo", "haver");
      if (cancelled) return;
      setHaverSaldo(somarHaverNichoAberto(data ?? [], "fura-fura"));
    }
    void loadHaver();
    return () => {
      cancelled = true;
    };
  }, [form.ponto_id, empresaId]);

  useEffect(() => {
    if (!ponto?.kit_ativo_id) {
      setKitAtivo(null);
      setPremiosKit([]);
      setReposicaoKit([]);
      return;
    }
    let cancelled = false;
    fetch(`/api/fura-kits/${ponto.kit_ativo_id}`, { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled || !data.kit) return;
        setKitAtivo({ id: data.kit.id, nome: data.kit.nome });
        setPremiosKit(data.kit.premios ?? []);
        setReposicaoKit(data.kit.reposicao_itens ?? []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [ponto?.kit_ativo_id]);

  const poolBrindesPonto = useMemo((): EstoqueBrindePonto[] => {
    if (!ponto?.estoque_brindes || !Array.isArray(ponto.estoque_brindes)) return [];
    return ponto.estoque_brindes.map((e) => ({
      item_id: e.item_id,
      nome: e.nome,
      quantidade: Math.max(0, Math.floor(Number(e.quantidade) || 0)),
      custo_unitario: Number(e.custo_unitario ?? 0),
    }));
  }, [ponto?.estoque_brindes]);

  const estoqueBrindes = useMemo((): EstoqueBrindePonto[] => {
    const base = kitAtivo
      ? estoqueAvulsosDoKit(premiosKit, poolBrindesPonto, reposicaoKit)
      : poolBrindesPonto;
    if (!editarColetaId || brindesOriginaisEdicao.length === 0) return base;
    // Devolve ao pool o que a coleta original já tinha baixado (só pra validar a edição).
    const next = base.map((e) => ({ ...e }));
    for (const b of brindesOriginaisEdicao) {
      const idx = b.item_id
        ? next.findIndex((e) => e.item_id === b.item_id)
        : next.findIndex((e) => e.nome === b.nome);
      if (idx >= 0) {
        next[idx].quantidade = Math.max(0, (next[idx].quantidade ?? 0) + b.quantidade);
      }
    }
    return next;
  }, [kitAtivo, premiosKit, poolBrindesPonto, reposicaoKit, editarColetaId, brindesOriginaisEdicao]);

  const furosEstoqueParaValidar =
    ponto?.furos_estoque != null
      ? Math.max(0, Number(ponto.furos_estoque) + (editarColetaId ? furosOriginaisEdicao : 0))
      : null;

  useEffect(() => {
    if (!empresaId) return;
    let cancelled = false;
    async function loadFotos() {
      const supabase = createClient();
      const { data } = await supabase
        .from("estoque")
        .select("id, foto_url")
        .eq("empresa_id", empresaId)
        .not("foto_url", "is", null);
      if (cancelled) return;
      const map = new Map<string, string>();
      for (const row of data ?? []) {
        if (row.foto_url) map.set(row.id, row.foto_url);
      }
      setFotosEstoque(map);
    }
    void loadFotos();
    return () => {
      cancelled = true;
    };
  }, [empresaId]);

  useEffect(() => {
    if (!form.ponto_id || !empresaId) {
      setUltimaColetaFoto(null);
      return;
    }

    let cancelled = false;

    async function loadUltimaFoto() {
      const supabase = createClient();
      const pontoId = form.ponto_id;
      const eid = empresaId as string;

      const aplicar = (foto_url: string | null | undefined, created_at: string) => {
        const url = String(foto_url ?? "").trim();
        if (!url || cancelled) return false;
        setUltimaColetaFoto({ foto_url: url, created_at });
        return true;
      };

      // 1) Última coleta fura-fura com foto
      const { data: coletaNicho } = await supabase
        .from("coletas")
        .select("foto_url, created_at")
        .eq("empresa_id", eid)
        .eq("ponto_id", pontoId)
        .eq("nicho_modulo", NICHO_MODULO_FURA_FURA)
        .not("foto_url", "is", null)
        .order("created_at", { ascending: false })
        .limit(8);

      if (cancelled) return;
      for (const row of coletaNicho ?? []) {
        if (aplicar(row.foto_url, row.created_at)) return;
      }

      // 2) Legado: coletas do ponto com furos (antes do nicho_modulo)
      const { data: coletaLegado } = await supabase
        .from("coletas")
        .select("foto_url, created_at, quantidade_furos, nicho_modulo")
        .eq("empresa_id", eid)
        .eq("ponto_id", pontoId)
        .not("foto_url", "is", null)
        .not("quantidade_furos", "is", null)
        .order("created_at", { ascending: false })
        .limit(8);

      if (cancelled) return;
      for (const row of coletaLegado ?? []) {
        const nicho = row.nicho_modulo;
        if (nicho && nicho !== NICHO_MODULO_FURA_FURA) continue;
        if (aplicar(row.foto_url, row.created_at)) return;
      }

      // 3) Fallback: foto salva no equipamento fura-fura do ponto
      const { data: eqs } = await supabase
        .from("equipamentos")
        .select("foto_url, created_at")
        .eq("empresa_id", eid)
        .eq("ponto_id", pontoId)
        .eq("tipo", "fura_fura")
        .not("foto_url", "is", null)
        .order("created_at", { ascending: false })
        .limit(5);

      if (cancelled) return;
      for (const eq of eqs ?? []) {
        if (aplicar(eq.foto_url, eq.created_at ?? new Date().toISOString())) {
          return;
        }
      }

      if (!cancelled) setUltimaColetaFoto(null);
    }

    void loadUltimaFoto();

    return () => {
      cancelled = true;
    };
  }, [form.ponto_id, empresaId]);

  const valorRecebido =
    emVisitaPonto && !receberAgora
      ? 0
      : parseMoneyInput(form.valor_pix) + parseMoneyInput(form.valor_dinheiro);

  const calculo = useMemo(
    () =>
      calcularColetaFuraFura({
        quantidadeFuros: Number(form.quantidade_furos) || 0,
        // Sem ponto: não inventa preço R$ 1 nem comissão — evita soma fantasma.
        precoFuro: ponto
          ? Number(form.preco_furo) || Number(ponto.preco_furo ?? 0)
          : 0,
        comissaoPercentual: ponto ? Number(form.comissao_percentual) || 0 : 0,
        desconto: Number(form.desconto) || 0,
        brindes,
        valorPagoRecebido: valorRecebido,
      }),
    [form, brindes, ponto, valorRecebido]
  );

  const cobrancaComprovante = useMemo(() => {
    if (emVisitaPonto && !receberAgora) {
      return { totalACobrar: calculo.valorAReceber, cobranca: null };
    }
    return detalheCobrancaParaComprovante({
      valorOperacao: calculo.valorAReceber,
      pendenciaSaldo: pendenciaPonto?.totalPendente ?? 0,
      incluirPendencia,
      haverSaldo,
      descontarHaver,
    });
  }, [
    emVisitaPonto,
    receberAgora,
    calculo.valorAReceber,
    pendenciaPonto?.totalPendente,
    incluirPendencia,
    haverSaldo,
    descontarHaver,
  ]);
  const totalACobrarAgora = cobrancaComprovante.totalACobrar;

  function update(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function addBrindeFromEstoque(item: EstoqueBrindePonto) {
    setBrindes((prev) => {
      const restante = quantidadeRestanteBrindeNoPonto(estoqueBrindes, prev, item);
      if (restante <= 0) return prev;

      const key = item.item_id ?? item.nome;
      const idx = prev.findIndex((b) => (b.item_id ?? b.nome) === key);
      if (idx >= 0) {
        return prev.map((b, j) => (j === idx ? { ...b, quantidade: b.quantidade + 1 } : b));
      }
      return [
        ...prev,
        {
          item_id: item.item_id,
          nome: item.nome,
          quantidade: 1,
          custo_unitario: Number(item.custo_unitario ?? 0),
        },
      ];
    });
  }

  function updateBrindeQuantidade(index: number, raw: string) {
    const max = maxQuantidadeLinhaBrinde(estoqueBrindes, brindes, index);
    if (max <= 0) return;
    const qty = Math.min(Math.max(1, Math.floor(Number(raw) || 1)), max);
    setBrindes((prev) =>
      prev.map((x, j) => (j === index ? { ...x, quantidade: qty } : x))
    );
  }

  function handleFotoChange(file: File | null) {
    if (fotoPreview && fotoPreview.startsWith("blob:")) URL.revokeObjectURL(fotoPreview);
    setFotoFile(file);
    setFotoPreview(file ? URL.createObjectURL(file) : fotoUrlExistente);
    setErroFoto("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.ponto_id) {
      setError("Selecione um ponto.");
      return;
    }
    if (calculo.quantidadeFuros <= 0) {
      setError("Informe a quantidade de furos.");
      return;
    }
    const temFoto = Boolean(fotoFile) || Boolean(fotoUrlExistente);
    if (!temFoto) {
      setErroFoto("Foto obrigatória");
      setError("Tire a foto da máquina antes de registrar.");
      return;
    }
    if (!empresaId) {
      setError("Empresa não encontrada.");
      return;
    }

    const erroBrindes = kitAtivo
      ? validarBrindesContraPremiosKit(brindes, premiosKit, estoqueBrindes, reposicaoKit)
      : validarBrindesContraEstoquePonto(brindes, estoqueBrindes);
    if (erroBrindes) {
      setError(erroBrindes);
      return;
    }

    const erroFuros = validarQuantidadeFurosColeta(
      calculo.quantidadeFuros,
      furosEstoqueParaValidar
    );
    if (erroFuros) {
      setError(erroFuros);
      return;
    }

    let fecharVisitaAgora = false;
    if (receberAgora && !editarColetaId) {
      const decisao = await confirmarReceberEncerrar();
      if (decisao === "abortar") return;
      fecharVisitaAgora = decisao === "encerrar";
    }

    if (loading || !!sucesso || !submitLock.tryLock()) return;
    setLoading(true);
    setError("");
    let concluido = false;

    try {
      const supabase = createClient();
      let fotoUrl = fotoUrlExistente;
      if (fotoFile) {
        fotoUrl = await uploadFotoFuraFura(supabase, empresaId, form.ponto_id, fotoFile);
      }
      if (!fotoUrl) {
        setErroFoto("Foto obrigatória");
        setError("Tire a foto da máquina antes de registrar.");
        return;
      }

      let visitaPontoParaSalvar = visitaPontoId || null;
      if (editarColetaId) {
        // POST (não DELETE): evita 405 em alguns proxies / abertura acidental da API no browser.
        const delRes = await fetch(`/api/coletas/fura-fura/${editarColetaId}`, {
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

      const res = await fetch("/api/coletas/fura-fura", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          valor_pix: cobrandoAgora ? form.valor_pix : "",
          valor_dinheiro: cobrandoAgora ? form.valor_dinheiro : "",
          brindes,
          relatorio_enviado: relatorioEnviado,
          foto_url: fotoUrl,
          latitude: gps?.latitude ?? null,
          longitude: gps?.longitude ?? null,
          visita_ponto_id: visitaPontoParaSalvar,
          receber_agora: receberAgora,
          descontar_haver_na_cobranca: cobrandoAgora && descontarHaver,
          incluir_pendencia_operacao: cobrandoAgora && incluirPendencia,
          religar_visita_finalizada: Boolean(editarColetaId && visitaPontoParaSalvar),
          editando_coleta: Boolean(editarColetaId),
        }),
      });
      const data = await parseFetchJson<{
        error?: string;
        id?: string;
        calculo?: CalculoColetaFuraFuraResult;
        ponto?: { nome?: string; whatsapp?: string | null };
      }>(res);
      if (!res.ok) {
        setError(data.error ?? "Erro ao registrar coleta.");
        return;
      }

      if (fecharVisitaAgora) {
        await finalizarVisitaAgora({
          pix: parseMoneyInput(form.valor_pix),
          dinheiro: parseMoneyInput(form.valor_dinheiro),
          desconto: parseMoneyInput(form.desconto),
          somenteFechar: true,
        });
      }

      const calculoSalvo: CalculoColetaFuraFuraResult =
        data.calculo && typeof data.calculo === "object"
          ? { ...calculo, ...data.calculo }
          : calculo;

      setSucesso({
        coletaId: String(data.id ?? ""),
        relatorioData: {
          empresaNome,
          pontoNome: ponto?.nome ?? data.ponto?.nome ?? "Ponto",
          pontoWhatsapp: ponto?.whatsapp ?? data.ponto?.whatsapp ?? null,
          data: new Date(),
          previa: false,
          calculo: calculoSalvo,
          kitNome: kitAtivo?.nome ?? null,
          fotoUrl,
          cobranca: cobrancaComprovante.cobranca,
        },
        valorACobrar: totalACobrarAgora,
        visitaJaFinalizada: fecharVisitaAgora,
      });
      concluido = true;

      // Evita F5 reabrir a coleta já salva.
      {
        const params = new URLSearchParams();
        if (form.ponto_id) params.set("ponto", form.ponto_id);
        if (visitaPontoId && !fecharVisitaAgora) {
          params.set("visita_ponto", visitaPontoId);
        }
        router.replace(
          params.toString()
            ? `/coletas/nova/fura-fura?${params.toString()}`
            : "/coletas/nova/fura-fura"
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro de conexão.");
    } finally {
      setLoading(false);
      if (!concluido) submitLock.unlock();
    }
  }

  function handleConcluirSucesso() {
    const jaFinalizada = sucesso?.visitaJaFinalizada === true;
    setSucesso(null);
    voltarAposColeta(jaFinalizada ? { visitaJaFinalizada: true } : undefined);
  }

  const navLinks = ponto ? linksNavegacaoPonto(ponto) : null;
  const maxFuros =
    furosEstoqueParaValidar != null ? Math.max(0, furosEstoqueParaValidar) : null;
  const erroFurosForm =
    ponto && calculo.quantidadeFuros > 0
      ? validarQuantidadeFurosColeta(calculo.quantidadeFuros, furosEstoqueParaValidar)
      : null;

  if (editarColetaId && !editandoCarregado) {
    return (
      <ColetaNovaPageShell title="Editar coleta fura-fura" subtitle="Carregando coleta…" backHref="/coletas">
        <p className="text-sm text-at-muted">Carregando dados da coleta…</p>
      </ColetaNovaPageShell>
    );
  }

  return (
    <ColetaNovaPageShell
      title={editarColetaId ? "Editar coleta fura-fura" : "Coleta fura-fura"}
      subtitle={
        editarColetaId
          ? "Corrigir furos, brindes e valores — salva no lugar da coleta anterior."
          : ensuringVisita
          ? "Entrando na visita do ponto…"
          : emVisitaPonto
            ? "Furos, foto e brindes — Salvar e seguir ou Receber agora."
            : "Furos, foto e brindes — pagamento opcional no painel à direita."
      }
      backHref={emVisitaPonto ? `/visitas-ponto/${visitaPontoId}` : "/coletas"}
      topSlot={
        emVisitaPonto ? (
          <VisitaPontoNav visitaPontoId={visitaPontoId} pontoId={form.ponto_id || undefined} active="fura_fura" />
        ) : ensuringVisita ? (
          <div className="rounded-xl border border-primary-neon/20 bg-primary-neon/5 px-3 py-2 text-xs text-at-muted">
            Preparando visita multi-nicho…
          </div>
        ) : undefined
      }
    >
      <form
        onSubmit={handleSubmit}
        method="post"
        action="#"
        noValidate
        className="space-y-5"
      >
        <ColetaPontoBar
          pontoField={
            <ColetaPontoSearchSelect
              label="Ponto *"
              value={form.ponto_id}
              onChange={(id) => {
                if (editarColetaId) return;
                update("ponto_id", id);
              }}
              options={pontos.map((p) => ({
                value: p.id,
                label: labelPontoComPendencia(
                  p.nome,
                  pendenciasPorPonto.get(p.id),
                  formatCurrency
                ),
              }))}
              placeholder={
                editarColetaId ? "Ponto da coleta (não alterável)" : "Digite para buscar o ponto…"
              }
            />
          }
          comissaoField={
            ponto ? (
              <FormInput
                label="Comissão (%)"
                type="number"
                step="0.01"
                value={form.comissao_percentual}
                onChange={(e) => update("comissao_percentual", e.target.value)}
              />
            ) : undefined
          }
          alert={
            ponto ? (
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
                <PontoFuraAlertas ponto={ponto} />
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-at-muted">
                  {ponto.furos_estoque != null && (
                    <span>
                      Furos na máquina:{" "}
                      <strong className="text-at-primary/85">{ponto.furos_estoque}</strong>
                    </span>
                  )}
                  {gps && <span className="text-green-500/80 text-xs">GPS capturado</span>}
                  <AbrirChamadoButton
                    pontoId={ponto.id}
                    equipamentoNome={ponto.nome}
                    variant="icon"
                    className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20"
                  />
                </div>
                {navLinks && (
                  <div className="flex flex-wrap gap-2">
                    <a
                      href={navLinks.waze}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium text-at-primary/85 hover:border-primary-neon/40 hover:text-primary-neon"
                    >
                      <Navigation className="h-3.5 w-3.5" />
                      Waze
                    </a>
                    <a
                      href={navLinks.google}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium text-at-primary/85 hover:border-primary-neon/40 hover:text-primary-neon"
                    >
                      <Navigation className="h-3.5 w-3.5" />
                      Google Maps
                    </a>
                  </div>
                )}
              </div>
            ) : undefined
          }
        />

        <ColetaNovaGrid
          operacao={
            <ColetaOperacaoSection title="Dados da coleta">
              <div className="glass-card space-y-4 p-4 sm:p-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1">
                    <FormInput
                      label="Furos utilizados *"
                      type="number"
                      min={0}
                      max={maxFuros ?? undefined}
                      value={form.quantidade_furos}
                      onChange={(e) => update("quantidade_furos", e.target.value)}
                    />
                    {maxFuros != null && (
                      <p className="text-xs text-at-muted">
                        Máximo: <strong className="text-at-muted">{maxFuros}</strong> furos na
                        máquina
                        {ponto?.furos_minimo != null && ponto.furos_minimo > 0 && (
                          <> (mín. operacional: {ponto.furos_minimo})</>
                        )}
                      </p>
                    )}
                    {erroFurosForm && <p className="text-xs text-red-400">{erroFurosForm}</p>}
                  </div>
                  <FormInput
                    label="Preço por furo (R$)"
                    type="number"
                    step="0.01"
                    min={0}
                    value={form.preco_furo}
                    onChange={(e) => update("preco_furo", e.target.value)}
                  />
                </div>
              </div>

              <div className="glass-card p-4 sm:p-5">
                <FotoColetaFuraFura
                  preview={fotoPreview}
                  onChange={handleFotoChange}
                  erro={erroFoto}
                  ultimaColeta={ultimaColetaFoto}
                />
              </div>

              <div className="glass-card space-y-4 p-4 sm:p-5">
          <div>
            <h3 className="text-sm font-medium text-at-primary/85">Prêmios entregues</h3>
            {kitAtivo ? (
              <p className="text-xs text-cyan-400/90 mt-1">
                Kit ativo: {kitAtivo.nome} — toque no prêmio que o cliente ganhou (baixa no
                pool do ponto).
              </p>
            ) : (
              <p className="text-xs text-at-muted mt-1">
                Toque no item alocado no ponto. A quantidade não pode ultrapassar o estoque.
              </p>
            )}
          </div>

          {estoqueBrindes.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {estoqueBrindes.map((item) => {
                const restante = quantidadeRestanteBrindeNoPonto(estoqueBrindes, brindes, item);
                const foto = item.item_id ? fotosEstoque.get(item.item_id) : undefined;
                const semEstoque = item.quantidade <= 0 || restante <= 0;
                return (
                  <button
                    key={item.item_id ?? item.nome}
                    type="button"
                    disabled={semEstoque}
                    onClick={() => addBrindeFromEstoque(item)}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-lg border px-2 py-1.5 text-xs transition",
                      semEstoque
                        ? "cursor-not-allowed border-slate-800 text-at-soft"
                        : "border-slate-700 text-at-primary/85 hover:border-primary-neon/40 hover:text-primary-neon"
                    )}
                  >
                    {foto ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={foto}
                        alt=""
                        className="h-8 w-8 shrink-0 rounded-md object-cover"
                      />
                    ) : (
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-slate-800 bg-slate-900">
                        <ImageIcon className="h-3.5 w-3.5 text-at-soft" />
                      </span>
                    )}
                    <span className="text-left leading-tight">
                      <span className="block font-medium">+ {item.nome}</span>
                      <span className="text-[10px] text-at-muted">
                        {item.quantidade <= 0
                          ? "0 no ponto"
                          : `${restante}/${item.quantidade} no ponto`}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="text-xs italic text-at-soft">
              {kitAtivo
                ? "Este kit não tem itens na composição, ou o pool do ponto está vazio. Realoque o kit em Pontos."
                : "Nenhum brinde alocado neste ponto. Alocar em Pontos → configuração fura-fura."}
            </p>
          )}

          {brindes.length === 0 ? (
            <p className="text-xs text-at-muted">
              {estoqueBrindes.some((i) => i.quantidade > 0)
                ? "Nenhum prêmio registrado ainda — toque em um item acima."
                : "Nenhum brinde nesta coleta."}
            </p>
          ) : (
            <div className="space-y-2">
              {brindes.map((b, i) => {
                const maxQtd = maxQuantidadeLinhaBrinde(estoqueBrindes, brindes, i);
                const foto = b.item_id ? fotosEstoque.get(b.item_id) : undefined;
                return (
                  <div key={i} className="grid gap-2 sm:grid-cols-[auto_1fr_1fr_1fr_auto] items-end">
                    {foto ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={foto}
                        alt=""
                        className="mb-0.5 h-10 w-10 rounded-md object-cover"
                      />
                    ) : (
                      <span className="mb-0.5 flex h-10 w-10 items-center justify-center rounded-md border border-slate-800 bg-slate-900">
                        <ImageIcon className="h-4 w-4 text-at-soft" />
                      </span>
                    )}
                    <FormInput label="Item" value={b.nome} readOnly />
                    <FormInput
                      label={`Qtd (máx. ${maxQtd})`}
                      type="number"
                      min={1}
                      max={maxQtd}
                      value={String(b.quantidade)}
                      onChange={(e) => updateBrindeQuantidade(i, e.target.value)}
                    />
                    <FormInput
                      label="Custo un."
                      type="number"
                      step="0.01"
                      value={String(b.custo_unitario)}
                      readOnly
                    />
                    <button
                      type="button"
                      onClick={() => setBrindes((prev) => prev.filter((_, j) => j !== i))}
                      className="rounded-lg p-2 text-red-400 hover:bg-red-500/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

                <div className="grid gap-4 sm:grid-cols-2">
                  <FormInput
                    label="Brindes repostos"
                    type="number"
                    value={form.brindes_repostos}
                    onChange={(e) => update("brindes_repostos", e.target.value)}
                  />
                  <FormInput
                    label="Brindes restantes"
                    type="number"
                    value={form.brindes_restantes}
                    onChange={(e) => update("brindes_restantes", e.target.value)}
                  />
                </div>
              </div>
            </ColetaOperacaoSection>
          }
          fechar={
            <FecharColetaPanel
              empty={
                !ponto ? (
                  <p className="rounded-lg border border-dashed border-slate-700 bg-slate-950/30 px-3 py-4 text-sm text-at-muted">
                    Selecione o ponto para carregar comissão, preço do furo e o resumo.
                  </p>
                ) : calculo.quantidadeFuros <= 0 ? (
                  <p className="rounded-lg border border-dashed border-slate-700 bg-slate-950/30 px-3 py-4 text-sm text-at-muted">
                    Informe a quantidade de furos para ver o resumo e registrar o pagamento.
                  </p>
                ) : undefined
              }
              resumo={
                ponto && calculo.quantidadeFuros > 0 ? (
                  <ColetaFuraFuraResumo
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
                      desconto: form.desconto,
                      pix: form.valor_pix,
                      dinheiro: form.valor_dinheiro,
                      onDescontoChange: (v) => update("desconto", v),
                      onPixChange: (v) => update("valor_pix", v),
                      onDinheiroChange: (v) => update("valor_dinheiro", v),
                    }}
                  />
                ) : undefined
              }
              previa={
                ponto && calculo.quantidadeFuros > 0 ? (
                  <ColetaPreviaSection>
                    <PreviaRelatorioFuraFuraPanel
                      embedded
                      chavePix={chavePix}
                      valorACobrar={totalACobrarAgora}
                      data={{
                        empresaNome,
                        pontoNome: ponto.nome,
                        pontoWhatsapp: ponto.whatsapp,
                        data: new Date(),
                        previa: true,
                        calculo,
                        kitNome: kitAtivo?.nome ?? null,
                        fotoUrl: fotoPreview,
                        cobranca: cobrancaComprovante.cobranca,
                      }}
                    />
                  </ColetaPreviaSection>
                ) : undefined
              }
              observacao
              observacaoValue={form.observacao}
              onObservacaoChange={(v) => update("observacao", v)}
              error={error}
              submitLabel={
                editarColetaId
                  ? "Salvar correção"
                  : emVisitaPonto
                    ? receberAgora
                      ? "Receber agora"
                      : "Salvar e seguir"
                    : "Salvar coleta fura-fura"
              }
              submitDisabled={Boolean(erroFurosForm) || !!sucesso}
              loading={loading}
            />
          }
        />
      </form>

      {sucesso && (
        <ColetaFuraFuraSucessoModal
          open
          data={sucesso.relatorioData}
          coletaId={sucesso.coletaId}
          visitaPontoId={visitaPontoId || null}
          chavePix={chavePix}
          valorACobrar={sucesso.valorACobrar}
          onClose={handleConcluirSucesso}
        />
      )}

      {decisaoDialogEl}

      <LoadingOverlay
        show={loading}
        messages={["Enviando foto...", "Registrando coleta...", "Atualizando estoque..."]}
      />
    </ColetaNovaPageShell>
  );
}

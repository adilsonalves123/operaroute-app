"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import dynamic from "next/dynamic";
import {
  ArrowLeft,
  CheckSquare,
  ExternalLink,
  LocateFixed,
  Loader2,
  MapPin,
  Maximize2,
  MessageCircle,
  Minimize2,
  Navigation,
  Route,
  Send,
  Sparkles,
  Square,
} from "lucide-react";
import {
  alertasPontoFura,
  diasDesdeColeta,
  prioridadeRotaPonto,
} from "@/lib/nichos/fura-fura";
import { scoreChamadoRota, type ChamadoResumoPonto } from "@/lib/chamados/resumo";
import {
  linkGoogleMapsRota,
  moverParadaNaLista,
  otimizarParadasRestantes,
  otimizarRota,
  type Coordenada,
  type ParadaRota,
  type PontoRotaInput,
} from "@/lib/rotas/otimizar-rota";
import {
  paradasFromOrdemSalva,
  rotasDoOperador,
  type OperadorRotaOpcao,
  type RotaSalva,
} from "@/lib/rotas/rotas-salvas";
import {
  montarMensagemRotaWhatsApp,
  whatsAppUrlRota,
} from "@/lib/rotas/whatsapp-rota";
import { RotasBoard } from "./RotasBoard";
import { MinhaRotaPainel } from "./MinhaRotaPainel";
import { EnviarRotaModal, EnviarRotaWizardFields } from "./EnviarRotaModal";
import { ParadasOrdenaveisList } from "./ParadasOrdenaveisList";
import type { Ponto } from "@/lib/types/database";
import { cn, formatDate } from "@/lib/utils";
import { buscarRotaOsrm } from "@/lib/rotas/osrm";

const RotaMapaAvancado = dynamic(
  () => import("./RotaMapaAvancado").then((m) => m.RotaMapaAvancado),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[420px] items-center justify-center rounded-xl border border-white/[0.08] bg-slate-900/50 text-sm text-slate-500">
        Carregando mapa…
      </div>
    ),
  }
);

const NavegacaoRotaView = dynamic(
  () => import("./NavegacaoRotaView").then((m) => m.NavegacaoRotaView),
  { ssr: false }
);

export type PontoRotaEnriquecido = Ponto & {
  fotoExibir?: string | null;
  pendente?: number;
  chamadosAbertos?: ChamadoResumoPonto[];
};

type ModoGestor = "board" | "wizard" | "detalhe";
type WizardStep = 1 | 2 | 3;

function toInput(p: PontoRotaEnriquecido): PontoRotaInput {
  const chamados = p.chamadosAbertos ?? [];
  return {
    id: p.id,
    nome: p.nome,
    latitude: p.latitude,
    longitude: p.longitude,
    fotoUrl: p.fotoExibir ?? p.foto_url,
    endereco: p.endereco,
    cidade: p.cidade,
    scorePrioridade: prioridadeRotaPonto(p) + scoreChamadoRota(chamados),
    pendente: p.pendente,
  };
}

export function RotaInteligenteClient({
  pontos,
  rotasSalvas: rotasSalvasInicial,
  operadores,
  podeGerenciarRotas,
  userId,
  chamadosAbertos = 0,
}: {
  pontos: PontoRotaEnriquecido[];
  rotasSalvas: RotaSalva[];
  operadores: OperadorRotaOpcao[];
  podeGerenciarRotas: boolean;
  userId: string;
  chamadosAbertos?: number;
}) {
  const router = useRouter();
  const [modo, setModo] = useState<ModoGestor>("board");
  const [wizardStep, setWizardStep] = useState<WizardStep>(1);
  const [selecionados, setSelecionados] = useState<Set<string>>(
    () => new Set(pontos.map((p) => p.id))
  );
  const [paradas, setParadas] = useState<ParadaRota[] | null>(null);
  const [distanciaKm, setDistanciaKm] = useState<number | null>(null);
  const [inicio, setInicio] = useState<Coordenada | null>(null);
  const [gpsStatus, setGpsStatus] = useState<"idle" | "loading" | "ok" | "erro">("idle");
  const [paradaAtiva, setParadaAtiva] = useState<string | null>(null);
  const [filtroCidade, setFiltroCidade] = useState<string>("");
  const [rotaAtiva, setRotaAtiva] = useState<RotaSalva | null>(null);
  const [rotasSalvas, setRotasSalvas] = useState(rotasSalvasInicial);
  const [mapaExpandido, setMapaExpandido] = useState(false);
  const [navegando, setNavegando] = useState(false);
  const [rotaRuas, setRotaRuas] = useState<[number, number][] | null>(null);
  const [portalReady, setPortalReady] = useState(false);
  const [enviarRota, setEnviarRota] = useState<RotaSalva | null>(null);
  const [nomeNova, setNomeNova] = useState("");
  const [operadorNova, setOperadorNova] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [msgWizard, setMsgWizard] = useState("");

  useEffect(() => {
    setPortalReady(true);
  }, []);

  useEffect(() => {
    if (!mapaExpandido) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mapaExpandido]);

  useEffect(() => {
    setRotasSalvas(rotasSalvasInicial);
  }, [rotasSalvasInicial]);

  const cidades = useMemo(() => {
    const set = new Set(pontos.map((p) => p.cidade).filter(Boolean) as string[]);
    return Array.from(set).sort();
  }, [pontos]);

  useEffect(() => {
    if (!cidades.length) return;
    if (!filtroCidade || !cidades.includes(filtroCidade)) {
      const primeira = cidades[0];
      setFiltroCidade(primeira);
      setSelecionados(new Set(pontos.filter((p) => p.cidade === primeira).map((p) => p.id)));
    }
  }, [cidades, filtroCidade, pontos]);

  const pontosPorId = useMemo(() => {
    const map = new Map<string, { nome: string; cidade?: string | null; endereco?: string | null }>();
    for (const p of pontos) {
      map.set(p.id, { nome: p.nome, cidade: p.cidade, endereco: p.endereco });
    }
    return map;
  }, [pontos]);

  const pontosFiltrados = useMemo(
    () => (filtroCidade ? pontos.filter((p) => p.cidade === filtroCidade) : []),
    [pontos, filtroCidade]
  );

  function mudarCidade(cidade: string) {
    setFiltroCidade(cidade);
    setSelecionados(new Set(pontos.filter((p) => p.cidade === cidade).map((p) => p.id)));
    setParadas(null);
    setRotaAtiva(null);
  }

  const capturarGps = useCallback(() => {
    if (!navigator.geolocation) {
      setGpsStatus("erro");
      return;
    }
    setGpsStatus("loading");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setInicio({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
        setGpsStatus("ok");
      },
      () => setGpsStatus("erro"),
      { enableHighAccuracy: true, timeout: 12000 }
    );
  }, []);

  useEffect(() => {
    capturarGps();
  }, [capturarGps]);

  function togglePonto(id: string) {
    setSelecionados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setParadas(null);
  }

  function toggleTodos() {
    const ids = pontosFiltrados.map((p) => p.id);
    const todosMarcados = ids.every((id) => selecionados.has(id));
    setSelecionados((prev) => {
      const next = new Set(prev);
      if (todosMarcados) ids.forEach((id) => next.delete(id));
      else ids.forEach((id) => next.add(id));
      return next;
    });
    setParadas(null);
  }

  function otimizar() {
    const escolhidos = pontosFiltrados.filter((p) => selecionados.has(p.id)).map(toInput);
    if (escolhidos.length === 0) return;
    const resultado = otimizarRota(escolhidos, inicio);
    setParadas(resultado.paradas);
    setDistanciaKm(resultado.distanciaTotalKm);
    setParadaAtiva(null);
    setRotaRuas(null);
    setRotaAtiva(null);
    setWizardStep(2);
  }

  function iniciarWizard() {
    setModo("wizard");
    setWizardStep(1);
    setParadas(null);
    setRotaAtiva(null);
    setNomeNova(`Rota ${new Date().toLocaleDateString("pt-BR")}`);
    setOperadorNova("");
    setMsgWizard("");
    if (filtroCidade) {
      setSelecionados(new Set(pontos.filter((p) => p.cidade === filtroCidade).map((p) => p.id)));
    }
  }

  function voltarBoard() {
    setModo("board");
    setWizardStep(1);
    setParadas(null);
    setRotaAtiva(null);
    setNavegando(false);
    setMsgWizard("");
  }

  function carregarRotaSalva(rota: RotaSalva) {
    if (rota.cidade) setFiltroCidade(rota.cidade);
    const inputs = pontos.map(toInput);
    const { paradas: carregadas, distanciaTotalKm: dist } = paradasFromOrdemSalva(
      inputs,
      rota.paradas.map((p) => ({ ponto_id: p.ponto_id, ordem: p.ordem })),
      inicio
    );
    const statusPorPonto = new Map(rota.paradas.map((p) => [p.ponto_id, p]));
    const enriquecidas = carregadas.map((p) => {
      const rp = statusPorPonto.get(p.id);
      return {
        ...p,
        rotaParadaId: rp?.id,
        statusParada: rp?.status ?? "pendente",
      };
    });
    setSelecionados(new Set(rota.paradas.map((p) => p.ponto_id)));
    setParadas(enriquecidas);
    setDistanciaKm(dist);
    setParadaAtiva(null);
    setRotaRuas(null);
    setRotaAtiva(rota);
  }

  function executarRota(rota: RotaSalva, abrirNavegacao = false) {
    carregarRotaSalva(rota);
    if (podeGerenciarRotas) setModo("detalhe");
    if (abrirNavegacao) setNavegando(true);
  }

  async function persistirOrdemParadas(novasParadas: ParadaRota[]) {
    if (!rotaAtiva) return;
    const itens = novasParadas
      .filter((p) => p.rotaParadaId)
      .map((p) => ({ parada_id: p.rotaParadaId!, ordem: p.ordem }));
    if (itens.length === 0) return;

    await fetch(`/api/rotas/${rotaAtiva.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reordenar", paradas: itens }),
    });

    setRotaAtiva((prev) => {
      if (!prev) return prev;
      const ordemPorId = new Map(itens.map((i) => [i.parada_id, i.ordem]));
      return {
        ...prev,
        paradas: [...prev.paradas]
          .map((p) => ({ ...p, ordem: ordemPorId.get(p.id) ?? p.ordem }))
          .sort((a, b) => a.ordem - b.ordem),
      };
    });
  }

  function aplicarResultadoParadas(novasParadas: ParadaRota[], distancia: number) {
    setParadas(novasParadas);
    setDistanciaKm(distancia);
    setRotaRuas(null);
    void persistirOrdemParadas(novasParadas);
  }

  function moverParada(index: number, direcao: "up" | "down") {
    if (!paradas) return;
    const resultado = moverParadaNaLista(paradas, index, direcao, inicio);
    if (resultado) aplicarResultadoParadas(resultado.paradas, resultado.distanciaTotalKm);
  }

  function otimizarRestantes() {
    if (!paradas) return;
    const resultado = otimizarParadasRestantes(paradas, inicio);
    aplicarResultadoParadas(resultado.paradas, resultado.distanciaTotalKm);
  }

  async function marcarParadaAvancada(pontoId: string, pulada: boolean) {
    if (!rotaAtiva) return;
    const parada = rotaAtiva.paradas.find((p) => p.ponto_id === pontoId);
    if (!parada) return;

    await fetch(`/api/rotas/${rotaAtiva.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "concluir_parada",
        parada_id: parada.id,
        status: pulada ? "pulada" : "concluida",
      }),
    });

    setParadas(
      (prev) =>
        prev?.map((p) =>
          p.id === pontoId ? { ...p, statusParada: pulada ? "pulada" : "concluida" } : p
        ) ?? null
    );

    setRotaAtiva((prev) => {
      if (!prev) return prev;
      const paradasAtualizadas = prev.paradas.map((p) =>
        p.id === parada.id ? { ...p, status: pulada ? "pulada" : "concluida" } : p
      );
      const pendentes = paradasAtualizadas.filter((p) => p.status === "pendente").length;
      return {
        ...prev,
        status: pendentes === 0 ? "concluida" : prev.status,
        paradas: paradasAtualizadas,
      };
    });
    router.refresh();
  }

  async function excluirRota(id: string) {
    const res = await fetch(`/api/rotas/${id}`, { method: "DELETE" });
    if (!res.ok) return;
    setRotasSalvas((prev) => prev.filter((r) => r.id !== id));
    if (rotaAtiva?.id === id) voltarBoard();
    router.refresh();
  }

  async function salvarNovaRota(abrirWhatsApp: boolean) {
    if (!paradas?.length) {
      setMsgWizard("Otimize a ordem antes de salvar.");
      return;
    }
    if (!nomeNova.trim()) {
      setMsgWizard("Informe o nome da rota.");
      return;
    }
    if (!filtroCidade) {
      setMsgWizard("Selecione uma cidade.");
      return;
    }
    if (!operadorNova) {
      setMsgWizard("Selecione o ajudante.");
      return;
    }

    setSalvando(true);
    setMsgWizard("");
    try {
      const res = await fetch("/api/rotas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: nomeNova.trim(),
          operador_id: operadorNova,
          cidade: filtroCidade,
          paradas: paradas.map((p) => ({ ponto_id: p.id, ordem: p.ordem })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsgWizard(data.error ?? "Erro ao salvar.");
        return;
      }

      const rotaCriada = data.rota as RotaSalva;
      setRotasSalvas((prev) => [rotaCriada, ...prev]);

      if (abrirWhatsApp) {
        const op = operadores.find((o) => o.userId === operadorNova);
        const mapsUrl = linkGoogleMapsRota(paradas, inicio);
        const texto = montarMensagemRotaWhatsApp({
          nomeRota: rotaCriada.nome,
          cidade: rotaCriada.cidade,
          paradas: paradas.map((p) => ({
            ordem: p.ordem,
            nome: p.nome,
            endereco: p.endereco,
          })),
          mapsUrl,
          operadorNome: op?.nome,
        });
        window.open(whatsAppUrlRota(op?.whatsapp, texto), "_blank", "noopener,noreferrer");
      }

      voltarBoard();
      router.refresh();
    } finally {
      setSalvando(false);
    }
  }

  useEffect(() => {
    if (!paradas?.length) {
      setRotaRuas(null);
      return;
    }
    const coords = paradas
      .filter((p) => p.temCoordenadas && p.latitude != null && p.longitude != null)
      .map((p) => ({ latitude: p.latitude!, longitude: p.longitude! }));
    if (inicio) coords.unshift(inicio);
    if (coords.length < 2) return;

    let cancelled = false;
    buscarRotaOsrm(coords).then((r) => {
      if (!cancelled && r) setRotaRuas(r.coordinates);
    });
    return () => {
      cancelled = true;
    };
  }, [paradas, inicio]);

  const paradasPendentes = useMemo(
    () => paradas?.filter((p) => !p.statusParada || p.statusParada === "pendente") ?? [],
    [paradas]
  );

  const temParadasConcluidas = useMemo(
    () =>
      paradas?.some((p) => p.statusParada === "concluida" || p.statusParada === "pulada") ?? false,
    [paradas]
  );

  const googleLink = paradas ? linkGoogleMapsRota(paradasPendentes, inicio) : null;
  const semCoords = paradas?.filter((p) => !p.temCoordenadas).length ?? 0;
  const podeNavegar =
    paradasPendentes.length > 0 &&
    paradasPendentes.some((p) => p.temCoordenadas) &&
    typeof navigator !== "undefined" &&
    "geolocation" in navigator;

  if (navegando && paradasPendentes.length > 0) {
    return (
      <NavegacaoRotaView
        paradas={paradasPendentes}
        onFechar={() => setNavegando(false)}
        onParadaAvancar={rotaAtiva ? marcarParadaAvancada : undefined}
      />
    );
  }

  const mapaProps = paradas
    ? {
        paradas,
        inicio,
        paradaSelecionada: paradaAtiva,
        onSelecionarParada: setParadaAtiva,
        rotaRuas,
        posicaoAoVivo: inicio
          ? {
              ...inicio,
              accuracy: 30,
              heading: null,
              speed: null,
              timestamp: Date.now(),
            }
          : null,
      }
    : null;

  if (pontos.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-700 px-6 py-14 text-center text-sm text-slate-500">
        Nenhum ponto ativo. Cadastre pontos com endereço e GPS para montar a rota.
      </div>
    );
  }

  function renderMapaELista() {
    if (!paradas?.length || !mapaProps) return null;
    return (
      <>
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-white/[0.07] bg-slate-900/40 p-4">
          {distanciaKm != null && (
            <span className="text-sm text-slate-400">
              <Route className="mr-1 inline h-4 w-4 text-primary-neon" />
              ~{distanciaKm.toFixed(1)} km entre paradas
            </span>
          )}
          {temParadasConcluidas && paradasPendentes.length > 0 && (
            <button
              type="button"
              onClick={otimizarRestantes}
              className="inline-flex items-center gap-2 rounded-lg border border-primary-neon/40 px-3 py-2 text-sm text-primary-neon hover:bg-primary-neon/10"
            >
              <Sparkles className="h-4 w-4" />
              Reotimizar restantes ({paradasPendentes.length})
            </button>
          )}
          {googleLink && (
            <a
              href={googleLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-primary-neon"
            >
              Google Maps
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
          {podeNavegar && (
            <button
              type="button"
              onClick={() => setNavegando(true)}
              className="ml-auto inline-flex items-center gap-2 rounded-lg bg-green-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-400"
            >
              <Navigation className="h-4 w-4" />
              {rotaAtiva ? "Continuar navegação" : "Iniciar navegação GPS"}
            </button>
          )}
        </div>

        {semCoords > 0 && (
          <p className="text-xs text-amber-400/90">
            {semCoords} ponto(s) sem GPS no final da lista — cadastre latitude/longitude no ponto.
          </p>
        )}

        {mapaExpandido &&
          portalReady &&
          createPortal(
            <div className="fixed inset-0 z-[9999] flex flex-col bg-slate-950 h-[100dvh] w-[100vw]">
              <div className="relative min-h-0 flex-1 w-full">
                <RotaMapaAvancado
                  {...mapaProps}
                  mapKey="fullscreen"
                  className="absolute inset-0 h-full w-full"
                />
              </div>
              <button
                type="button"
                onClick={() => setMapaExpandido(false)}
                className="absolute right-4 top-4 z-[10000] rounded-full bg-black/70 p-2.5 text-white backdrop-blur"
                aria-label="Recolher mapa"
              >
                <Minimize2 className="h-5 w-5" />
              </button>
              {podeNavegar && (
                <button
                  type="button"
                  onClick={() => {
                    setMapaExpandido(false);
                    setNavegando(true);
                  }}
                  className="absolute bottom-0 left-0 right-0 z-[10000] bg-green-500 py-4 text-center text-sm font-bold text-white shadow-lg"
                >
                  Continuar navegação GPS
                </button>
              )}
            </div>,
            document.body
          )}

        <div className="grid gap-6 xl:grid-cols-2">
          <div
            className={cn(
              "relative min-h-[min(420px,50vh)]",
              mapaExpandido && "pointer-events-none opacity-0"
            )}
          >
            {!mapaExpandido && (
              <>
                <RotaMapaAvancado
                  {...mapaProps}
                  mapKey="inline"
                  className="h-[min(420px,50vh)] w-full rounded-xl overflow-hidden border border-white/[0.08]"
                />
                <button
                  type="button"
                  onClick={() => setMapaExpandido(true)}
                  className="absolute right-3 top-3 z-[1000] rounded-lg bg-slate-900/90 p-2 text-white border border-white/10 backdrop-blur hover:bg-slate-800"
                  title="Expandir mapa"
                >
                  <Maximize2 className="h-4 w-4" />
                </button>
              </>
            )}
          </div>
          <ParadasOrdenaveisList
            paradas={paradas}
            pontos={pontos}
            paradaAtiva={paradaAtiva}
            onHoverParada={setParadaAtiva}
            onMover={moverParada}
          />
        </div>
      </>
    );
  }

  // —— Operador: só Minha rota + detalhe ao executar ——
  if (!podeGerenciarRotas) {
    return (
      <div className="space-y-6">
        {!rotaAtiva && (
          <MinhaRotaPainel
            rotas={rotasSalvas}
            userId={userId}
            pontosPorId={pontosPorId}
            rotaAtivaId={null}
            hero
            onIniciar={(rota) => executarRota(rota, false)}
            onContinuar={(rota) => executarRota(rota, false)}
            onNavegar={(rota) => executarRota(rota, true)}
          />
        )}

        {rotaAtiva && paradas && (
          <div className="space-y-4">
            <button
              type="button"
              onClick={() => {
                setRotaAtiva(null);
                setParadas(null);
              }}
              className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar às minhas rotas
            </button>
            <div>
              <h2 className="text-xl font-semibold tracking-tight text-white">{rotaAtiva.nome}</h2>
              <p className="text-sm text-slate-400 mt-0.5">
                {rotaAtiva.cidade} · {paradasPendentes.length} paradas restantes
              </p>
            </div>
            {renderMapaELista()}
          </div>
        )}
      </div>
    );
  }

  // —— Gestor ——
  return (
    <div className="space-y-6">
      {modo === "board" && (
        <>
          <RotasBoard
            rotas={rotasSalvas}
            operadores={operadores}
            onNovaRota={iniciarWizard}
            onAbrir={(rota) => {
              carregarRotaSalva(rota);
              setModo("detalhe");
            }}
            onEnviar={(rota) => setEnviarRota(rota)}
            onExcluir={excluirRota}
          />
          {chamadosAbertos > 0 && (
            <p className="text-xs text-orange-400/90 px-1">
              {chamadosAbertos} chamado{chamadosAbertos === 1 ? "" : "s"} de manutenção em aberto —
              priorizados na otimização quando o ponto entra na rota.
            </p>
          )}
          {rotasDoOperador(rotasSalvas, userId).length > 0 && (
            <div className="pt-4 border-t border-white/[0.05]">
              <p className="text-xs font-medium uppercase tracking-wider text-slate-500 mb-3">
                Atribuídas a mim
              </p>
              <MinhaRotaPainel
                rotas={rotasSalvas}
                userId={userId}
                pontosPorId={pontosPorId}
                rotaAtivaId={null}
                hero={false}
                onIniciar={(rota) => {
                  carregarRotaSalva(rota);
                  setModo("detalhe");
                }}
                onContinuar={(rota) => {
                  carregarRotaSalva(rota);
                  setModo("detalhe");
                }}
                onNavegar={(rota) => executarRota(rota, true)}
              />
            </div>
          )}
        </>
      )}

      {modo === "wizard" && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={voltarBoard}
              className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              Quadro de rotas
            </button>
            <div className="flex items-center gap-2 text-xs">
              {([1, 2, 3] as const).map((s) => (
                <span
                  key={s}
                  className={cn(
                    "inline-flex h-7 min-w-[7rem] items-center justify-center rounded-full border px-3 font-medium",
                    wizardStep === s
                      ? "border-primary-neon/50 bg-primary-neon/10 text-primary-neon"
                      : wizardStep > s
                        ? "border-green-500/30 text-green-400/90"
                        : "border-slate-700 text-slate-500"
                  )}
                >
                  {s === 1 ? "1 · Pontos" : s === 2 ? "2 · Ordem" : "3 · Enviar"}
                </span>
              ))}
            </div>
          </div>

          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-white">Nova rota</h1>
            <p className="text-sm text-slate-400 mt-1">
              {wizardStep === 1 && "Escolha a cidade e os pontos do dia."}
              {wizardStep === 2 && "Ajuste a ordem no mapa e na lista."}
              {wizardStep === 3 && "Nomeie e envie para o ajudante."}
            </p>
          </div>

          {cidades.length === 0 ? (
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-5 text-sm text-amber-200/90">
              Cadastre a <strong>cidade</strong> em cada ponto para montar rotas por cidade.
            </div>
          ) : (
            <>
              {wizardStep === 1 && (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-3 rounded-xl border border-white/[0.07] bg-slate-900/40 p-4">
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <MapPin className="h-4 w-4 text-primary-neon shrink-0" />
                      <select
                        value={filtroCidade}
                        onChange={(e) => mudarCidade(e.target.value)}
                        className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white font-medium"
                      >
                        {cidades.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>
                    <button
                      type="button"
                      onClick={capturarGps}
                      className={cn(
                        "inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition",
                        gpsStatus === "ok"
                          ? "border-green-500/30 text-green-400"
                          : "border-slate-700 text-slate-400 hover:text-white"
                      )}
                    >
                      <LocateFixed className="h-4 w-4" />
                      {gpsStatus === "loading"
                        ? "Localizando…"
                        : gpsStatus === "ok"
                          ? "GPS ativo"
                          : "Usar minha posição"}
                    </button>
                    <button
                      type="button"
                      onClick={otimizar}
                      disabled={selecionados.size === 0 || !filtroCidade}
                      className="ml-auto inline-flex items-center gap-2 rounded-xl bg-primary-neon px-4 py-2.5 text-sm font-semibold text-slate-900 hover:bg-cyan-300 disabled:opacity-40"
                    >
                      <Sparkles className="h-4 w-4" />
                      Otimizar e continuar (
                      {pontosFiltrados.filter((p) => selecionados.has(p.id)).length})
                    </button>
                  </div>

                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-medium text-slate-400">Pontos em {filtroCidade}</h2>
                    <button
                      type="button"
                      onClick={toggleTodos}
                      className="text-xs text-primary-neon hover:underline"
                    >
                      {pontosFiltrados.every((p) => selecionados.has(p.id))
                        ? "Desmarcar todos"
                        : "Marcar todos"}
                    </button>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {pontosFiltrados.map((ponto) => {
                      const marcado = selecionados.has(ponto.id);
                      const temGps = ponto.latitude != null && ponto.longitude != null;
                      const dias = diasDesdeColeta(ponto.ultima_coleta);
                      const temAlerta = alertasPontoFura(ponto).length > 0;

                      return (
                        <button
                          key={ponto.id}
                          type="button"
                          onClick={() => togglePonto(ponto.id)}
                          className={cn(
                            "rounded-xl border p-3 text-left transition flex gap-3",
                            marcado
                              ? "border-primary-neon/40 bg-primary-neon/5"
                              : "border-white/[0.06] bg-slate-900/30 opacity-75",
                            temAlerta && "border-amber-500/25"
                          )}
                        >
                          {marcado ? (
                            <CheckSquare className="h-5 w-5 shrink-0 text-primary-neon" />
                          ) : (
                            <Square className="h-5 w-5 shrink-0 text-slate-600" />
                          )}
                          {ponto.fotoExibir ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={ponto.fotoExibir}
                              alt=""
                              className="h-12 w-12 shrink-0 rounded-lg object-cover"
                            />
                          ) : (
                            <div className="h-12 w-12 shrink-0 rounded-lg bg-slate-800 flex items-center justify-center">
                              <MapPin className="h-4 w-4 text-slate-600" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-white truncate">{ponto.nome}</p>
                            <p className="text-xs text-slate-500 truncate">
                              {ponto.cidade ?? "—"}
                              {!temGps && " · sem GPS"}
                            </p>
                            <p className="text-[11px] text-slate-600">
                              {ponto.ultima_coleta
                                ? `Coleta ${formatDate(ponto.ultima_coleta)}`
                                : "Nunca coletou"}
                              {dias != null && dias > 0 && ` · ${dias}d`}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {wizardStep === 2 && paradas && (
                <div className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setWizardStep(1);
                        setParadas(null);
                      }}
                      className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-400 hover:text-white"
                    >
                      Voltar aos pontos
                    </button>
                    <button
                      type="button"
                      onClick={() => setWizardStep(3)}
                      className="ml-auto inline-flex items-center gap-2 rounded-xl bg-primary-neon px-4 py-2.5 text-sm font-semibold text-slate-900"
                    >
                      Continuar para enviar
                      <Send className="h-4 w-4" />
                    </button>
                  </div>
                  {renderMapaELista()}
                </div>
              )}

              {wizardStep === 3 && paradas && (
                <div className="space-y-5 rounded-2xl border border-white/[0.08] bg-slate-900/40 p-5">
                  <EnviarRotaWizardFields
                    nome={nomeNova}
                    onNomeChange={setNomeNova}
                    operadorId={operadorNova}
                    onOperadorChange={setOperadorNova}
                    operadores={operadores}
                    cidade={filtroCidade}
                    totalParadas={paradas.length}
                    msg={msgWizard}
                  />
                  <div className="flex flex-col sm:flex-row gap-2">
                    <button
                      type="button"
                      onClick={() => setWizardStep(2)}
                      className="rounded-xl border border-slate-700 px-4 py-3 text-sm text-slate-400"
                    >
                      Voltar
                    </button>
                    <button
                      type="button"
                      disabled={salvando}
                      onClick={() => void salvarNovaRota(false)}
                      className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-primary-neon py-3 text-sm font-semibold text-slate-900 disabled:opacity-50"
                    >
                      {salvando ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                      Salvar e enviar no app
                    </button>
                    <button
                      type="button"
                      disabled={salvando}
                      onClick={() => void salvarNovaRota(true)}
                      className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-500/35 bg-emerald-500/10 py-3 text-sm font-semibold text-emerald-300 disabled:opacity-50"
                    >
                      <MessageCircle className="h-4 w-4" />
                      Salvar + WhatsApp
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {modo === "detalhe" && rotaAtiva && paradas && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={voltarBoard}
              className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              Quadro de rotas
            </button>
            <button
              type="button"
              onClick={() => setEnviarRota(rotaAtiva)}
              className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-300"
            >
              <Send className="h-4 w-4" />
              Enviar / reatribuir
            </button>
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-white">{rotaAtiva.nome}</h1>
            <p className="text-sm text-slate-400 mt-1">
              {rotaAtiva.cidade}
              {rotaAtiva.operador_nome ? ` · ${rotaAtiva.operador_nome}` : " · sem responsável"}
            </p>
          </div>
          {renderMapaELista()}
        </div>
      )}

      {enviarRota && (
        <EnviarRotaModal
          rota={enviarRota}
          operadores={operadores}
          pontosPorId={pontosPorId}
          paradasGeo={rotaAtiva?.id === enviarRota.id ? paradas : null}
          inicio={inicio}
          onClose={() => setEnviarRota(null)}
          onAtribuido={(atualizada) => {
            setRotasSalvas((prev) =>
              prev.map((r) => (r.id === atualizada.id ? atualizada : r))
            );
            if (rotaAtiva?.id === atualizada.id) setRotaAtiva(atualizada);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

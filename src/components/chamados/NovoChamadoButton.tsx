"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { FormInput, FormTextarea } from "@/components/ui/FormInput";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";
import type { ChamadoPrioridade } from "@/lib/chamados/types";
import { getEquipamentoTipoLabel } from "@/lib/equipamentos";
import { cn } from "@/lib/utils";
import { Hash, MapPin, Plus, Search, X } from "lucide-react";

type ModoBusca = "serie" | "ponto";

type ResultadoSerie = {
  equipamento_id: string;
  equipamento_nome: string;
  numero_maquina: string | null;
  numero_serie: string | null;
  tipo: string;
  ponto_id: string;
  ponto_nome: string;
};

type ResultadoPonto = {
  ponto_id: string;
  ponto_nome: string;
  cidade: string | null;
  bairro: string | null;
  equipamentos: {
    id: string;
    nome: string;
    numero_maquina: string | null;
    numero_serie: string | null;
    tipo: string;
  }[];
};

type Selecao = {
  pontoId: string;
  pontoNome: string;
  equipamentoId: string | null;
  equipamentoLabel: string | null;
};

export function NovoChamadoButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [modo, setModo] = useState<ModoBusca>("serie");
  const [query, setQuery] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [resultadosSerie, setResultadosSerie] = useState<ResultadoSerie[]>([]);
  const [resultadosPonto, setResultadosPonto] = useState<ResultadoPonto[]>([]);
  const [selecao, setSelecao] = useState<Selecao | null>(null);
  const [titulo, setTitulo] = useState("Máquina precisa de manutenção");
  const [descricao, setDescricao] = useState("");
  const [prioridade, setPrioridade] = useState<ChamadoPrioridade>("media");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") fechar();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open || selecao) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const q = query.trim();
    if (q.length < 2) {
      setResultadosSerie([]);
      setResultadosPonto([]);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setBuscando(true);
      setError("");
      try {
        const res = await fetch(
          `/api/chamados/busca?modo=${modo}&q=${encodeURIComponent(q)}`,
          { credentials: "include" }
        );
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? "Erro na busca");
          setResultadosSerie([]);
          setResultadosPonto([]);
          return;
        }
        if (modo === "serie") {
          setResultadosSerie(data.results ?? []);
          setResultadosPonto([]);
        } else {
          setResultadosPonto(data.results ?? []);
          setResultadosSerie([]);
        }
      } catch {
        setError("Erro de conexão na busca.");
      } finally {
        setBuscando(false);
      }
    }, 350);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, modo, open, selecao]);

  function resetForm() {
    setModo("serie");
    setQuery("");
    setResultadosSerie([]);
    setResultadosPonto([]);
    setSelecao(null);
    setTitulo("Máquina precisa de manutenção");
    setDescricao("");
    setPrioridade("media");
    setError("");
  }

  function fechar() {
    if (loading) return;
    setOpen(false);
    resetForm();
  }

  function escolherSerie(r: ResultadoSerie) {
    const label = [
      r.numero_serie ? `Série ${r.numero_serie}` : null,
      r.numero_maquina ? `Nº ${r.numero_maquina}` : null,
      r.equipamento_nome,
    ]
      .filter(Boolean)
      .join(" · ");

    setSelecao({
      pontoId: r.ponto_id,
      pontoNome: r.ponto_nome,
      equipamentoId: r.equipamento_id,
      equipamentoLabel: label,
    });
    setTitulo(`Manutenção — ${label}`);
    setQuery("");
    setResultadosSerie([]);
  }

  function escolherPonto(
    ponto: ResultadoPonto,
    eq?: ResultadoPonto["equipamentos"][number]
  ) {
    const label = eq
      ? [
          eq.numero_serie ? `Série ${eq.numero_serie}` : null,
          eq.numero_maquina ? `Nº ${eq.numero_maquina}` : null,
          eq.nome,
        ]
          .filter(Boolean)
          .join(" · ")
      : null;

    setSelecao({
      pontoId: ponto.ponto_id,
      pontoNome: ponto.ponto_nome,
      equipamentoId: eq?.id ?? null,
      equipamentoLabel: label,
    });
    setTitulo(label ? `Manutenção — ${label}` : `Manutenção — ${ponto.ponto_nome}`);
    setQuery("");
    setResultadosPonto([]);
  }

  async function submit() {
    setError("");
    if (!selecao?.pontoId) {
      setError("Selecione um ponto ou número de série.");
      return;
    }
    if (!titulo.trim()) {
      setError("Informe um título.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/chamados", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          ponto_id: selecao.pontoId,
          equipamento_id: selecao.equipamentoId,
          titulo: titulo.trim(),
          descricao: descricao.trim() || null,
          prioridade,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Erro ao abrir chamado");
        return;
      }
      fechar();
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  const modal =
    open && mounted
      ? createPortal(
          <div
            className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-black/80 p-0 sm:p-4"
            onClick={fechar}
          >
            <div
              role="dialog"
              aria-modal="true"
              onClick={(e) => e.stopPropagation()}
              className="flex w-full max-w-lg max-h-[min(92dvh,720px)] flex-col overflow-hidden rounded-t-2xl border border-amber-500/20 bg-slate-950 shadow-2xl sm:rounded-xl"
            >
              <div className="flex items-start justify-between gap-3 border-b border-slate-800 px-5 py-4 shrink-0">
                <div>
                  <h3 className="font-semibold text-white">Adicionar chamado</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Busque pelo número de série ou pelo nome do ponto
                  </p>
                </div>
                <button
                  type="button"
                  onClick={fechar}
                  disabled={loading}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
                  aria-label="Fechar"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-4 space-y-4 min-h-0">
                {!selecao ? (
                  <>
                    <div className="flex gap-1 rounded-lg border border-slate-800 p-1">
                      <button
                        type="button"
                        onClick={() => {
                          setModo("serie");
                          setQuery("");
                          setResultadosSerie([]);
                          setResultadosPonto([]);
                        }}
                        className={cn(
                          "flex-1 inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-medium transition",
                          modo === "serie"
                            ? "bg-amber-500/20 text-amber-300"
                            : "text-slate-400 hover:text-white"
                        )}
                      >
                        <Hash className="h-3.5 w-3.5" />
                        Nº de série
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setModo("ponto");
                          setQuery("");
                          setResultadosSerie([]);
                          setResultadosPonto([]);
                        }}
                        className={cn(
                          "flex-1 inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-medium transition",
                          modo === "ponto"
                            ? "bg-amber-500/20 text-amber-300"
                            : "text-slate-400 hover:text-white"
                        )}
                      >
                        <MapPin className="h-3.5 w-3.5" />
                        Nome do ponto
                      </button>
                    </div>

                    <div className="flex items-center gap-2.5 rounded-lg border border-slate-600 bg-slate-900/90 px-3 py-2.5 focus-within:border-primary-neon focus-within:shadow-[0_0_0_2px_rgba(0,212,255,0.12)]">
                      <Search className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
                      <input
                        type="search"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder={
                          modo === "serie"
                            ? "Digite o número de série..."
                            : "Digite o nome do ponto..."
                        }
                        className="min-w-0 flex-1 !border-0 !bg-transparent !p-0 !shadow-none text-sm text-white placeholder:text-slate-400 focus:!border-transparent focus:!shadow-none"
                        autoFocus
                      />
                    </div>

                    {buscando && (
                      <p className="text-xs text-slate-500">Buscando...</p>
                    )}

                    {modo === "serie" && !buscando && query.trim().length >= 2 && (
                      <div className="space-y-2">
                        {resultadosSerie.length === 0 ? (
                          <p className="text-sm text-slate-500">
                            Nenhuma máquina com essa série.
                          </p>
                        ) : (
                          resultadosSerie.map((r) => (
                            <button
                              key={r.equipamento_id}
                              type="button"
                              onClick={() => escolherSerie(r)}
                              className="w-full text-left rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-2.5 hover:border-amber-500/40 hover:bg-amber-500/5 transition"
                            >
                              <p className="text-sm font-medium text-white">
                                {r.numero_serie ?? "—"} · {r.equipamento_nome}
                              </p>
                              <p className="text-xs text-slate-500 mt-0.5">
                                Ponto: {r.ponto_nome}
                                {r.numero_maquina ? ` · Nº ${r.numero_maquina}` : ""}
                                {r.tipo
                                  ? ` · ${getEquipamentoTipoLabel(r.tipo as "cassino")}`
                                  : ""}
                              </p>
                            </button>
                          ))
                        )}
                      </div>
                    )}

                    {modo === "ponto" && !buscando && query.trim().length >= 2 && (
                      <div className="space-y-3">
                        {resultadosPonto.length === 0 ? (
                          <p className="text-sm text-slate-500">Nenhum ponto encontrado.</p>
                        ) : (
                          resultadosPonto.map((p) => (
                            <div
                              key={p.ponto_id}
                              className="rounded-lg border border-slate-800 overflow-hidden"
                            >
                              <button
                                type="button"
                                onClick={() => escolherPonto(p)}
                                className="w-full text-left px-3 py-2.5 bg-slate-900/60 hover:bg-amber-500/5 transition"
                              >
                                <p className="text-sm font-medium text-white">{p.ponto_nome}</p>
                                <p className="text-xs text-slate-500">
                                  {[p.bairro, p.cidade].filter(Boolean).join(" · ") ||
                                    "Sem endereço"}
                                  {p.equipamentos.length > 0
                                    ? ` · ${p.equipamentos.length} equip.`
                                    : " · sem equipamentos"}
                                </p>
                              </button>
                              {p.equipamentos.length > 0 && (
                                <div className="border-t border-slate-800 divide-y divide-slate-800/80">
                                  {p.equipamentos.map((eq) => (
                                    <button
                                      key={eq.id}
                                      type="button"
                                      onClick={() => escolherPonto(p, eq)}
                                      className="w-full text-left px-3 py-2 text-xs text-slate-400 hover:bg-slate-800/50 hover:text-white"
                                    >
                                      {eq.numero_serie
                                        ? `Série ${eq.numero_serie} · `
                                        : ""}
                                      {eq.numero_maquina ? `Nº ${eq.numero_maquina} · ` : ""}
                                      {eq.nome}
                                      <span className="text-slate-600">
                                        {" "}
                                        ({getEquipamentoTipoLabel(eq.tipo as "cassino")})
                                      </span>
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div className="rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-xs text-amber-400/80">Selecionado</p>
                          <p className="text-sm font-medium text-white mt-0.5">
                            {selecao.pontoNome}
                          </p>
                          {selecao.equipamentoLabel && (
                            <p className="text-xs text-slate-400 mt-0.5 truncate">
                              {selecao.equipamentoLabel}
                            </p>
                          )}
                          {!selecao.equipamentoId && (
                            <p className="text-[11px] text-slate-500 mt-1">
                              Chamado no ponto (sem equipamento específico)
                            </p>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setSelecao(null);
                            setTitulo("Máquina precisa de manutenção");
                          }}
                          className="text-xs text-amber-300 hover:underline shrink-0"
                        >
                          Trocar
                        </button>
                      </div>
                    </div>

                    <FormInput
                      label="Título *"
                      value={titulo}
                      onChange={(e) => setTitulo(e.target.value)}
                    />
                    <FormTextarea
                      label="O que aconteceu?"
                      value={descricao}
                      onChange={(e) => setDescricao(e.target.value)}
                      placeholder="Ex.: Máquina não liga, visor apagado, claw travado..."
                      rows={3}
                      className="min-h-[88px]"
                    />
                    <div className="space-y-1.5">
                      <label className="block text-sm font-medium text-slate-300">
                        Prioridade
                      </label>
                      <select
                        value={prioridade}
                        onChange={(e) =>
                          setPrioridade(e.target.value as ChamadoPrioridade)
                        }
                        className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
                      >
                        <option value="baixa">Baixa</option>
                        <option value="media">Média</option>
                        <option value="alta">Alta</option>
                        <option value="urgente">Urgente</option>
                      </select>
                    </div>
                  </>
                )}

                {error && <p className="text-sm text-red-400">{error}</p>}
              </div>

              <div className="flex gap-2 justify-end border-t border-slate-800 px-5 py-4 shrink-0 bg-slate-950">
                <button
                  type="button"
                  onClick={fechar}
                  disabled={loading}
                  className="rounded-lg px-4 py-2 text-sm text-slate-400 hover:text-white disabled:opacity-50"
                >
                  Cancelar
                </button>
                {selecao && (
                  <button
                    type="button"
                    onClick={submit}
                    disabled={loading}
                    className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-900 disabled:opacity-50"
                  >
                    {loading ? "Abrindo..." : "Abrir chamado"}
                  </button>
                )}
              </div>
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-sm border border-[#c4a574]/40 bg-[#c4a574]/15 px-4 py-2.5 text-[14px] font-medium text-[#c4a574] transition hover:bg-[#c4a574]/22"
      >
        <Plus className="h-4 w-4" />
        Adicionar chamado
      </button>
      {modal}
      <LoadingOverlay show={loading} message="Abrindo chamado..." />
    </>
  );
}

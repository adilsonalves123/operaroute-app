"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { EmptyState } from "@/components/ui/EmptyState";
import { AlertBadge } from "@/components/ui/AlertBadge";
import { formatCurrency, formatDate, formatMoneyInput, formatMoneyInputOnBlur, parseMoneyInput, cn } from "@/lib/utils";
import { saldoPendenciaReais, isNegativoManualSemLeitura } from "@/lib/nichos/cassino/pendencias";
import { whatsAppUrl } from "@/lib/nichos/cassino/relatorio";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";
import { AlertTriangle, CheckCircle, ChevronDown, MessageCircle, Pencil, Trash2, X } from "lucide-react";

export interface PendenciaItem {
  id: string;
  tipo: string;
  titulo: string;
  descricao: string | null;
  valor: number | null;
  status: string;
  prioridade: string;
  created_at: string;
  ponto_id: string | null;
  visita_id: string | null;
  coleta_id: string | null;
  visita_ponto_id: string | null;
  pontos: { nome: string; whatsapp: string | null } | null;
}

function isVisitaPontoPendencia(p: PendenciaItem): boolean {
  return Boolean(p.visita_ponto_id) || p.tipo === "visita_consolidada";
}

function isFuraFuraPendencia(p: PendenciaItem): boolean {
  return Boolean(p.coleta_id) && p.titulo.toLowerCase().includes("fura-fura");
}

function valorPendenciaAberta(p: PendenciaItem): number {
  if (isNegativoManualSemLeitura({ tipo: p.tipo, visita_id: p.visita_id })) {
    return Number(p.valor ?? 0);
  }
  if (p.tipo === "negativo") {
    return saldoPendenciaReais({
      id: p.id,
      valor: Number(p.valor ?? 0),
      observacao: p.descricao,
    });
  }
  return Number(p.valor ?? 0);
}

function mensagemCobrancaPendencia(p: PendenciaItem, valor: number): string {
  const nomePonto = p.pontos?.nome ?? "seu ponto";
  return [
    `Olá, ${nomePonto}.`,
    "",
    `Consta pendência em aberto:`,
    `• ${p.titulo}: ${formatCurrency(valor)}`,
    "",
    "Pode verificar o pagamento, por favor?",
  ].join("\n");
}

const tipoLabels: Record<string, string> = {
  negativo: "Débito negativo",
  parcial: "Pagamento parcial",
  pagamento_pendente: "Pagamento pendente",
  haver: "Haver (crédito)",
  visita_consolidada: "Visita ao ponto",
};

const tipoVariant: Record<string, "danger" | "warning" | "info" | "success"> = {
  negativo: "danger",
  parcial: "warning",
  pagamento_pendente: "warning",
  haver: "success",
  visita_consolidada: "warning",
};

const filtrosTipo = [
  { id: "todos", label: "Todos" },
  { id: "visita_ponto", label: "Visita ao ponto" },
  { id: "fura_fura", label: "Fura Fura" },
  { id: "parcial", label: "Pagamento parcial" },
  { id: "pagamento_pendente", label: "Pagamento pendente" },
  { id: "negativo", label: "Débito negativo" },
  { id: "haver", label: "Haver" },
] as const;

type FiltroTipo = (typeof filtrosTipo)[number]["id"];

export function PendenciasClient({ pendencias }: { pendencias: PendenciaItem[] }) {
  const router = useRouter();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [filtroTipo, setFiltroTipo] = useState<FiltroTipo>("todos");
  const [mostrarTodas, setMostrarTodas] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [forms, setForms] = useState<
    Record<
      string,
      { valor_pix: string; valor_dinheiro: string; observacao: string; erro?: string }
    >
  >({});
  const [editForms, setEditForms] = useState<
    Record<string, { valor: string; titulo: string; observacao_edit: string; erro?: string }>
  >({});
  const [mostrarFiltrosExtras, setMostrarFiltrosExtras] = useState(false);

  const lista = pendencias.filter((p) => {
    const statusOk = mostrarTodas || p.status === "aberta";
    const tipoOk =
      filtroTipo === "todos"
        ? true
        : filtroTipo === "fura_fura"
          ? isFuraFuraPendencia(p)
          : filtroTipo === "visita_ponto"
            ? isVisitaPontoPendencia(p)
            : p.tipo === filtroTipo;
    return statusOk && tipoOk;
  });

  function countTipo(tipo: FiltroTipo) {
    return pendencias.filter((p) => {
      const statusOk = mostrarTodas || p.status === "aberta";
      if (tipo === "todos") return statusOk;
      if (tipo === "fura_fura") return statusOk && isFuraFuraPendencia(p);
      if (tipo === "visita_ponto") return statusOk && isVisitaPontoPendencia(p);
      return statusOk && p.tipo === tipo;
    }).length;
  }

  function emptyForm() {
    return { valor_pix: "", valor_dinheiro: "", observacao: "" };
  }

  function updateForm(
    id: string,
    field: "valor_pix" | "valor_dinheiro" | "observacao",
    value: string
  ) {
    setForms((prev) => ({
      ...prev,
      [id]: { ...emptyForm(), ...prev[id], [field]: value, erro: "" },
    }));
  }

  function emptyEditForm(p: PendenciaItem) {
    const saldo = valorPendenciaAberta(p);
    return {
      valor: saldo > 0.009 ? saldo.toFixed(2).replace(".", ",") : "",
      titulo: p.titulo,
      observacao_edit: "",
    };
  }

  function iniciarEdicao(p: PendenciaItem) {
    setEditingId(p.id);
    setEditForms((prev) => ({
      ...prev,
      [p.id]: { ...emptyEditForm(p), ...prev[p.id], erro: "" },
    }));
  }

  function cancelarEdicao(id: string) {
    setEditingId((current) => (current === id ? null : current));
    setEditForms((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  function updateEditForm(
    id: string,
    field: "valor" | "titulo" | "observacao_edit",
    value: string
  ) {
    setEditForms((prev) => {
      const p = pendencias.find((x) => x.id === id);
      const base =
        prev[id] ??
        (p ? emptyEditForm(p) : { valor: "", titulo: "", observacao_edit: "" });
      return {
        ...prev,
        [id]: { ...base, [field]: value, erro: "" },
      };
    });
  }

  async function salvarEdicao(id: string) {
    const pendencia = pendencias.find((p) => p.id === id);
    const form = editForms[id];
    if (!pendencia || !form) return;

    const valor = parseMoneyInput(form.valor);
    if (!Number.isFinite(valor) || valor < 0) {
      setEditForms((prev) => ({
        ...prev,
        [id]: { ...form, erro: "Informe um valor válido." },
      }));
      return;
    }

    if (!form.titulo.trim()) {
      setEditForms((prev) => ({
        ...prev,
        [id]: { ...form, erro: "Título é obrigatório." },
      }));
      return;
    }

    setLoadingId(id);
    try {
      const res = await fetch(`/api/pendencias/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          action: "editar",
          valor: form.valor,
          titulo: form.titulo.trim(),
          observacao_edit: form.observacao_edit.trim(),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        cancelarEdicao(id);
        router.refresh();
      } else {
        setEditForms((prev) => ({
          ...prev,
          [id]: { ...form, erro: data.error ?? "Erro ao salvar." },
        }));
      }
    } finally {
      setLoadingId(null);
    }
  }

  async function baixarFuraFura(p: PendenciaItem, valorOverride?: number) {
    const form = forms[p.id] ?? emptyForm();
    let valorPix = parseMoneyInput(form.valor_pix);
    let valorDinheiro = parseMoneyInput(form.valor_dinheiro);
    let bodyPix = form.valor_pix;
    let bodyDinheiro = form.valor_dinheiro;

    if (valorOverride != null && valorPix + valorDinheiro <= 0.009) {
      valorDinheiro = valorOverride;
      valorPix = 0;
      bodyPix = "";
      bodyDinheiro = valorOverride.toFixed(2).replace(".", ",");
    }

    const valor = valorPix + valorDinheiro;
    if (!p.ponto_id || valor <= 0) {
      setForms((prev) => ({
        ...prev,
        [p.id]: { ...form, erro: "Informe quanto foi Pix e/ou dinheiro." },
      }));
      return;
    }

    setLoadingId(p.id);
    try {
      const forma =
        valorPix > 0.009 && valorDinheiro > 0.009
          ? "misto"
          : valorPix > 0.009
            ? "pix"
            : "dinheiro";
      const res = await fetch("/api/coletas/fura-fura/pagamentos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          ponto_id: p.ponto_id,
          valor_pix: bodyPix,
          valor_dinheiro: bodyDinheiro,
          forma_pagamento: forma,
          observacao: form.observacao || "Baixa via pendências",
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setForms((prev) => ({ ...prev, [p.id]: emptyForm() }));
        router.refresh();
      } else {
        setForms((prev) => ({
          ...prev,
          [p.id]: { ...form, erro: data.error ?? "Erro ao registrar pagamento." },
        }));
      }
    } finally {
      setLoadingId(null);
    }
  }

  async function baixar(id: string) {
    const pendencia = pendencias.find((p) => p.id === id);
    if (pendencia && isFuraFuraPendencia(pendencia)) {
      await baixarFuraFura(pendencia);
      return;
    }

    const form = forms[id] ?? emptyForm();
    setLoadingId(id);
    try {
      const res = await fetch(`/api/pendencias/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          action: "baixa",
          valor_pix: form.valor_pix,
          valor_dinheiro: form.valor_dinheiro,
          observacao: form.observacao,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setForms((prev) => ({ ...prev, [id]: emptyForm() }));
        router.refresh();
      } else {
        setForms((prev) => ({
          ...prev,
          [id]: {
            valor_pix: form.valor_pix,
            valor_dinheiro: form.valor_dinheiro,
            observacao: form.observacao,
            erro: data.error ?? "Erro ao salvar.",
          },
        }));
      }
    } finally {
      setLoadingId(null);
    }
  }

  async function quitar(id: string) {
    const pendencia = pendencias.find((p) => p.id === id);
    if (pendencia && isFuraFuraPendencia(pendencia)) {
      await baixarFuraFura(pendencia, valorPendenciaAberta(pendencia));
      return;
    }

    const form = forms[id] ?? emptyForm();
    setLoadingId(id);
    try {
      const res = await fetch(`/api/pendencias/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          action: "quitar",
          valor_pix: form.valor_pix,
          valor_dinheiro: form.valor_dinheiro,
          observacao: form.observacao,
        }),
      });
      if (res.ok) router.refresh();
    } finally {
      setLoadingId(null);
    }
  }

  async function apagar(id: string) {
    if (!confirm("Apagar esta pendência? Essa ação não pode ser desfeita.")) return;
    setLoadingId(id);
    try {
      const res = await fetch(`/api/pendencias/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (res.ok) router.refresh();
    } finally {
      setLoadingId(null);
    }
  }

  if (pendencias.length === 0) {
    return (
      <EmptyState
        title="Nenhuma pendência"
        description="Débitos e pagamentos pendentes das coletas aparecerão aqui."
        icon={<AlertTriangle className="h-8 w-8" />}
      />
    );
  }

  const totalAberto = pendencias
    .filter((p) => p.status === "aberta")
    .reduce((s, p) => s + valorPendenciaAberta(p), 0);
  const abertasCount = pendencias.filter((p) => p.status === "aberta").length;

  const filtrosComItens = filtrosTipo.filter(
    (f) => f.id === "todos" || countTipo(f.id) > 0
  );
  const filtrosExtras = filtrosTipo.filter(
    (f) => f.id !== "todos" && countTipo(f.id) === 0
  );
  const filtroAtivoEhExtra = filtrosExtras.some((f) => f.id === filtroTipo);

  return (
    <>
    <div className="space-y-4">
      <div className="rounded-sm border border-at bg-at-card p-3 sm:p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-at-muted">
            <span className="font-medium text-at-primary/90">{abertasCount}</span>{" "}
            {abertasCount === 1 ? "aberta" : "abertas"}
            {totalAberto > 0.009 ? (
              <>
                {" "}
                · total{" "}
                <span className="font-medium text-at-link">{formatCurrency(totalAberto)}</span>
              </>
            ) : null}
          </p>
          <button
            type="button"
            onClick={() => setMostrarTodas((v) => !v)}
            className="text-xs text-at-muted hover:text-at-primary/85 underline-offset-2 hover:underline"
          >
            {mostrarTodas ? "Só abertas" : "Incluir resolvidas"}
          </button>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {filtrosComItens.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => {
                setFiltroTipo(f.id);
                setExpandedId(null);
              }}
              className={cn(
                "rounded-sm px-3 py-1 text-xs font-medium transition",
                filtroTipo === f.id ? "analise-tab-active" : "analise-tab-idle border"
              )}
            >
              {f.label}
              {f.id !== "todos" ? (
                <span className="ml-1 tabular-nums opacity-80">({countTipo(f.id)})</span>
              ) : null}
            </button>
          ))}
          {filtrosExtras.length > 0 ? (
            <button
              type="button"
              onClick={() => setMostrarFiltrosExtras((v) => !v)}
              className={cn(
                "rounded-sm border px-3 py-1 text-xs font-medium transition",
                mostrarFiltrosExtras || filtroAtivoEhExtra
                  ? "analise-tab-active"
                  : "analise-tab-idle"
              )}
            >
              Outros tipos
              {!mostrarFiltrosExtras && !filtroAtivoEhExtra ? (
                <span className="ml-1 opacity-70">({filtrosExtras.length})</span>
              ) : null}
            </button>
          ) : null}
        </div>

        {(mostrarFiltrosExtras || filtroAtivoEhExtra) && filtrosExtras.length > 0 ? (
          <div className="flex flex-wrap gap-1.5 border-t border-at pt-3">
            {filtrosExtras.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => {
                  setFiltroTipo(f.id);
                  setExpandedId(null);
                }}
                className={cn(
                  "rounded-sm px-3 py-1 text-xs font-medium transition",
                  filtroTipo === f.id ? "analise-tab-active" : "analise-tab-idle border"
                )}
              >
                {f.label}
                <span className="ml-1 opacity-60">(0)</span>
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {lista.length === 0 ? (
        <p className="text-sm text-at-muted text-center py-8">
          Nenhuma pendência neste filtro.
        </p>
      ) : (
        <div className="space-y-3">
          {lista.map((p) => {
            const form = forms[p.id] ?? emptyForm();
            const isOpen = expandedId === p.id;
            const valorLabelPix = p.tipo === "haver" ? "Valor usado no Pix (R$)" : "Valor Pix (R$)";
            const valorLabelDinheiro =
              p.tipo === "haver" ? "Valor usado em dinheiro (R$)" : "Valor dinheiro (R$)";
            const valorAtual = valorPendenciaAberta(p);
            const whatsapp = p.pontos?.whatsapp;
            const podeCobrar =
              p.status === "aberta" &&
              p.tipo !== "haver" &&
              valorAtual > 0.009 &&
              Boolean(whatsapp);
            const cobrarUrl = podeCobrar
              ? whatsAppUrl(whatsapp, mensagemCobrancaPendencia(p, valorAtual))
              : null;

            const isFura = isFuraFuraPendencia(p);
            const isVisita = isVisitaPontoPendencia(p);
            const editando = editingId === p.id;
            const editForm = editForms[p.id] ?? emptyEditForm(p);

            const contextoLabel = [
              isFura ? "Fura-fura" : null,
              isVisita ? "Visita ao ponto" : null,
              p.pontos?.nome ?? null,
              formatDate(p.created_at),
            ]
              .filter(Boolean)
              .join(" · ");

            return (
              <div key={p.id} className="glass-card overflow-hidden">
                <button
                  type="button"
                  onClick={() => setExpandedId(isOpen ? null : p.id)}
                  className="w-full text-left flex items-center justify-between gap-3 p-4 hover:bg-white/[0.02] transition"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-at-primary truncate">{p.titulo}</p>
                      <AlertBadge
                        variant={
                          p.tipo === "haver" &&
                          /pagou ganhadores/i.test(`${p.titulo ?? ""} ${p.descricao ?? ""}`)
                            ? "info"
                            : (tipoVariant[p.tipo] ?? "info")
                        }
                      >
                        {p.tipo === "haver" &&
                        /pagou ganhadores/i.test(`${p.titulo ?? ""} ${p.descricao ?? ""}`)
                          ? "Haver negativo"
                          : p.tipo === "haver"
                            ? "Haver"
                            : (tipoLabels[p.tipo] ?? p.tipo)}
                      </AlertBadge>
                      {p.status === "resolvida" && (
                        <AlertBadge variant="success">Resolvida</AlertBadge>
                      )}
                    </div>
                    <p className="text-xs text-at-muted mt-1 truncate">{contextoLabel}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <p
                      className={cn(
                        "text-base font-semibold tabular-nums",
                        p.tipo === "haver"
                          ? /pagou ganhadores/i.test(`${p.titulo ?? ""} ${p.descricao ?? ""}`)
                            ? "text-at-muted"
                            : "text-at-money-pos"
                          : "text-at-primary"
                      )}
                    >
                      {p.tipo === "haver" ? "+" : ""}
                      {formatCurrency(valorAtual)}
                    </p>
                    <ChevronDown
                      className={`h-4 w-4 text-at-muted transition ${
                        isOpen ? "rotate-180" : ""
                      }`}
                    />
                  </div>
                </button>

                {isOpen && (
                  <div className="border-t border-at px-4 pb-4 pt-3 space-y-4">
                    {(isFura && p.coleta_id) || (isVisita && p.visita_ponto_id) ? (
                      <div className="flex flex-wrap gap-2">
                        {isFura && p.coleta_id ? (
                          <a
                            href={`/coletas/fura-fura/${p.coleta_id}`}
                            className="text-xs text-primary-neon hover:underline"
                          >
                            Ver coleta
                          </a>
                        ) : null}
                        {isVisita && p.visita_ponto_id ? (
                          <a
                            href={`/visitas-ponto/${p.visita_ponto_id}/resumo`}
                            className="text-xs text-primary-neon hover:underline"
                          >
                            Ver resumo da visita
                          </a>
                        ) : null}
                      </div>
                    ) : null}

                    {p.descricao ? (
                      <details className="group rounded-lg border border-slate-800/80 bg-slate-900/30">
                        <summary className="cursor-pointer list-none px-3 py-2 text-xs font-medium text-at-muted hover:text-at-primary/85 [&::-webkit-details-marker]:hidden">
                          Histórico
                          <span className="ml-1 text-at-soft group-open:hidden">▾</span>
                          <span className="ml-1 text-at-soft hidden group-open:inline">▴</span>
                        </summary>
                        <p className="border-t border-slate-800/80 px-3 py-2 text-xs text-at-muted whitespace-pre-line max-h-40 overflow-y-auto">
                          {p.descricao}
                        </p>
                      </details>
                    ) : null}

                    {editando && (
                      <div className="rounded-lg border border-primary-neon/25 bg-primary-neon/5 p-4 space-y-3">
                        <p className="text-sm font-medium text-at-primary">Editar pendência</p>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="space-y-1.5">
                            <label className="block text-sm font-medium text-at-primary/85">
                              Saldo em aberto (R$)
                            </label>
                            <input
                              inputMode="decimal"
                              value={editForm.valor}
                              onChange={(e) =>
                                updateEditForm(p.id, "valor", formatMoneyInput(e.target.value))
                              }
                              onBlur={(e) =>
                                updateEditForm(
                                  p.id,
                                  "valor",
                                  formatMoneyInputOnBlur(e.target.value)
                                )
                              }
                              className="w-full"
                              placeholder="0,00"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <label className="block text-sm font-medium text-at-primary/85">
                              Título
                            </label>
                            <input
                              value={editForm.titulo}
                              onChange={(e) => updateEditForm(p.id, "titulo", e.target.value)}
                              className="w-full"
                            />
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <label className="block text-sm font-medium text-at-primary/85">
                            Motivo da alteração (opcional)
                          </label>
                          <input
                            value={editForm.observacao_edit}
                            onChange={(e) =>
                              updateEditForm(p.id, "observacao_edit", e.target.value)
                            }
                            className="w-full"
                            placeholder="Ex: corrigido após desconto do haver"
                          />
                        </div>
                        {editForm.erro && <p className="text-xs text-red-400">{editForm.erro}</p>}
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={loadingId === p.id}
                            onClick={() => salvarEdicao(p.id)}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-primary-neon px-3 py-1.5 text-xs font-semibold text-slate-900 disabled:opacity-50"
                          >
                            {loadingId === p.id ? "Salvando..." : "Salvar alterações"}
                          </button>
                          <button
                            type="button"
                            disabled={loadingId === p.id}
                            onClick={() => cancelarEdicao(p.id)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-600 px-3 py-1.5 text-xs font-medium text-at-primary/85 hover:bg-slate-800 disabled:opacity-50"
                          >
                            <X className="h-3.5 w-3.5" />
                            Cancelar
                          </button>
                        </div>
                      </div>
                    )}

                    {!editando && !isFura && (p.status === "aberta" || mostrarTodas) && (
                      <button
                        type="button"
                        disabled={loadingId === p.id}
                        onClick={() => iniciarEdicao(p)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-600 px-3 py-1.5 text-xs font-medium text-at-primary/85 hover:bg-slate-800 disabled:opacity-50"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Editar valor
                      </button>
                    )}

                    {p.status === "aberta" && !editando && (
                      <>
                        {isFura ? (
                          <p className="text-xs text-at-muted">
                            Pagamento sincroniza com a coleta fura-fura (FIFO).
                          </p>
                        ) : null}
                        <div className="rounded-lg border border-slate-800/80 bg-slate-900/20 p-3 space-y-3">
                          <p className="text-xs font-medium text-at-muted">Registrar pagamento</p>
                          <div className="grid gap-3 sm:grid-cols-3">
                          <div className="space-y-1.5">
                            <label className="block text-sm font-medium text-at-primary/85">
                              {valorLabelPix}
                            </label>
                            <input
                              inputMode="decimal"
                              value={form.valor_pix}
                              onChange={(e) =>
                                updateForm(p.id, "valor_pix", formatMoneyInput(e.target.value))
                              }
                              onBlur={(e) =>
                                updateForm(
                                  p.id,
                                  "valor_pix",
                                  formatMoneyInputOnBlur(e.target.value)
                                )
                              }
                              className="w-full"
                              placeholder="0,00"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <label className="block text-sm font-medium text-at-primary/85">
                              {valorLabelDinheiro}
                            </label>
                            <input
                              inputMode="decimal"
                              value={form.valor_dinheiro}
                              onChange={(e) =>
                                updateForm(
                                  p.id,
                                  "valor_dinheiro",
                                  formatMoneyInput(e.target.value)
                                )
                              }
                              onBlur={(e) =>
                                updateForm(
                                  p.id,
                                  "valor_dinheiro",
                                  formatMoneyInputOnBlur(e.target.value)
                                )
                              }
                              className="w-full"
                              placeholder="0,00"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <label className="block text-sm font-medium text-at-primary/85">
                              Observação
                            </label>
                            <input
                              value={form.observacao}
                              onChange={(e) => updateForm(p.id, "observacao", e.target.value)}
                              className="w-full"
                              placeholder="Ex: pago em dinheiro"
                            />
                          </div>
                          </div>

                        {form.erro && <p className="text-xs text-red-400">{form.erro}</p>}

                        <div className="flex flex-wrap gap-2 pt-1">
                          {cobrarUrl && (
                            <a
                              href={cobrarUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 rounded-lg border border-green-500/30 px-3 py-1.5 text-xs font-medium text-green-400 hover:bg-green-500/10"
                            >
                              <MessageCircle className="h-3.5 w-3.5" />
                              Cobrar
                            </a>
                          )}
                          <button
                            type="button"
                            disabled={loadingId === p.id}
                            onClick={() => baixar(p.id)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-blue-500/30 px-3 py-1.5 text-xs font-medium text-primary-neon hover:bg-blue-500/10 disabled:opacity-50"
                          >
                            <CheckCircle className="h-3.5 w-3.5" />
                            {loadingId === p.id ? "Salvando..." : "Dar baixa"}
                          </button>
                          <button
                            type="button"
                            disabled={loadingId === p.id}
                            onClick={() => quitar(p.id)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-green-500/30 px-3 py-1.5 text-xs font-medium text-green-400 hover:bg-green-500/10 disabled:opacity-50"
                          >
                            <CheckCircle className="h-3.5 w-3.5" />
                            Quitar tudo
                          </button>
                          <button
                            type="button"
                            disabled={loadingId === p.id}
                            onClick={() => apagar(p.id)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/30 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/10 disabled:opacity-50"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Apagar
                          </button>
                        </div>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>

    <LoadingOverlay
      show={loadingId !== null}
      messages={[
        "Processando pagamento...",
        "Atualizando financeiro...",
        "Quase lá...",
      ]}
    />
  </>
  );
}

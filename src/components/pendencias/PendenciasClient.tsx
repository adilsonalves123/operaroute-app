"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { EmptyState } from "@/components/ui/EmptyState";
import { AlertBadge } from "@/components/ui/AlertBadge";
import { formatCurrency, formatDate, formatMoneyInput, formatMoneyInputOnBlur, parseMoneyInput } from "@/lib/utils";
import { saldoPendenciaReais } from "@/lib/nichos/cassino/pendencias";
import { whatsAppUrl } from "@/lib/nichos/cassino/relatorio";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";
import { AlertTriangle, CheckCircle, ChevronDown, MessageCircle, Trash2 } from "lucide-react";

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
  pontos: { nome: string; whatsapp: string | null } | null;
}

function isFuraFuraPendencia(p: PendenciaItem): boolean {
  return Boolean(p.coleta_id) && p.titulo.toLowerCase().includes("fura-fura");
}

function valorPendenciaAberta(p: PendenciaItem): number {
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
};

const tipoVariant: Record<string, "danger" | "warning" | "info" | "success"> = {
  negativo: "danger",
  parcial: "warning",
  pagamento_pendente: "warning",
  haver: "success",
};

const filtrosTipo = [
  { id: "todos", label: "Todos" },
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
  const [forms, setForms] = useState<
    Record<
      string,
      { valor_pix: string; valor_dinheiro: string; observacao: string; erro?: string }
    >
  >({});

  const lista = pendencias.filter((p) => {
    const statusOk = mostrarTodas || p.status === "aberta";
    const tipoOk =
      filtroTipo === "todos"
        ? true
        : filtroTipo === "fura_fura"
          ? isFuraFuraPendencia(p)
          : p.tipo === filtroTipo;
    return statusOk && tipoOk;
  });

  function countTipo(tipo: FiltroTipo) {
    return pendencias.filter((p) => {
      const statusOk = mostrarTodas || p.status === "aberta";
      if (tipo === "todos") return statusOk;
      if (tipo === "fura_fura") return statusOk && isFuraFuraPendencia(p);
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

  async function baixarFuraFura(p: PendenciaItem, valorOverride?: number) {
    const form = forms[p.id] ?? emptyForm();
    const valorPix = parseMoneyInput(form.valor_pix);
    const valorDinheiro = parseMoneyInput(form.valor_dinheiro);
    const valor = valorOverride ?? valorPix + valorDinheiro;
    if (!p.ponto_id || valor <= 0) {
      setForms((prev) => ({
        ...prev,
        [p.id]: { ...form, erro: "Informe um valor válido." },
      }));
      return;
    }

    setLoadingId(p.id);
    try {
    const forma =
      valorOverride != null
        ? "dinheiro"
        : valorPix > 0.009 && valorDinheiro > 0.009
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
          valor,
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

  return (
    <>
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {filtrosTipo.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => {
              setFiltroTipo(f.id);
              setExpandedId(null);
            }}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
              filtroTipo === f.id
                ? "bg-primary-neon text-slate-900"
                : "bg-slate-800 text-slate-400 hover:text-white"
            }`}
          >
            {f.label}
            <span className="ml-1 opacity-70">({countTipo(f.id)})</span>
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={() => setMostrarTodas((v) => !v)}
        className="text-xs text-slate-500 hover:text-slate-300"
      >
        {mostrarTodas ? "Mostrando todas · ver só abertas" : "Mostrando abertas · ver resolvidas também"}
      </button>

      {lista.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-8">
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

            return (
              <div key={p.id} className="glass-card p-4 space-y-3">
                <button
                  type="button"
                  onClick={() => setExpandedId(isOpen ? null : p.id)}
                  className="w-full text-left flex items-start justify-between gap-3"
                >
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-white">{p.titulo}</p>
                      <AlertBadge variant={tipoVariant[p.tipo] ?? "info"}>
                        {tipoLabels[p.tipo] ?? p.tipo}
                      </AlertBadge>
                      {p.status === "resolvida" && (
                        <AlertBadge variant="success">Resolvida</AlertBadge>
                      )}
                      {isFura && <AlertBadge variant="info">Fura Fura</AlertBadge>}
                    </div>
                    <p className="text-sm text-slate-400 mt-1">
                      {p.pontos?.nome ?? "—"} · {formatDate(p.created_at)}
                    </p>
                    {isFura && p.coleta_id && (
                      <a
                        href={`/coletas/fura-fura/${p.coleta_id}`}
                        className="text-xs text-primary-neon hover:underline mt-1 inline-block"
                      >
                        Ver coleta
                      </a>
                    )}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <p
                      className={`font-semibold ${
                        p.tipo === "haver" ? "text-cyan-400" : "text-amber-400"
                      }`}
                    >
                      {p.tipo === "haver" ? "+" : ""}
                      {formatCurrency(valorAtual)}
                    </p>
                    <ChevronDown
                      className={`h-4 w-4 text-slate-500 transition ${
                        isOpen ? "rotate-180" : ""
                      }`}
                    />
                  </div>
                </button>

                {isOpen && (
                  <div className="border-t border-slate-800 pt-4 space-y-4">
                    {p.descricao && (
                      <div>
                        <p className="text-xs font-medium text-slate-400 mb-1">Histórico</p>
                        <p className="text-xs text-slate-500 whitespace-pre-line">
                          {p.descricao}
                        </p>
                      </div>
                    )}

                    {p.status === "aberta" && (
                      <>
                        {isFura && (
                          <p className="text-xs text-amber-400/90">
                            Pagamento sincroniza com a coleta fura-fura (FIFO).
                          </p>
                        )}
                        <div className="grid gap-3 sm:grid-cols-3">
                          <div className="space-y-1.5">
                            <label className="block text-sm font-medium text-slate-300">
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
                            <label className="block text-sm font-medium text-slate-300">
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
                            <label className="block text-sm font-medium text-slate-300">
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

                        <div className="flex flex-wrap gap-2">
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

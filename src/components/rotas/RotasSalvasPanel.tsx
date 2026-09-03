"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  Calendar,
  Loader2,
  MapPin,
  Play,
  Save,
  Trash2,
  User,
  Users,
} from "lucide-react";
import { FormInput, FormSelect } from "@/components/ui/FormInput";
import type { OperadorRotaOpcao, RotaSalva } from "@/lib/rotas/rotas-salvas";
import { statusRotaLabel } from "@/lib/rotas/rotas-salvas";
import { cn, formatDate } from "@/lib/utils";

type Props = {
  rotas: RotaSalva[];
  operadores: OperadorRotaOpcao[];
  podeGerenciar: boolean;
  cidadeSelecionada: string;
  paradasAtuais: { ponto_id: string; ordem: number }[] | null;
  onCarregar: (rota: RotaSalva) => void;
};

export function RotasSalvasPanel({
  rotas: initialRotas,
  operadores,
  podeGerenciar,
  cidadeSelecionada,
  paradasAtuais,
  onCarregar,
}: Props) {
  const router = useRouter();
  const [rotas, setRotas] = useState(initialRotas);
  const [showSalvar, setShowSalvar] = useState(false);
  const [nome, setNome] = useState("");
  const [operadorId, setOperadorId] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  const operadorOptions = [
    { value: "", label: "Selecione o operador *" },
    ...operadores.map((o) => ({
      value: o.userId,
      label: `${o.nome} (${o.role})`,
    })),
  ];

  async function salvarRota() {
    if (!paradasAtuais?.length) {
      setMsg("Otimize uma rota antes de salvar.");
      return;
    }
    if (!nome.trim()) {
      setMsg("Informe o nome da rota.");
      return;
    }
    if (!cidadeSelecionada) {
      setMsg("Selecione uma cidade antes de salvar.");
      return;
    }
    if (!operadorId) {
      setMsg("Selecione o operador que vai executar esta rota.");
      return;
    }

    setLoading(true);
    setMsg("");
    try {
      const res = await fetch("/api/rotas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: nome.trim(),
          operador_id: operadorId,
          cidade: cidadeSelecionada,
          paradas: paradasAtuais,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(data.error ?? "Erro ao salvar.");
        return;
      }
      setRotas((prev) => [data.rota, ...prev]);
      setShowSalvar(false);
      setNome("");
      setOperadorId("");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  async function excluir(id: string) {
    if (!confirm("Excluir esta rota salva?")) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/rotas/${id}`, { method: "DELETE" });
      if (!res.ok) return;
      setRotas((prev) => prev.filter((r) => r.id !== id));
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-at-primary/85 uppercase tracking-wide">
          Rotas salvas ({rotas.length})
        </h2>
        {podeGerenciar && paradasAtuais && paradasAtuais.length > 0 && (
          <button
            type="button"
            onClick={() => {
              setShowSalvar((s) => !s);
              setMsg("");
              if (!nome) {
                setNome(`Rota ${new Date().toLocaleDateString("pt-BR")}`);
              }
            }}
            className="inline-flex items-center gap-2 rounded-lg border border-primary-neon/40 bg-primary-neon/10 px-3 py-2 text-sm font-medium text-primary-neon hover:bg-primary-neon/20"
          >
            <Save className="h-4 w-4" />
            Salvar rota atual
          </button>
        )}
      </div>

      {showSalvar && podeGerenciar && (
        <div className="glass-card p-4 space-y-3 border border-primary-neon/20">
          <p className="text-sm text-at-muted">
            Salvar {paradasAtuais?.length ?? 0} paradas em{" "}
            <strong className="text-white">{cidadeSelecionada || "—"}</strong>
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <FormInput
              label="Nome da rota *"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex.: Rota centro — segunda"
            />
            <FormSelect
              label="Atribuir a *"
              value={operadorId}
              onChange={(e) => setOperadorId(e.target.value)}
              options={operadorOptions}
            />
          </div>
          <p className="text-xs text-at-muted">
            A rota aparecerá em «Minha rota» no painel do operador escolhido.
          </p>
          {msg && <p className="text-sm text-red-400">{msg}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              disabled={loading}
              onClick={() => void salvarRota()}
              className="inline-flex items-center gap-2 rounded-lg bg-primary-neon px-4 py-2 text-sm font-semibold text-slate-900 disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Salvar
            </button>
            <button
              type="button"
              onClick={() => setShowSalvar(false)}
              className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-at-muted"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {rotas.length === 0 ? (
        <div className="glass-card p-6 text-center text-sm text-at-muted">
          {podeGerenciar
            ? "Monte e otimize uma rota abaixo, depois clique em «Salvar rota atual»."
            : "Nenhuma rota atribuída a você ainda."}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rotas.map((rota) => (
            <article key={rota.id} className="glass-card p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-white truncate">{rota.nome}</p>
                  <p className="text-xs text-at-muted mt-0.5 flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {formatDate(rota.created_at)}
                  </p>
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase",
                    rota.status === "concluida"
                      ? "bg-green-500/20 text-green-400"
                      : rota.status === "em_andamento"
                        ? "bg-cyan-500/20 text-cyan-400"
                        : "bg-slate-500/20 text-at-muted"
                  )}
                >
                  {statusRotaLabel(rota.status)}
                </span>
              </div>

              <div className="flex flex-wrap gap-2 text-xs text-at-muted">
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {rota.total_paradas} paradas
                </span>
                {rota.cidade && (
                  <span className="inline-flex items-center gap-1 text-cyan-400/80">
                    {rota.cidade}
                  </span>
                )}
                {rota.operador_id ? (
                  <span className="inline-flex items-center gap-1 text-cyan-400/90">
                    <User className="h-3 w-3" />
                    {rota.operador_nome ?? "Operador"}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-amber-400/90">
                    <Users className="h-3 w-3" />
                    Sem operador
                  </span>
                )}
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => onCarregar(rota)}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-slate-800 py-2 text-xs font-medium text-white hover:bg-slate-700"
                >
                  <Play className="h-3.5 w-3.5" />
                  Usar rota
                </button>
                {podeGerenciar && (
                  <button
                    type="button"
                    onClick={() => void excluir(rota.id)}
                    className="rounded-lg p-2 text-at-muted hover:bg-red-500/10 hover:text-red-400"
                    title="Excluir"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { EyeOff } from "lucide-react";
import type { EquipeMember } from "@/lib/types/database";

type Props = {
  membros: EquipeMember[];
  pontos: { id: string; nome: string }[];
  visaoPontosPorEquipe: Record<string, string[]>;
};

export function VisaoEquipePainel({ membros, pontos, visaoPontosPorEquipe }: Props) {
  const router = useRouter();
  const operadores = membros.filter((m) => m.role !== "admin" && m.status !== "inativo");
  const [abertoId, setAbertoId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [erro, setErro] = useState("");
  const [ok, setOk] = useState("");

  if (operadores.length === 0) return null;

  async function salvar(
    membro: EquipeMember,
    visao_restrita: boolean,
    visao_ponto_ids: string[]
  ) {
    setSavingId(membro.id);
    setErro("");
    setOk("");
    try {
      const res = await fetch(`/api/equipe/${membro.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visao_restrita, visao_ponto_ids }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErro(typeof data.error === "string" ? data.error : "Não foi possível salvar.");
        return;
      }
      setOk(`Salvo: ${membro.nome}`);
      router.refresh();
    } catch {
      setErro("Erro de conexão.");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <section className="space-y-3 rounded-xl border-2 border-amber-400/50 bg-amber-500/10 p-4">
      <div className="flex items-start gap-2">
        <EyeOff className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />
        <div>
          <h2 className="text-base font-semibold text-amber-100">Painel restrito</h2>
          <p className="mt-1 text-sm leading-relaxed text-slate-300">
            Aqui você escolhe quem vê só o que você publicar. A coleta na rua continua
            normal.
          </p>
        </div>
      </div>

      {erro && <p className="text-sm text-red-300">{erro}</p>}
      {ok && <p className="text-sm text-emerald-300">{ok}</p>}

      <ul className="space-y-2">
        {operadores.map((membro) => {
          const restrita = Boolean(membro.visao_restrita);
          const pontoIds = visaoPontosPorEquipe[membro.id] ?? [];
          const aberto = abertoId === membro.id;
          return (
            <li
              key={membro.id}
              className="rounded-lg border border-white/10 bg-slate-950/40 p-3"
            >
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4"
                  checked={restrita}
                  disabled={savingId === membro.id}
                  onChange={(e) => {
                    const on = e.target.checked;
                    void salvar(membro, on, pontoIds);
                    if (on) setAbertoId(membro.id);
                  }}
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-white">{membro.nome}</span>
                  <span className="block text-xs text-slate-400">
                    {restrita
                      ? `${pontoIds.length} ponto(s) liberado(s)`
                      : "Vê tudo (igual você)"}
                  </span>
                </span>
              </label>
              {restrita && (
                <div className="mt-3 space-y-2 pl-7">
                  <button
                    type="button"
                    className="text-xs text-amber-200 underline-offset-2 hover:underline"
                    onClick={() => setAbertoId(aberto ? null : membro.id)}
                  >
                    {aberto ? "Ocultar pontos" : "Escolher pontos"}
                  </button>
                  {aberto && (
                    <div className="max-h-48 space-y-1.5 overflow-y-auto rounded-md border border-white/10 p-2">
                      {pontos.length === 0 ? (
                        <p className="text-xs text-slate-500">Cadastre pontos primeiro.</p>
                      ) : (
                        pontos.map((p) => {
                          const checked = pontoIds.includes(p.id);
                          return (
                            <label
                              key={p.id}
                              className="flex cursor-pointer items-center gap-2 text-sm text-slate-300"
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                disabled={savingId === membro.id}
                                onChange={(e) => {
                                  const next = e.target.checked
                                    ? [...pontoIds, p.id]
                                    : pontoIds.filter((id) => id !== p.id);
                                  void salvar(membro, true, next);
                                }}
                              />
                              {p.nome}
                            </label>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

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
  const operadores = membros.filter((m) => m.role !== "admin");
  const [abertoId, setAbertoId] = useState<string | null>(null);
  const [listaCheiaId, setListaCheiaId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [erro, setErro] = useState("");
  const [ok, setOk] = useState("");

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
    <section
      id="painel-restrito"
      className="equipe-pagina space-y-3 rounded-xl border-2 border-[#c4a574] bg-[#c4a574]/20 p-4"
    >
      <div className="flex items-start gap-2">
        <EyeOff className="mt-0.5 h-5 w-5 shrink-0 text-[#8a6a3d]" />
        <div>
          <h2 className="text-base font-semibold text-at-primary">Painel restrito</h2>
          <p className="mt-1 text-sm leading-relaxed text-at-muted">
            Marque o operador para ele coletar normal, mas no painel ver só o que você
            publicar.
          </p>
        </div>
      </div>

      {erro && <p className="text-sm text-red-600">{erro}</p>}
      {ok && <p className="text-sm text-emerald-700">{ok}</p>}

      {operadores.length === 0 ? (
        <p className="rounded-lg border border-[#c4a574]/40 bg-white/60 p-3 text-sm text-at-primary">
          Ainda não tem operador na equipe. Clique em <strong>Adicionar membro</strong>{" "}
          acima, crie um login de <strong>operador</strong> e volte aqui para marcar o
          checkbox.
        </p>
      ) : (
        <ul className="space-y-2">
        {operadores.map((membro) => {
          const restrita = Boolean(membro.visao_restrita);
          const pontoIds = visaoPontosPorEquipe[membro.id] ?? [];
          const aberto = abertoId === membro.id;
          return (
            <li
              key={membro.id}
              className="rounded-lg border border-at bg-at-card p-3"
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
                  <span className="block text-sm font-medium text-at-primary">{membro.nome}</span>
                  <span className="block text-xs text-at-muted">
                    {restrita
                      ? `${pontoIds.length} ponto(s) liberado(s)`
                      : "Vê tudo (igual você)"}
                  </span>
                </span>
              </label>
              {restrita && (
                <div className="mt-3 space-y-2 pl-7">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <button
                      type="button"
                      className="text-xs font-medium text-[#5c3d0a] underline-offset-2 hover:underline"
                      onClick={() => setAbertoId(aberto ? null : membro.id)}
                    >
                      {aberto ? "Ocultar pontos" : "Escolher pontos"}
                    </button>
                    {aberto && pontos.length > 0 && (
                      <>
                        <button
                          type="button"
                          className="text-xs font-medium text-[#5c3d0a] underline-offset-2 hover:underline"
                          onClick={() =>
                            setListaCheiaId(listaCheiaId === membro.id ? null : membro.id)
                          }
                        >
                          {listaCheiaId === membro.id ? "Lista compacta" : "Ver todos"}
                        </button>
                        <button
                          type="button"
                          disabled={savingId === membro.id}
                          className="text-xs font-medium text-[#5c3d0a] underline-offset-2 hover:underline disabled:opacity-50"
                          onClick={() => {
                            const todos = pontos.map((p) => p.id);
                            const jaTodos =
                              todos.length > 0 && todos.every((id) => pontoIds.includes(id));
                            void salvar(membro, true, jaTodos ? [] : todos);
                          }}
                        >
                          {pontos.length > 0 &&
                          pontos.every((p) => pontoIds.includes(p.id))
                            ? "Desmarcar todos"
                            : "Marcar todos"}
                        </button>
                      </>
                    )}
                  </div>
                  {aberto && (
                    <div
                      className={
                        listaCheiaId === membro.id
                          ? "space-y-1.5 rounded-md border border-[#5c3d0a]/25 bg-white p-2"
                          : "max-h-48 space-y-1.5 overflow-y-auto rounded-md border border-[#5c3d0a]/25 bg-white p-2"
                      }
                    >
                      {pontos.length === 0 ? (
                        <p className="text-xs text-[#3d3833]">Cadastre pontos primeiro.</p>
                      ) : (
                        pontos.map((p) => {
                          const checked = pontoIds.includes(p.id);
                          return (
                            <label
                              key={p.id}
                              className="flex cursor-pointer items-center gap-2 text-sm text-[#141210]"
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
      )}
    </section>
  );
}

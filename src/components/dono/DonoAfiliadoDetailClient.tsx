"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Copy, Loader2 } from "lucide-react";
import { DonoShell } from "@/components/dono/DonoShell";

function moneyC(c: number) {
  return (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatWhen(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR");
}

export function DonoAfiliadoDetailClient({
  id,
  email,
}: {
  id: string;
  email: string;
}) {
  const [data, setData] = useState<{
    afiliado: {
      id: string;
      nome: string;
      email: string;
      codigo: string;
      ativo: boolean;
      comissao_tipo: string;
      comissao_valor: number;
      link: string;
      whatsapp: string | null;
    };
    comissoes: {
      id: string;
      empresa_nome: string | null;
      valor_centavos: number;
      status: string;
      created_at: string;
    }[];
    empresas: { id: string; nome_operacao: string; created_at: string }[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [ok, setOk] = useState("");
  const [comissaoValor, setComissaoValor] = useState("");
  const [comissaoTipo, setComissaoTipo] = useState("percentual");
  const [senha, setSenha] = useState("");

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/dono/afiliados/${id}`);
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Falha.");
      setData(j);
      setComissaoValor(String(j.afiliado.comissao_valor));
      setComissaoTipo(j.afiliado.comissao_tipo);
      setErro("");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function patch(body: Record<string, unknown>) {
    setErro("");
    setOk("");
    const res = await fetch(`/api/dono/afiliados/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const j = await res.json();
    if (!res.ok) {
      setErro(j.error ?? "Falha.");
      return;
    }
    setOk("Atualizado.");
    await carregar();
  }

  if (loading && !data) {
    return (
      <DonoShell email={email} title="Afiliado">
        <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
      </DonoShell>
    );
  }

  if (!data) {
    return (
      <DonoShell email={email} title="Afiliado">
        <p className="text-rose-300">{erro || "Não encontrado."}</p>
      </DonoShell>
    );
  }

  const a = data.afiliado;

  return (
    <DonoShell email={email} title={a.nome} subtitle={`@${a.codigo} · ${a.email}`}>
      <div className="space-y-6">
        <Link
          href="/dono/afiliados"
          className="inline-flex items-center gap-2 text-[13px] text-slate-400 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Afiliados
        </Link>

        {erro && (
          <p className="rounded-xl border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-[13px] text-rose-200">
            {erro}
          </p>
        )}
        {ok && (
          <p className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-[13px] text-emerald-200">
            {ok}
          </p>
        )}

        <div className="rounded-2xl border border-white/[0.07] p-5 space-y-3">
          <p className="text-[11px] uppercase tracking-wider text-slate-500">Link</p>
          <div className="flex flex-wrap items-center gap-2">
            <code className="rounded-lg bg-white/[0.04] px-3 py-2 text-[12px] text-slate-300">
              {a.link}
            </code>
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard.writeText(a.link);
                setOk("Link copiado.");
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-[12px]"
            >
              <Copy className="h-3.5 w-3.5" />
              Copiar
            </button>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-white/[0.07] p-5 space-y-3">
            <p className="text-[11px] uppercase tracking-wider text-slate-500">
              Comissão
            </p>
            <div className="flex gap-2">
              <select
                value={comissaoTipo}
                onChange={(e) => setComissaoTipo(e.target.value)}
                className="rounded-lg border border-white/10 bg-transparent px-3 py-2 text-[13px]"
              >
                <option value="percentual">%</option>
                <option value="fixo">R$ fixo</option>
              </select>
              <input
                type="number"
                value={comissaoValor}
                onChange={(e) => setComissaoValor(e.target.value)}
                className="w-28 rounded-lg border border-white/10 bg-transparent px-3 py-2 text-[13px]"
              />
              <button
                type="button"
                onClick={() =>
                  void patch({
                    comissao_tipo: comissaoTipo,
                    comissao_valor: Number(comissaoValor),
                  })
                }
                className="rounded-lg border border-[#c4a574]/35 px-3 py-2 text-[12px] text-[#e8d5b0]"
              >
                Salvar
              </button>
            </div>
            <button
              type="button"
              onClick={() => void patch({ ativo: !a.ativo })}
              className="rounded-lg border border-white/10 px-3 py-2 text-[12px]"
            >
              {a.ativo ? "Pausar afiliado" : "Reativar afiliado"}
            </button>
            <div className="flex gap-2 pt-2">
              <input
                type="password"
                placeholder="Nova senha do parceiro"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                className="flex-1 rounded-lg border border-white/10 bg-transparent px-3 py-2 text-[13px]"
              />
              <button
                type="button"
                onClick={() => {
                  if (senha.length >= 6) void patch({ senha });
                  else setErro("Senha mínima 6 caracteres.");
                }}
                className="rounded-lg border border-white/10 px-3 py-2 text-[12px]"
              >
                Trocar senha
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-white/[0.07] p-5">
            <p className="mb-3 text-[11px] uppercase tracking-wider text-slate-500">
              Clientes indicados
            </p>
            <ul className="space-y-2 text-[13px]">
              {data.empresas.length === 0 && (
                <li className="text-slate-500">Nenhum ainda.</li>
              )}
              {data.empresas.map((e) => (
                <li key={e.id} className="flex justify-between gap-2">
                  <Link
                    href={`/dono/empresas/${e.id}`}
                    className="text-[#f4efe6] hover:underline"
                  >
                    {e.nome_operacao}
                  </Link>
                  <span className="text-slate-600">{formatWhen(e.created_at)}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="rounded-2xl border border-white/[0.07] p-5">
          <p className="mb-3 text-[11px] uppercase tracking-wider text-slate-500">
            Comissões
          </p>
          <ul className="divide-y divide-white/[0.05]">
            {data.comissoes.length === 0 && (
              <li className="py-4 text-[13px] text-slate-500">
                Nenhuma comissão. Elas nascem quando você registra pagamento no
                Financeiro de um cliente indicado.
              </li>
            )}
            {data.comissoes.map((c) => (
              <li
                key={c.id}
                className="flex flex-wrap items-center justify-between gap-2 py-3 text-[13px]"
              >
                <div>
                  <p className="text-[#f4efe6]">{c.empresa_nome ?? "Cliente"}</p>
                  <p className="text-[11px] text-slate-600">
                    {formatWhen(c.created_at)} · {c.status}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="tabular-nums text-[#e8d5b0]">
                    {moneyC(c.valor_centavos)}
                  </span>
                  {c.status === "pendente" && (
                    <button
                      type="button"
                      onClick={() =>
                        void patch({
                          acao: "marcar_comissao",
                          comissao_id: c.id,
                          status: "pago",
                        })
                      }
                      className="rounded-lg border border-emerald-500/30 px-2.5 py-1 text-[11px] text-emerald-200"
                    >
                      Marcar pago
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </DonoShell>
  );
}

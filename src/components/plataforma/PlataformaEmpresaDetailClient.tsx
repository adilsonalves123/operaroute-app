"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { PlataformaShell } from "@/components/plataforma/PlataformaShell";
import type { TenantResumo } from "@/lib/plataforma/tenants";
import { cn } from "@/lib/utils";

function money(n: number | null) {
  if (n == null) return "Sob consulta";
  return n.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
}

function formatWhen(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function PlataformaEmpresaDetailClient({ empresaId }: { empresaId: string }) {
  const [tenant, setTenant] = useState<TenantResumo | null>(null);
  const [uso, setUso] = useState({ coletas: 0, financeiro: 0 });
  const [sessoes, setSessoes] = useState<
    { id: string; user_nome: string | null; iniciado_em: string; dispositivo: string | null }[]
  >([]);
  const [suporte, setSuporte] = useState<
    { id: string; modo: string; assunto: string | null; last_message_at: string; user_nome: string | null }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [erro, setErro] = useState("");
  const [ok, setOk] = useState("");
  const [draftNichos, setDraftNichos] = useState<string[]>([]);
  const [nichoMsg, setNichoMsg] = useState("");

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/plataforma/empresas/${empresaId}`);
      const data = await res.json();
      if (!res.ok) {
        setErro(data.error ?? "Falha.");
        return;
      }
      setTenant(data.tenant);
      setUso(data.uso ?? { coletas: 0, financeiro: 0 });
      setSessoes(data.sessoes ?? []);
      setSuporte(data.suporte ?? []);
      setDraftNichos(
        (data.tenant?.nichos_ativos ?? []).filter((n: string) => n !== "outros")
      );
      setErro("");
    } catch {
      setErro("Falha de rede.");
    } finally {
      setLoading(false);
    }
  }, [empresaId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function acao(payload: Record<string, unknown>) {
    setActing(true);
    setOk("");
    setErro("");
    try {
      const res = await fetch(`/api/plataforma/empresas/${empresaId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setErro(data.error ?? "Não executou.");
        return;
      }
      if (data.tenant) setTenant(data.tenant);
      setOk("Atualizado.");
      void carregar();
    } catch {
      setErro("Falha ao executar ação.");
    } finally {
      setActing(false);
    }
  }

  return (
    <PlataformaShell
      title={tenant?.nome_operacao ?? "Cliente"}
      subtitle={tenant ? `${tenant.owner_nome ?? "—"} · ${tenant.owner_email ?? "sem e-mail"}` : undefined}
    >
      <Link
        href="/plataforma/empresas"
        className="mb-6 inline-block text-[12px] text-at-muted hover:text-at-link"
      >
        ← Todos os clientes
      </Link>

      {loading && (
        <div className="flex items-center gap-2 text-at-muted">
          <Loader2 className="h-4 w-4 animate-spin" />
          Carregando…
        </div>
      )}

      {erro && (
        <p className="mb-4 rounded-sm border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-[13px] text-rose-200">
          {erro}
        </p>
      )}
      {ok && (
        <p className="mb-4 rounded-sm border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-[13px] text-emerald-200">
          {ok}
        </p>
      )}

      {tenant && !loading && (
        <div className="space-y-8">
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-sm border border-at bg-at-card-soft sm:grid-cols-4">
            {[
              { label: "MRR estimado", value: money(tenant.mrr_estimado) },
              { label: "Pontos", value: String(tenant.pontos_count) },
              { label: "Máquinas", value: String(tenant.equipamentos_count) },
              { label: "Equipe", value: String(tenant.equipe_count) },
            ].map((c) => (
              <div key={c.label} className="bg-at-card/95 px-4 py-3.5">
                <p className="text-[10px] uppercase tracking-[0.14em] text-at-muted">
                  {c.label}
                </p>
                <p className="mt-1 text-[20px] tabular-nums text-at-primary">{c.value}</p>
              </div>
            ))}
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-sm border border-at p-4 space-y-2 text-[13px]">
              <p className="text-[10px] uppercase tracking-[0.16em] text-at-muted">Conta</p>
              <Row label="Saúde" value={tenant.saude} />
              <Row label="Status empresa" value={tenant.status ?? "—"} />
              <Row
                label="Assinatura"
                value={tenant.assinatura_ativa ? "Ativa" : "Inativa"}
              />
              <Row label="Trial até" value={formatWhen(tenant.trial_fim)} />
              <Row label="Faixa" value={tenant.quantidade_pontos ?? "—"} />
              <Row
                label="Nichos"
                value={tenant.nichos_ativos.join(", ") || "—"}
              />
              <Row label="Cadastro" value={formatWhen(tenant.created_at)} />
              <Row label="WhatsApp" value={tenant.owner_whatsapp ?? "—"} />
              <Row label="Coletas" value={String(uso.coletas)} />
              <Row label="Lançamentos fin." value={String(uso.financeiro)} />
            </div>

            <div className="rounded-sm border border-at p-4">
              <p className="text-[10px] uppercase tracking-[0.16em] text-at-muted">
                Ações do dono
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <ActionBtn
                  disabled={acting}
                  onClick={() => void acao({ acao: "estender_trial", dias: 7 })}
                >
                  +7 dias trial
                </ActionBtn>
                <ActionBtn
                  disabled={acting}
                  onClick={() => void acao({ acao: "estender_trial", dias: 30 })}
                >
                  +30 dias trial
                </ActionBtn>
                <ActionBtn
                  disabled={acting}
                  onClick={() =>
                    void acao({
                      acao: "assinatura",
                      assinatura_ativa: !tenant.assinatura_ativa,
                    })
                  }
                >
                  {tenant.assinatura_ativa ? "Desativar assinatura" : "Ativar assinatura"}
                </ActionBtn>
                {tenant.saude === "suspenso" ? (
                  <ActionBtn
                    disabled={acting}
                    onClick={() => void acao({ acao: "reativar" })}
                  >
                    Reativar
                  </ActionBtn>
                ) : (
                  <ActionBtn
                    disabled={acting}
                    danger
                    onClick={() => {
                      if (confirm("Suspender esta operação?")) {
                        void acao({ acao: "suspender" });
                      }
                    }}
                  >
                    Suspender
                  </ActionBtn>
                )}
              </div>

              <div className="mt-6 border-t border-at pt-4">
                <p className="text-[10px] uppercase tracking-[0.16em] text-at-muted">
                  Alterar nichos (suporte)
                </p>
                <p className="mt-1 text-[11px] text-at-soft">
                  Marque e clique em Salvar. Pode trocar mesmo acima do limite do plano.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {(
                    [
                      ["fura_fura", "Fura Fura"],
                      ["maquinas_cassino", "Cassino"],
                      ["ursinho", "Ursinho"],
                      ["diversao", "Diversão"],
                      ["bolinha", "Bolinha"],
                      ["consignado", "Consignado"],
                    ] as const
                  ).map(([id, label]) => {
                    const on = draftNichos.includes(id);
                    return (
                      <button
                        key={id}
                        type="button"
                        disabled={acting}
                        onClick={() => {
                          setNichoMsg("");
                          setDraftNichos((prev) =>
                            prev.includes(id)
                              ? prev.filter((n) => n !== id)
                              : [...prev, id]
                          );
                        }}
                        className={cn(
                          "rounded-sm border px-2.5 py-1.5 text-[11px] transition",
                          on
                            ? "border-cyan-400/40 bg-cyan-400/10 text-cyan-100"
                            : "border-at-soft text-at-muted hover:border-at hover:text-at-primary/85"
                        )}
                      >
                        {on ? "✓ " : ""}
                        {label}
                      </button>
                    );
                  })}
                </div>
                {nichoMsg && (
                  <p
                    className={cn(
                      "mt-2 text-[12px]",
                      nichoMsg.startsWith("Erro") ? "text-rose-300" : "text-emerald-300"
                    )}
                  >
                    {nichoMsg}
                  </p>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  <ActionBtn
                    disabled={acting || draftNichos.length === 0}
                    onClick={() => {
                      setNichoMsg("");
                      void (async () => {
                        setActing(true);
                        try {
                          const res = await fetch(
                            `/api/plataforma/empresas/${empresaId}`,
                            {
                              method: "PATCH",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                acao: "definir_nichos",
                                nichos: draftNichos,
                                quantidade_pontos: tenant.quantidade_pontos,
                              }),
                            }
                          );
                          const data = await res.json();
                          if (!res.ok) {
                            setNichoMsg(`Erro: ${data.error ?? "Não salvou."}`);
                            return;
                          }
                          if (data.tenant) setTenant(data.tenant);
                          setDraftNichos(
                            (data.tenant?.nichos_ativos ?? []).filter(
                              (n: string) => n !== "outros"
                            )
                          );
                          setNichoMsg("Nichos atualizados.");
                          setOk("Nichos atualizados.");
                        } catch {
                          setNichoMsg("Erro: falha de rede.");
                        } finally {
                          setActing(false);
                        }
                      })();
                    }}
                  >
                    Salvar nichos
                  </ActionBtn>
                  <button
                    type="button"
                    disabled={acting}
                    onClick={() => {
                      setDraftNichos(
                        tenant.nichos_ativos.filter((n) => n !== "outros")
                      );
                      setNichoMsg("");
                    }}
                    className="rounded-sm border border-at-soft px-3 py-2 text-[12px] text-at-muted hover:border-at hover:text-at-primary"
                  >
                    Desfazer
                  </button>
                </div>
              </div>

              <p className="mt-4 text-[11px] text-at-soft">
                MRR é estimado pelos planos (ainda sem gateway de pagamento).
              </p>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div>
              <p className="mb-2 text-[11px] uppercase tracking-[0.16em] text-at-soft">
                Últimos acessos
              </p>
              <ul className="divide-y divide-white/[0.05] rounded-sm border border-at">
                {sessoes.length === 0 && (
                  <li className="px-3 py-6 text-center text-[12px] text-at-muted">
                    Sem sessões registradas.
                  </li>
                )}
                {sessoes.map((s) => (
                  <li key={s.id} className="px-3 py-2.5 text-[12px]">
                    <p className="text-at-primary">{s.user_nome ?? "Usuário"}</p>
                    <p className="text-at-muted">
                      {formatWhen(s.iniciado_em)} · {s.dispositivo ?? "—"}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="mb-2 text-[11px] uppercase tracking-[0.16em] text-at-soft">
                Suporte
              </p>
              <ul className="divide-y divide-white/[0.05] rounded-sm border border-at">
                {suporte.length === 0 && (
                  <li className="px-3 py-6 text-center text-[12px] text-at-muted">
                    Sem conversas.
                  </li>
                )}
                {suporte.map((s) => (
                  <li key={s.id} className="px-3 py-2.5 text-[12px]">
                    <p className="text-at-primary">{s.assunto ?? "Sem assunto"}</p>
                    <p className="text-at-muted">
                      {s.modo} · {s.user_nome} · {formatWhen(s.last_message_at)}
                    </p>
                  </li>
                ))}
              </ul>
              <Link
                href="/suporte/inbox"
                className="mt-3 inline-block text-[12px] text-at-link hover:underline"
              >
                Abrir inbox suporte →
              </Link>
            </div>
          </div>
        </div>
      )}
    </PlataformaShell>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 border-b border-white/[0.04] py-1.5 last:border-0">
      <span className="text-at-muted">{label}</span>
      <span className="text-right text-at-primary/85">{value}</span>
    </div>
  );
}

function ActionBtn({
  children,
  onClick,
  disabled,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "rounded-sm border px-3 py-2 text-[12px] transition disabled:opacity-40",
        danger
          ? "border-rose-500/30 text-rose-300 hover:bg-rose-500/10"
          : "border-at-soft text-at-primary/85 hover:border-[#c4a574]/35 hover:text-at-link"
      )}
    >
      {children}
    </button>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { DonoShell } from "@/components/dono/DonoShell";
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

export function DonoEmpresaDetailClient({
  empresaId,
  email,
}: {
  empresaId: string;
  email: string;
}) {
  const [tenant, setTenant] = useState<TenantResumo | null>(null);
  const [pesquisa, setPesquisa] = useState<{
    objetivo_principal: string | null;
    possui_funcionarios: boolean | null;
  } | null>(null);
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
  const [cortesiaQtd, setCortesiaQtd] = useState("30");
  const [cortesiaUnidade, setCortesiaUnidade] = useState<"dias" | "meses">("dias");
  const [cortesiaModo, setCortesiaModo] = useState<"somar" | "hoje">("somar");
  const [cortesiaData, setCortesiaData] = useState("");
  const [cortesiaMotivo, setCortesiaMotivo] = useState("");
  const [draftNichos, setDraftNichos] = useState<string[]>([]);
  const [nichoMsg, setNichoMsg] = useState("");

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/dono/empresas/${empresaId}`);
      const data = await res.json();
      if (!res.ok) {
        setErro(data.error ?? "Falha.");
        return;
      }
      setTenant(data.tenant);
      setPesquisa(data.pesquisa ?? null);
      setUso(data.uso ?? { coletas: 0, financeiro: 0 });
      setSessoes(data.sessoes ?? []);
      setSuporte(data.suporte ?? []);
      const pagos = (data.tenant?.nichos_ativos ?? []).filter(
        (n: string) => n !== "outros"
      );
      setDraftNichos(pagos);
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
      const res = await fetch(`/api/dono/empresas/${empresaId}`, {
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
    <DonoShell
      email={email}
      title={tenant?.nome_operacao ?? "Cliente"}
      subtitle={
        tenant ? `${tenant.owner_nome ?? "—"} · ${tenant.owner_email ?? "sem e-mail"}` : undefined
      }
    >
      <Link
        href="/dono/empresas"
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
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-sm border border-at bg-at-card-soft sm:grid-cols-5">
            {[
              {
                label: tenant.pagamento_confirmado ? "MRR pago" : "Catálogo",
                value: tenant.pagamento_confirmado
                  ? money(tenant.mrr_pago || tenant.mrr_estimado)
                  : money(tenant.mrr_estimado),
              },
              {
                label: "Ciclo",
                value: tenant.ciclo_cobranca === "anual" ? "Anual" : "Mensal",
              },
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
            <div className="space-y-2 rounded-sm border border-at p-4 text-[13px]">
              <p className="text-[10px] uppercase tracking-[0.16em] text-at-muted">Conta</p>
              <Row label="Saúde" value={tenant.saude} />
              <Row label="Status empresa" value={tenant.status ?? "—"} />
              <Row
                label="Assinatura"
                value={tenant.assinatura_ativa ? "Ativa" : "Inativa"}
              />
              <Row label="Trial / cortesia até" value={formatWhen(tenant.trial_fim)} />
              <Row
                label="Ciclo cobrança"
                value={tenant.ciclo_cobranca === "anual" ? "Anual" : "Mensal"}
              />
              <Row label="Faixa" value={tenant.quantidade_pontos ?? "—"} />
              <Row label="Nichos" value={tenant.nichos_ativos.join(", ") || "—"} />
              <Row
                label="Objetivo (pesquisa)"
                value={pesquisa?.objetivo_principal ?? "—"}
              />
              <Row
                label="Tem funcionários"
                value={
                  pesquisa?.possui_funcionarios == null
                    ? "—"
                    : pesquisa.possui_funcionarios
                      ? "Sim"
                      : "Não"
                }
              />
              <Row label="Cadastro" value={formatWhen(tenant.created_at)} />
              <Row label="WhatsApp" value={tenant.owner_whatsapp ?? "—"} />
              <Row label="Coletas" value={String(uso.coletas)} />
              <Row label="Lançamentos fin." value={String(uso.financeiro)} />
            </div>

            <div className="space-y-4 rounded-sm border border-at p-4">
              <div>
                <p className="text-[10px] uppercase tracking-[0.16em] text-at-muted">
                  Cortesia
                </p>
                <p className="mt-1 text-[12px] text-at-muted">
                  Só neste cliente. Não altera planos nem outros usuários.
                </p>
              </div>

              <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                <input
                  type="number"
                  min={1}
                  value={cortesiaQtd}
                  onChange={(e) => setCortesiaQtd(e.target.value)}
                  placeholder="Quantidade"
                  className="rounded-sm border border-at-soft bg-at-card-soft px-3 py-2 text-[13px] text-at-primary outline-none focus:border-[#c4a574]/40"
                />
                <select
                  value={cortesiaUnidade}
                  onChange={(e) =>
                    setCortesiaUnidade(e.target.value as "dias" | "meses")
                  }
                  className="rounded-sm border border-at-soft bg-at-card-soft px-3 py-2 text-[13px] text-at-primary outline-none"
                >
                  <option value="dias">Dias</option>
                  <option value="meses">Meses</option>
                </select>
              </div>

              <select
                value={cortesiaModo}
                onChange={(e) =>
                  setCortesiaModo(e.target.value as "somar" | "hoje")
                }
                className="w-full rounded-sm border border-at-soft bg-at-card-soft px-3 py-2 text-[13px] text-at-primary outline-none"
              >
                <option value="somar">Somar ao prazo atual (se ainda válido)</option>
                <option value="hoje">Contar a partir de hoje</option>
              </select>

              <div>
                <p className="mb-1 text-[11px] text-at-muted">
                  Ou defina a data final exata
                </p>
                <input
                  type="date"
                  value={cortesiaData}
                  onChange={(e) => setCortesiaData(e.target.value)}
                  className="w-full rounded-sm border border-at-soft bg-at-card-soft px-3 py-2 text-[13px] text-at-primary outline-none"
                />
              </div>

              <input
                value={cortesiaMotivo}
                onChange={(e) => setCortesiaMotivo(e.target.value)}
                placeholder="Motivo (opcional) — ex.: parceiro, cortesia Adilson"
                className="w-full rounded-sm border border-at-soft bg-at-card-soft px-3 py-2 text-[13px] text-at-primary outline-none placeholder:text-at-soft"
              />

              <div className="flex flex-wrap gap-2">
                {[
                  { q: "7", u: "dias" as const, l: "7 dias" },
                  { q: "30", u: "dias" as const, l: "1 mês" },
                  { q: "90", u: "dias" as const, l: "3 meses" },
                  { q: "6", u: "meses" as const, l: "6 meses" },
                  { q: "12", u: "meses" as const, l: "1 ano" },
                ].map((p) => (
                  <button
                    key={p.l}
                    type="button"
                    disabled={acting}
                    onClick={() => {
                      setCortesiaQtd(p.q);
                      setCortesiaUnidade(p.u);
                      setCortesiaData("");
                    }}
                    className="rounded-sm border border-at-soft px-2.5 py-1 text-[11px] text-at-muted hover:border-at hover:text-at-primary"
                  >
                    {p.l}
                  </button>
                ))}
              </div>

              <ActionBtn
                disabled={acting}
                onClick={() => {
                  if (cortesiaData) {
                    void acao({
                      acao: "cortesia",
                      data_fim: cortesiaData,
                      motivo: cortesiaMotivo || undefined,
                    });
                    return;
                  }
                  const qtd = Math.floor(Number(cortesiaQtd) || 0);
                  if (qtd < 1) {
                    setErro("Informe quantos dias ou meses de cortesia.");
                    return;
                  }
                  void acao({
                    acao: "cortesia",
                    quantidade: qtd,
                    unidade: cortesiaUnidade,
                    modo:
                      cortesiaModo === "hoje"
                        ? "definir_a_partir_de_hoje"
                        : "somar",
                    motivo: cortesiaMotivo || undefined,
                  });
                }}
              >
                Aplicar cortesia
              </ActionBtn>

              <div className="border-t border-at pt-4">
                <p className="text-[10px] uppercase tracking-[0.16em] text-at-muted">
                  Alterar nichos (suporte)
                </p>
                <p className="mt-1 text-[12px] text-at-muted">
                  Marque os nichos desejados e clique em Salvar. Pode trocar mesmo
                  acima do limite do plano.
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
                          setDraftNichos((prev) => {
                            if (prev.includes(id)) {
                              return prev.filter((n) => n !== id);
                            }
                            return [...prev, id];
                          });
                        }}
                        className={cn(
                          "rounded-sm border px-2.5 py-1.5 text-[11px] transition",
                          on
                            ? "border-[#c4a574]/40 bg-[#c4a574]/10 text-at-primary"
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
                      nichoMsg.startsWith("Erro")
                        ? "text-rose-300"
                        : "text-emerald-300"
                    )}
                  >
                    {nichoMsg}
                  </p>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  <ActionBtn
                    disabled={acting || draftNichos.length === 0}
                    onClick={() => {
                      if (draftNichos.length === 0) {
                        setNichoMsg("Erro: deixe pelo menos um nicho.");
                        return;
                      }
                      setNichoMsg("");
                      void (async () => {
                        setActing(true);
                        setOk("");
                        setErro("");
                        try {
                          const res = await fetch(
                            `/api/dono/empresas/${empresaId}`,
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
                          const pagos = (data.tenant?.nichos_ativos ?? []).filter(
                            (n: string) => n !== "outros"
                          );
                          setDraftNichos(pagos);
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

              <div className="border-t border-at pt-4">
                <p className="text-[10px] uppercase tracking-[0.16em] text-at-muted">
                  Outras ações
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
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
                <ActionBtn
                  disabled={acting}
                  onClick={() =>
                    void acao({
                      acao: "ciclo",
                      ciclo: tenant.ciclo_cobranca === "anual" ? "mensal" : "anual",
                    })
                  }
                >
                  Mudar para {tenant.ciclo_cobranca === "anual" ? "mensal" : "anual"}
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
              </div>
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
            </div>
          </div>
        </div>
      )}
    </DonoShell>
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

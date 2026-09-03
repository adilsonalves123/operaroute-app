"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { DonoShell } from "@/components/dono/DonoShell";

type Sessao = {
  id: string;
  user_nome: string | null;
  user_email?: string | null;
  empresa_id: string | null;
  empresa_nome: string | null;
  iniciado_em: string;
  ultimo_ping?: string | null;
  dispositivo: string | null;
  ip?: string | null;
};

type Evento = {
  id: string;
  empresa_id: string | null;
  empresa_nome: string | null;
  user_nome: string | null;
  acao: string;
  titulo: string | null;
  severidade: string | null;
  created_at: string;
  modulo: string | null;
};

function when(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function DonoAtividadeClient({ email }: { email: string }) {
  const [sessoes, setSessoes] = useState<Sessao[]>([]);
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [resumo, setResumo] = useState({ sessoes_24h: 0, sessoes_7d: 0 });
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [badge, setBadge] = useState(0);

  useEffect(() => {
    void (async () => {
      try {
        const [res, cmd] = await Promise.all([
          fetch("/api/dono/atividade"),
          fetch("/api/dono/command"),
        ]);
        const data = await res.json();
        const c = await cmd.json();
        if (!res.ok) {
          setErro(data.error ?? "Falha.");
          return;
        }
        setSessoes(data.sessoes ?? []);
        setEventos(data.eventos ?? []);
        setResumo(data.resumo ?? { sessoes_24h: 0, sessoes_7d: 0 });
        if (c.suporte?.humano_aberto) setBadge(c.suporte.humano_aberto);
      } catch {
        setErro("Falha de rede.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <DonoShell
      email={email}
      badgeSuporte={badge}
      title="Atividade"
      subtitle="Quem acessou o produto, de qual operação, e o que aconteceu no sistema."
      wide
    >
      {loading && (
        <div className="flex items-center gap-2 text-at-muted">
          <Loader2 className="h-4 w-4 animate-spin" />
          Carregando…
        </div>
      )}
      {erro && (
        <p className="rounded-sm border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-[13px] text-rose-200">
          {erro}
        </p>
      )}

      {!loading && !erro && (
        <div className="space-y-8">
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-sm border border-at bg-white/[0.07] sm:grid-cols-2 lg:max-w-md">
            <div className="bg-[#080b12] px-4 py-4">
              <p className="text-[10px] uppercase tracking-[0.16em] text-at-muted">
                Sessões 24h
              </p>
              <p className="mt-1 text-[24px] tabular-nums text-at-primary">
                {resumo.sessoes_24h}
              </p>
            </div>
            <div className="bg-[#080b12] px-4 py-4">
              <p className="text-[10px] uppercase tracking-[0.16em] text-at-muted">
                Sessões 7d
              </p>
              <p className="mt-1 text-[24px] tabular-nums text-at-primary">
                {resumo.sessoes_7d}
              </p>
            </div>
          </div>

          <div className="grid gap-8 lg:grid-cols-2">
            <section>
              <p className="mb-3 text-[11px] uppercase tracking-[0.16em] text-at-soft">
                Sessões recentes
              </p>
              <div className="overflow-x-auto rounded-sm border border-at">
                <table className="w-full min-w-[520px] text-left text-[13px]">
                  <thead>
                    <tr className="border-b border-at text-[10px] uppercase tracking-wider text-at-muted">
                      <th className="px-3 py-2.5 font-medium">Usuário</th>
                      <th className="px-3 py-2.5 font-medium">Operação</th>
                      <th className="px-3 py-2.5 font-medium">Quando</th>
                      <th className="px-3 py-2.5 font-medium">Disp.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--at-border-soft)]">
                    {sessoes.length === 0 && (
                      <tr>
                        <td
                          colSpan={4}
                          className="px-3 py-8 text-center text-at-muted"
                        >
                          Sem sessões. Rode auditoria-elaborada.sql se ainda não
                          rodou.
                        </td>
                      </tr>
                    )}
                    {sessoes.map((s) => (
                      <tr key={s.id} className="hover:bg-white/[0.015]">
                        <td className="px-3 py-2.5">
                          <p className="text-at-primary">
                            {s.user_nome ?? "—"}
                          </p>
                          <p className="text-[11px] text-at-soft">
                            {s.user_email ?? ""}
                          </p>
                        </td>
                        <td className="px-3 py-2.5">
                          {s.empresa_id ? (
                            <Link
                              href={`/dono/empresas/${s.empresa_id}`}
                              className="text-at-primary/85 hover:text-at-link"
                            >
                              {s.empresa_nome ?? "Cliente"}
                            </Link>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-at-muted">
                          {when(s.iniciado_em)}
                        </td>
                        <td className="px-3 py-2.5 text-at-muted">
                          {s.dispositivo ?? "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section>
              <p className="mb-3 text-[11px] uppercase tracking-[0.16em] text-at-soft">
                Eventos de auditoria
              </p>
              <ul className="max-h-[70vh] divide-y divide-white/[0.05] overflow-y-auto rounded-sm border border-at">
                {eventos.length === 0 && (
                  <li className="px-4 py-8 text-center text-[12px] text-at-muted">
                    Sem eventos.
                  </li>
                )}
                {eventos.map((e) => (
                  <li key={e.id} className="px-4 py-3 text-[13px]">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-at-primary">
                        {e.titulo || e.acao}
                      </p>
                      <span className="shrink-0 text-[10px] uppercase text-at-soft">
                        {e.severidade}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-at-muted">
                      {e.empresa_nome ?? "—"} · {e.user_nome ?? "—"} ·{" "}
                      {e.modulo} · {when(e.created_at)}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </div>
      )}
    </DonoShell>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Loader2, LogOut } from "lucide-react";

function moneyC(c: number) {
  return (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatWhen(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR");
}

export function ParceiroDashboardClient() {
  const router = useRouter();
  const [data, setData] = useState<{
    afiliado: {
      nome: string;
      codigo: string;
      link: string;
      comissao_tipo: string;
      comissao_valor: number;
    };
    resumo: {
      clicks: number;
      cadastros: number;
      clientes: number;
      pendente_centavos: number;
      pago_centavos: number;
    };
    comissoes: {
      id: string;
      empresa_nome: string | null;
      valor_centavos: number;
      status: string;
      created_at: string;
    }[];
    empresas: {
      id: string;
      nome_operacao: string;
      created_at: string;
      ciclo_cobranca?: "mensal" | "anual" | string | null;
    }[];
  } | null>(null);
  const [erro, setErro] = useState("");
  const [ok, setOk] = useState("");

  useEffect(() => {
    void fetch("/api/parceiro/me")
      .then(async (r) => {
        if (r.status === 401) {
          router.replace("/parceiro/login");
          return null;
        }
        const j = await r.json();
        if (!r.ok) throw new Error(j.error ?? "Falha.");
        return j;
      })
      .then((j) => {
        if (j) setData(j);
      })
      .catch((e) => setErro(e instanceof Error ? e.message : "Erro."));
  }, [router]);

  async function sair() {
    await fetch("/api/parceiro/login", { method: "DELETE" });
    router.push("/parceiro/login");
  }

  if (!data && !erro) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-at-muted" />
      </div>
    );
  }

  if (erro || !data) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-rose-200">{erro}</div>
    );
  }

  const { afiliado, resumo } = data;

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-10">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-at-muted">
            Parceiro OperaRoute
          </p>
          <h1 className="mt-1 text-3xl font-semibold text-white">{afiliado.nome}</h1>
          <p className="mt-1 text-[13px] text-at-muted">
            @{afiliado.codigo} · comissão{" "}
            {afiliado.comissao_tipo === "fixo"
              ? moneyC(Math.round(afiliado.comissao_valor * 100))
              : `${afiliado.comissao_valor}%`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void sair()}
          className="inline-flex items-center gap-2 rounded-xl border border-at-soft px-3 py-2 text-[12px] text-at-muted"
        >
          <LogOut className="h-3.5 w-3.5" />
          Sair
        </button>
      </header>

      {ok && (
        <p className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-[13px] text-emerald-200">
          {ok}
        </p>
      )}

      <section className="rounded-2xl border border-at-soft p-5 space-y-3">
        <p className="text-[11px] uppercase tracking-wider text-at-muted">
          Seu link
        </p>
        <code className="block break-all rounded-xl bg-at-card-soft px-3 py-2 text-[12px] text-at-primary/85">
          {afiliado.link}
        </code>
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard.writeText(afiliado.link);
            setOk("Link copiado.");
          }}
          className="inline-flex items-center gap-2 rounded-xl border border-at-soft px-3 py-2 text-[12px]"
        >
          <Copy className="h-3.5 w-3.5" />
          Copiar link
        </button>
      </section>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { l: "Cliques", v: String(resumo.clicks) },
          { l: "Cadastros", v: String(resumo.cadastros) },
          { l: "A receber", v: moneyC(resumo.pendente_centavos) },
          { l: "Já pago", v: moneyC(resumo.pago_centavos) },
        ].map((x) => (
          <div
            key={x.l}
            className="rounded-2xl border border-at bg-white/[0.02] p-4"
          >
            <p className="text-[10px] uppercase tracking-wider text-at-muted">
              {x.l}
            </p>
            <p className="mt-2 text-[20px] font-medium tabular-nums text-white">
              {x.v}
            </p>
          </div>
        ))}
      </div>

      <section className="space-y-3">
        <h2 className="text-[11px] uppercase tracking-wider text-at-muted">
          Indicações
        </h2>
        <ul className="divide-y divide-white/[0.05] rounded-2xl border border-at">
          {data.empresas.length === 0 && (
            <li className="px-4 py-6 text-center text-[13px] text-at-muted">
              Ainda sem clientes pelo seu link.
            </li>
          )}
          {data.empresas.map((e) => (
            <li
              key={e.id}
              className="flex justify-between gap-3 px-4 py-3 text-[13px]"
            >
              <div>
                <p className="text-white">{e.nome_operacao}</p>
                <p className="text-[11px] text-at-soft">
                  Cliente {e.ciclo_cobranca === "anual" ? "anual" : "mensal"}
                </p>
              </div>
              <span className="shrink-0 text-at-soft">
                {formatWhen(e.created_at)}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-[11px] uppercase tracking-wider text-at-muted">
          Comissões
        </h2>
        <ul className="divide-y divide-white/[0.05] rounded-2xl border border-at">
          {data.comissoes.length === 0 && (
            <li className="px-4 py-6 text-center text-[13px] text-at-muted">
              Comissões aparecem quando o pagamento do cliente for registrado.
            </li>
          )}
          {data.comissoes.map((c) => (
            <li
              key={c.id}
              className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-[13px]"
            >
              <div>
                <p className="text-white">{c.empresa_nome ?? "Cliente"}</p>
                <p className="text-[11px] text-at-soft">
                  {formatWhen(c.created_at)} · {c.status}
                </p>
              </div>
              <span className="tabular-nums text-at-link">
                {moneyC(c.valor_centavos)}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

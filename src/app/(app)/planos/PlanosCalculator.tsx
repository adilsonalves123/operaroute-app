"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";
import { NichoCardsCarousel } from "@/components/nichos/NichoCardsCarousel";
import { NICHOS } from "@/lib/nicho";
import {
  calcPrecoAnual,
  calcPrecoCiclo,
  formatPreco,
  getPlanoByFaixa,
  MULTIPLICADOR_ANUAL_PADRAO,
  NICHOS_PAGOS,
  PLANOS_PADRAO,
  type FaixaPontos,
  type PlanoDefinicao,
} from "@/lib/pricing";
import type { Nicho } from "@/lib/types/database";
import { cn } from "@/lib/utils";
import { useNichoCatalog } from "@/hooks/useNichoCovers";
import { mensagemNichosTravados } from "@/lib/nichos/nicho-travado";
import Link from "next/link";

type Props = {
  initialFaixa: FaixaPontos;
  initialNichos: Nicho[];
  /** Nichos já salvos na operação — não podem ser removidos pelo cliente. */
  nichosTravados?: Nicho[];
  preselectNicho?: Nicho;
  assinaturaAtiva?: boolean;
  billingStatus?: "success" | "failure" | "pending" | null;
  billingCheckoutId?: string | null;
};

function mergePreselectNicho(initialNichos: Nicho[], preselect?: Nicho): Nicho[] {
  if (!preselect || initialNichos.includes(preselect)) return initialNichos;
  return [...initialNichos, preselect];
}

export function PlanosCalculator({
  initialFaixa,
  initialNichos,
  nichosTravados = [],
  preselectNicho,
  assinaturaAtiva = false,
  billingStatus = null,
  billingCheckoutId = null,
}: Props) {
  const router = useRouter();
  const catalog = useNichoCatalog();
  const [planos, setPlanos] = useState<PlanoDefinicao[]>(PLANOS_PADRAO);
  const [multAnual, setMultAnual] = useState(MULTIPLICADOR_ANUAL_PADRAO);
  const [faixa, setFaixa] = useState<FaixaPontos>(initialFaixa);
  const [nichos, setNichos] = useState<Nicho[]>(() =>
    mergePreselectNicho(initialNichos, preselectNicho)
  );
  const [ciclo, setCiclo] = useState<"mensal" | "anual">("mensal");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(
    preselectNicho && !initialNichos.includes(preselectNicho)
      ? `"${NICHOS[preselectNicho].label}" pré-selecionado. Ajuste a capacidade se precisar e assine.`
      : ""
  );
  const [priceKey, setPriceKey] = useState(0);

  useEffect(() => {
    void fetch("/api/precos")
      .then((r) => r.json())
      .then((d) => {
        if (d?.planos?.length) setPlanos(d.planos);
        if (d?.multiplicador_anual) setMultAnual(Number(d.multiplicador_anual));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!billingStatus) return;
    if (billingStatus === "success") {
      setSuccess(
        "Pagamento recebido. Estamos confirmando sua assinatura — se o acesso não liberar em instantes, atualize a página."
      );
      if (billingCheckoutId) {
        const params = new URLSearchParams(window.location.search);
        const paymentId =
          params.get("payment_id") ||
          params.get("collection_id") ||
          undefined;
        void fetch("/api/billing/confirmar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            checkout_id: billingCheckoutId,
            payment_id: paymentId,
          }),
        })
          .then((r) => r.json())
          .then((d) => {
            if (d?.status === "pago" || d?.ok) {
              setSuccess("Assinatura ativa. Bem-vindo de volta!");
              router.refresh();
            }
          })
          .catch(() => {});
      }
      router.refresh();
    } else if (billingStatus === "failure") {
      setError("Pagamento não concluído. Tente novamente.");
    } else if (billingStatus === "pending") {
      setSuccess(
        "Pagamento em análise. Assim que o Mercado Pago confirmar, sua assinatura libera."
      );
    }
  }, [billingStatus, billingCheckoutId, router]);

  const plano = useMemo(() => getPlanoByFaixa(faixa, planos), [faixa, planos]);
  const precoMensal = plano.precoMensal;
  const precoAnual = calcPrecoAnual(faixa, nichos, planos, multAnual);
  const precoCiclo = calcPrecoCiclo(ciclo, faixa, nichos, planos, multAnual);
  const nichosPagos = nichos.filter((n) => NICHOS_PAGOS.includes(n));
  const activeIndex = Math.max(
    0,
    planos.findIndex((p) => p.id === faixa)
  );
  const markerPct =
    planos.length <= 1 ? 50 : (activeIndex / (planos.length - 1)) * 100;

  const nichosVisiveis = NICHOS_PAGOS.filter(
    (key) => nichos.includes(key) || !catalog.pausados.includes(key)
  );

  function escolherPlano(id: FaixaPontos) {
    setSuccess("");
    setError("");
    const max = getPlanoByFaixa(id, planos).maxNichos;
    if (nichosTravados.length > max) {
      setError(
        `Você já confirmou ${nichosTravados.length} nicho(s). Para reduzir o plano, fale com o suporte.`
      );
      return;
    }
    setFaixa(id);
    setPriceKey((k) => k + 1);
    setNichos((prev) => {
      const pagos = prev.filter((n) => NICHOS_PAGOS.includes(n));
      if (pagos.length <= max) return prev;
      const locked = pagos.filter((n) => nichosTravados.includes(n));
      const extras = pagos.filter((n) => !nichosTravados.includes(n));
      return [...locked, ...extras].slice(0, max);
    });
  }

  function onChangeNichos(next: Nicho[]) {
    setSuccess("");
    setError("");
    const pagos = next.filter((n) => NICHOS_PAGOS.includes(n));
    const removidos = nichosTravados.filter((n) => !pagos.includes(n));
    if (removidos.length > 0) {
      setError(mensagemNichosTravados(removidos));
      return;
    }
    if (pagos.length === 0) {
      setError("Selecione pelo menos um nicho.");
      return;
    }
    if (pagos.length > plano.maxNichos) {
      setError(
        `O plano ${plano.nome} permite até ${plano.maxNichos} nicho(s). Suba a capacidade na régua.`
      );
      return;
    }
    setNichos(pagos);
  }

  async function handleAssinar() {
    setError("");
    setSuccess("");
    setLoading(true);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          nichos,
          quantidade_pontos: faixa,
          ciclo,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Não foi possível iniciar o pagamento.");
        return;
      }
      if (data.init_point) {
        window.location.href = data.init_point as string;
        return;
      }
      setError("Checkout sem link do Mercado Pago.");
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSalvarConfig() {
    setError("");
    setSuccess("");
    setLoading(true);
    try {
      const res = await fetch("/api/empresa/plano", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ nichos, quantidade_pontos: faixa }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Erro ao salvar plano.");
        return;
      }
      setSuccess(`Configuração do ${plano.nome} salva.`);
      router.refresh();
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  const precoLabel =
    ciclo === "anual" && precoCiclo != null
      ? precoCiclo.toLocaleString("pt-BR", {
          style: "currency",
          currency: "BRL",
        }) + "/ano"
      : formatPreco(precoMensal);

  return (
    <>
      <div
        className="planos-route-bg relative overflow-hidden rounded-2xl px-1 py-2 sm:px-2"
        style={{
          fontFamily: "var(--font-planos-sans), system-ui, sans-serif",
        }}
      >
        <header className="relative z-[1] max-w-2xl pt-4 sm:pt-6">
          <p
            className="text-[10px] font-medium uppercase tracking-[0.28em] text-[#c9a87c]"
            style={{ fontFamily: "var(--font-planos-sans), system-ui, sans-serif" }}
          >
            Capacidade da operação
          </p>
          <h1
            className="mt-3 text-[clamp(1.85rem,4.5vw,2.75rem)] font-medium leading-[0.95] tracking-[-0.04em] text-[#f4f7fb]"
            style={{ fontFamily: "var(--font-planos-display), system-ui, sans-serif" }}
          >
            Quanto a operação aguenta?
          </h1>
          <p className="mt-3 max-w-md text-[14px] leading-relaxed text-slate-400">
            Deslize a régua pela quantidade de pontos. Depois marque os nichos
            e assine pelo Mercado Pago.
          </p>
        </header>

        <section className="relative z-[1] mt-10 sm:mt-14" aria-label="Escolher plano">
          <div className="relative px-1 pt-2 pb-1">
            <div className="relative mx-[6%] h-[3px] rounded-full bg-white/10 sm:mx-[4%]">
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-[#c9a87c]/70 transition-[width] duration-500 ease-out"
                style={{ width: `${markerPct}%` }}
              />
              <div
                className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#c9a87c] bg-[#0a0e1a] shadow-[0_0_0_4px_rgba(201,168,124,0.15)] transition-[left] duration-500 ease-out"
                style={{ left: `${markerPct}%` }}
                aria-hidden
              />
            </div>

            <div className="mt-6 grid grid-cols-4 gap-1 sm:gap-2">
              {planos.map((p) => {
                const selected = faixa === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => escolherPlano(p.id)}
                    className={cn(
                      "group flex flex-col items-center rounded-xl px-1 py-3 text-center transition duration-300 sm:px-2",
                      selected ? "bg-white/[0.04]" : "hover:bg-white/[0.02]"
                    )}
                  >
                    <span
                      className={cn(
                        "text-[13px] font-medium tracking-tight transition sm:text-[15px]",
                        selected
                          ? "text-[#f4f7fb]"
                          : "text-slate-500 group-hover:text-slate-300"
                      )}
                      style={{
                        fontFamily:
                          "var(--font-planos-display), system-ui, sans-serif",
                      }}
                    >
                      {p.nome}
                    </span>
                    <span
                      className={cn(
                        "mt-1 text-[10px] sm:text-[11px]",
                        selected ? "text-[#c9a87c]" : "text-slate-600"
                      )}
                    >
                      {p.labelPontos}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div
            key={priceKey}
            className="planos-price-in mt-8 flex flex-wrap items-end justify-between gap-4 border-t border-white/[0.06] pt-6"
          >
            <div>
              <p
                className="text-[clamp(1.75rem,3vw,2.25rem)] font-medium tracking-[-0.03em] text-[#f4f7fb]"
                style={{
                  fontFamily: "var(--font-planos-display), system-ui, sans-serif",
                }}
              >
                {plano.nome}
              </p>
              <p className="mt-1 text-[13px] text-slate-400">
                Até{" "}
                {plano.limitePontos >= 9999 ? "ilimitados" : plano.limitePontos}{" "}
                pontos · até {plano.maxNichos} nicho
                {plano.maxNichos === 1 ? "" : "s"}
              </p>
              <div className="mt-4 inline-flex rounded-xl border border-white/[0.08] bg-white/[0.02] p-1">
                {(
                  [
                    { id: "mensal" as const, label: "Mensal" },
                    { id: "anual" as const, label: "Anual" },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      setCiclo(opt.id);
                      setPriceKey((k) => k + 1);
                    }}
                    className={cn(
                      "rounded-lg px-3 py-1.5 text-[12px] font-medium transition",
                      ciclo === opt.id
                        ? "bg-[#c9a87c]/20 text-[#e8d5b0]"
                        : "text-slate-500 hover:text-slate-300"
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="text-right">
              <p
                className="text-[clamp(1.5rem,3vw,2rem)] font-medium tracking-tight text-[#7dd3e8]"
                style={{
                  fontFamily: "var(--font-planos-display), system-ui, sans-serif",
                }}
              >
                {precoLabel}
              </p>
              {ciclo === "mensal" && precoAnual != null && (
                <p className="mt-0.5 text-[12px] text-slate-500">
                  Anual{" "}
                  {precoAnual.toLocaleString("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  })}{" "}
                  ({multAnual}×)
                </p>
              )}
              {ciclo === "anual" && (
                <p className="mt-0.5 text-[12px] text-slate-500">
                  Equiv. {formatPreco(precoMensal)}
                </p>
              )}
            </div>
          </div>
        </section>

        <section className="relative z-[1] mt-12 overflow-hidden border-t border-white/[0.06] pt-8">
          <NichoCardsCarousel
            values={nichos}
            onChangeMulti={onChangeNichos}
            cards={nichosVisiveis}
            lockedValues={nichosTravados}
            confirmBeforeSelect
            onLockedAttempt={(nicho) => setError(mensagemNichosTravados([nicho]))}
            title="Nichos na rota"
            subtitle={`${nichosPagos.length} de ${plano.maxNichos} no ${plano.nome} — toque para marcar (definitivo)`}
          />
          {nichosTravados.length > 0 && (
            <p className="mt-2 text-[12px] text-slate-500">
              Nichos já confirmados ficam travados. Alteração só pelo{" "}
              <Link href="/suporte" className="text-[#c9a87c] underline-offset-2 hover:underline">
                suporte
              </Link>
              .
            </p>
          )}
          {nichosPagos.length >= plano.maxNichos && (
            <p className="mt-3 text-[12px] text-[#c9a87c]/90">
              Limite do {plano.nome}. Para mais nichos, avance a régua.
            </p>
          )}
        </section>
      </div>

      <div className="pointer-events-none fixed inset-x-0 bottom-[4.75rem] z-40 pb-[env(safe-area-inset-bottom)] lg:bottom-4">
        <div className="pointer-events-auto mx-auto max-w-3xl px-4 lg:px-6">
          <div className="planos-sticky-bar flex flex-col gap-2 rounded-2xl border border-white/10 bg-[#0c1220]/92 px-4 py-3 shadow-[0_-8px_40px_rgba(0,0,0,0.45)] backdrop-blur-md sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <div className="min-w-0">
              {error && (
                <p className="mb-1 text-[12px] text-red-400" role="alert">
                  {error}
                </p>
              )}
              {success && !error && (
                <p className="mb-1 text-[12px] text-emerald-400" role="status">
                  {success}
                </p>
              )}
              <div
                key={`sticky-${priceKey}-${ciclo}`}
                className="planos-price-in flex flex-wrap items-baseline gap-x-3 gap-y-0.5"
              >
                <span
                  className="text-lg font-medium text-[#f4f7fb]"
                  style={{
                    fontFamily:
                      "var(--font-planos-display), system-ui, sans-serif",
                  }}
                >
                  {precoLabel}
                </span>
                <span className="text-[12px] text-slate-500">
                  {plano.nome} · {ciclo} · {nichosPagos.length}/{plano.maxNichos}{" "}
                  nichos
                </span>
              </div>
            </div>
            <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center">
              {assinaturaAtiva && (
                <button
                  type="button"
                  onClick={() => void handleSalvarConfig()}
                  disabled={loading || nichosPagos.length === 0}
                  className="rounded-xl border border-white/15 px-4 py-2.5 text-[12px] font-medium text-slate-300 transition hover:bg-white/[0.04] disabled:opacity-50"
                >
                  Só salvar nichos
                </button>
              )}
              <button
                type="button"
                onClick={() => void handleAssinar()}
                disabled={loading || nichosPagos.length === 0}
                className="rounded-xl bg-[#7dd3e8] px-5 py-2.5 text-[13px] font-semibold text-[#0a0e1a] transition hover:brightness-110 disabled:opacity-50"
              >
                {loading
                  ? "Abrindo Mercado Pago…"
                  : assinaturaAtiva
                    ? `Renovar ${plano.nome}`
                    : `Assinar ${plano.nome}`}
              </button>
            </div>
          </div>
        </div>
      </div>

      <LoadingOverlay
        show={loading}
        message={loading ? "Redirecionando ao Mercado Pago…" : "Processando…"}
      />
    </>
  );
}

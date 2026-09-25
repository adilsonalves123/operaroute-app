"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";
import { NichoCardsCarousel } from "@/components/nichos/NichoCardsCarousel";
import { NICHOS } from "@/lib/nicho";
import {
  calcPrecoAnual,
  calcPrecoCiclo,
  calcPrecoMensal,
  formatPreco,
  getPlanoByFaixa,
  MULTIPLICADOR_ANUAL_PADRAO,
  NICHOS_PAGOS,
  PLANOS_PADRAO,
  planoIncluiIa,
  montarBeneficiosPlano,
  type FaixaPontos,
  type PlanoDefinicao,
} from "@/lib/pricing";
import type { Nicho } from "@/lib/types/database";
import { cn } from "@/lib/utils";
import { useNichoCatalog } from "@/hooks/useNichoCovers";
import { mensagemNichosTravados } from "@/lib/nichos/nicho-travado";
import Link from "next/link";
import { Check, Sparkles } from "lucide-react";

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
  const nichosPagos = nichos.filter((n) => NICHOS_PAGOS.includes(n));
  const precoMensal = calcPrecoMensal(faixa, nichosPagos, planos);
  const precoAnual = calcPrecoAnual(faixa, nichosPagos, planos, multAnual);
  const precoCiclo = calcPrecoCiclo(ciclo, faixa, nichosPagos, planos, multAnual);
  const precoCheio = plano.precoMensal;
  const temDescontoNicho =
    precoMensal != null &&
    precoCheio > 0 &&
    nichosPagos.length > 0 &&
    precoMensal < precoCheio - 0.009;
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
    setPriceKey((k) => k + 1);
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

  const beneficios = montarBeneficiosPlano(plano);
  const comIa = planoIncluiIa(plano);
  const nichosLabel =
    plano.slug === "elite" || plano.maxNichos >= NICHOS_PAGOS.length
      ? "nichos ilimitados"
      : `até ${plano.maxNichos} nicho${plano.maxNichos === 1 ? "" : "s"}`;
  const pontosLabel =
    plano.limitePontos >= 9999
      ? "pontos ilimitados"
      : `até ${plano.limitePontos} pontos`;

  return (
    <>
      <div
        className="planos-route-bg relative overflow-hidden rounded-2xl px-1 py-2 sm:px-2"
        style={{
          fontFamily: "var(--font-planos-sans), system-ui, sans-serif",
        }}
      >
        <div
          className="pointer-events-none absolute -left-16 top-0 h-64 w-64 rounded-full bg-[#4FACFE]/10 blur-[100px]"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -right-10 top-32 h-56 w-56 rounded-full bg-[#7F00FF]/10 blur-[90px]"
          aria-hidden
        />

        <header className="relative z-[1] max-w-2xl pt-4 sm:pt-6">
          <p
            className="text-[10px] font-medium uppercase tracking-[0.28em] text-[#c9a87c]"
            style={{ fontFamily: "var(--font-planos-sans), system-ui, sans-serif" }}
          >
            Capacidade da operação
          </p>
          <h1
            className="mt-3 bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-[clamp(1.85rem,4.5vw,2.75rem)] font-bold leading-[0.95] tracking-tight text-transparent"
            style={{ fontFamily: "var(--font-planos-display), system-ui, sans-serif" }}
          >
            Quanto a operação aguenta?
          </h1>
          <p className="mt-3 max-w-md text-[14px] leading-relaxed text-at-muted">
            Deslize a régua pelos pontos, marque os nichos e o preço se ajusta:
            cassino no valor cheio; fura-fura e bolinha saem mais em conta.
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
                      selected
                        ? "border border-cyan-400/25 bg-slate-900/50 shadow-[0_0_24px_rgba(0,242,254,0.08)] backdrop-blur-md"
                        : "hover:bg-white/[0.02]"
                    )}
                  >
                    <span
                      className={cn(
                        "text-[13px] font-semibold tracking-tight transition sm:text-[15px]",
                        selected
                          ? "text-[#f4f7fb]"
                          : "text-at-muted group-hover:text-at-primary/85"
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
                        selected ? "text-[#c9a87c]" : "text-at-soft"
                      )}
                    >
                      {p.labelPontos || `Até ${p.limitePontos} pontos`}
                    </span>
                    {planoIncluiIa(p) ? (
                      <span className="mt-1.5 inline-flex items-center gap-0.5 rounded-full bg-cyan-500/15 px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-wider text-cyan-200">
                        <Sparkles className="h-2.5 w-2.5" />
                        IA
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>

          <div
            key={priceKey}
            className="planos-price-in mt-8 space-y-5 border-t border-at pt-6"
          >
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p
                    className="text-[clamp(1.75rem,3vw,2.25rem)] font-bold tracking-tight text-[#f4f7fb]"
                    style={{
                      fontFamily: "var(--font-planos-display), system-ui, sans-serif",
                    }}
                  >
                    {plano.nome}
                  </p>
                  {comIa ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-cyan-400/30 bg-cyan-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-cyan-200">
                      <Sparkles className="h-3 w-3" />
                      Inteligência Artificial
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 max-w-md text-[13px] leading-relaxed text-at-muted">
                  {plano.descricao ||
                    `${pontosLabel} · ${nichosLabel}`}
                </p>
                {comIa ? (
                  <p className="mt-3 max-w-lg rounded-xl border border-cyan-400/20 bg-cyan-500/10 px-3.5 py-3 text-[13px] leading-relaxed text-cyan-100/90">
                    Com a Inteligência Artificial você faz a{" "}
                    <strong className="font-semibold text-white">
                      leitura das máquinas só com fotos
                    </strong>
                    : não precisa digitar os números — a IA identifica o painel e
                    preenche automaticamente na coleta.
                  </p>
                ) : null}
                <div className="mt-4 inline-flex rounded-xl border border-white/10 bg-slate-900/40 p-1 backdrop-blur-md">
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
                          ? "bg-[#c9a87c]/20 text-at-link"
                          : "text-at-muted hover:text-at-primary/85"
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="text-right">
                <p
                  className="text-[clamp(1.5rem,3vw,2rem)] font-bold tracking-tight text-[#7dd3e8]"
                  style={{
                    fontFamily: "var(--font-planos-display), system-ui, sans-serif",
                  }}
                >
                  {precoLabel}
                </p>
                {temDescontoNicho ? (
                  <p className="mt-0.5 text-[12px] text-emerald-400/90">
                    Ajuste pelos nichos · tabela{" "}
                    {formatPreco(precoCheio).replace("/mês", "")}
                  </p>
                ) : null}
                {ciclo === "mensal" && precoAnual != null && (
                  <p className="mt-0.5 text-[12px] text-at-muted">
                    Anual{" "}
                    {precoAnual.toLocaleString("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    })}{" "}
                    ({multAnual}×)
                  </p>
                )}
                {ciclo === "anual" && (
                  <p className="mt-0.5 text-[12px] text-at-muted">
                    Equiv. {formatPreco(precoMensal)}
                  </p>
                )}
              </div>
            </div>

            <ul className="grid gap-2 rounded-2xl border border-white/10 bg-slate-900/50 p-4 backdrop-blur-xl sm:grid-cols-2">
              {beneficios.map((b) => (
                <li
                  key={b}
                  className="flex items-start gap-2.5 text-[13px] leading-snug text-slate-200"
                >
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-cyan-500/15 text-cyan-300">
                    <Check className="h-3 w-3" strokeWidth={2.5} />
                  </span>
                  {b}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="relative z-[1] mt-12 overflow-hidden border-t border-at pt-8">
          <p className="mb-4 text-[12px] leading-relaxed text-at-muted">
            Preço por nicho:{" "}
            <span className="text-slate-300">cassino 100%</span>
            {" · "}
            <span className="text-slate-300">ursinho 90%</span>
            {" · "}
            <span className="text-slate-300">diversão 85%</span>
            {" · "}
            <span className="text-slate-300">consignado 80%</span>
            {" · "}
            <span className="text-emerald-300/90">bolinha 70%</span>
            {" · "}
            <span className="text-emerald-300/90">fura-fura 65%</span>
            . Com mais de um, usa a média.
          </p>
          <NichoCardsCarousel
            values={nichos}
            onChangeMulti={onChangeNichos}
            cards={nichosVisiveis}
            lockedValues={nichosTravados}
            confirmBeforeSelect
            onLockedAttempt={(nicho) => setError(mensagemNichosTravados([nicho]))}
            title="Nichos na rota"
            subtitle={
              plano.slug === "elite"
                ? `${nichosPagos.length} marcados no Elite — toque para marcar (definitivo)`
                : `${nichosPagos.length} de ${plano.maxNichos} no ${plano.nome} — toque para marcar (definitivo)`
            }
          />
          {nichosTravados.length > 0 && (
            <p className="mt-2 text-[12px] text-at-muted">
              Nichos já confirmados ficam travados. Alteração só pelo{" "}
              <Link href="/suporte" className="text-[#c9a87c] underline-offset-2 hover:underline">
                suporte
              </Link>
              .
            </p>
          )}
          {nichosPagos.length >= plano.maxNichos && plano.slug !== "elite" && (
            <p className="mt-3 text-[12px] text-[#c9a87c]/90">
              Limite do {plano.nome}. Para mais nichos, avance a régua.
            </p>
          )}
        </section>
      </div>

      <div className="pointer-events-none fixed inset-x-0 bottom-[4.75rem] z-40 pb-[env(safe-area-inset-bottom)] lg:bottom-4">
        <div className="pointer-events-auto mx-auto max-w-3xl px-4 lg:px-6">
          <div className="planos-sticky-bar flex flex-col gap-2 rounded-2xl border border-white/10 bg-slate-950/90 px-4 py-3 shadow-[0_-8px_40px_rgba(0,0,0,0.45)] backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between sm:gap-4">
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
                  className="text-lg font-semibold text-[#f4f7fb]"
                  style={{
                    fontFamily:
                      "var(--font-planos-display), system-ui, sans-serif",
                  }}
                >
                  {precoLabel}
                </span>
                <span className="text-[12px] text-at-muted">
                  {plano.nome} · {ciclo} · {nichosPagos.length}/
                  {plano.slug === "elite" ? "∞" : plano.maxNichos} nichos
                  {comIa ? " · IA" : ""}
                </span>
              </div>
            </div>
            <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center">
              {assinaturaAtiva && (
                <button
                  type="button"
                  onClick={() => void handleSalvarConfig()}
                  disabled={loading || nichosPagos.length === 0}
                  className="rounded-xl border border-white/10 px-4 py-2.5 text-[12px] font-medium text-at-primary/85 transition hover:bg-white/[0.04] disabled:opacity-50"
                >
                  Só salvar nichos
                </button>
              )}
              <button
                type="button"
                onClick={() => void handleAssinar()}
                disabled={loading || nichosPagos.length === 0}
                className="rounded-xl bg-gradient-to-r from-[#4FACFE] to-[#00F2FE] px-5 py-2.5 text-[13px] font-semibold text-[#0a0e1a] shadow-[0_0_24px_rgba(0,242,254,0.25)] transition hover:brightness-110 disabled:opacity-50"
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

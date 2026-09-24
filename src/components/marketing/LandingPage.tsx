"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Camera,
  Check,
  MapPin,
  Package,
  Wallet,
  X,
} from "lucide-react";
import { Inter, Space_Grotesk } from "next/font/google";
import {
  PLANOS_PADRAO,
  calcPrecoAnual,
  MULTIPLICADOR_ANUAL_PADRAO,
} from "@/lib/pricing";

const display = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-lp-display",
  weight: ["500", "600", "700"],
});

const sans = Inter({
  subsets: ["latin"],
  variable: "--font-lp-sans",
});

const GOLD = "#c4a574";
const WHATSAPP =
  process.env.NEXT_PUBLIC_SUPORTE_WHATSAPP?.replace(/\D/g, "") || "5511999999999";

/** Silicon Valley Dark Tech — shared visual tokens */
const glass =
  "border border-white/10 bg-slate-900/60 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)] backdrop-blur-xl";
const glassCyan =
  "border border-cyan-500/20 bg-slate-900/60 shadow-[inset_0_1px_0_0_rgba(0,242,254,0.08)] backdrop-blur-xl";
const headline =
  "bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text font-bold tracking-tight text-transparent";
const ctaPrimary =
  "lp-cta group inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#4FACFE] to-[#00F2FE] px-6 py-3 text-[13px] font-bold text-[#05070c] transition duration-300 hover:brightness-110";
const ctaPrimaryBlock =
  "lp-cta mt-5 block rounded-full bg-gradient-to-r from-[#4FACFE] to-[#00F2FE] py-2.5 text-center text-[12px] font-bold text-[#05070c] transition duration-300 hover:brightness-110";

function formatBRL(n: number) {
  return n.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  });
}

const NICHOS = [
  "Cassino",
  "Fura-fura",
  "Ursinho",
  "Bolinha",
  "Consignado",
  "Diversão",
] as const;

export function LandingPage() {
  const [ciclo, setCiclo] = useState<"mensal" | "anual">("mensal");

  return (
    <div
      className={`${display.variable} ${sans.variable} lp-v2 relative min-h-dvh overflow-x-hidden bg-[#05070c] text-[#f4efe6]`}
      style={{ fontFamily: "var(--font-lp-sans), system-ui, sans-serif" }}
    >
      {/* atmosfera — neon glows */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div className="lp-v2-waves absolute inset-0 opacity-40" />
        {/* Hero cyan / violet */}
        <div className="absolute left-1/2 top-[-8%] h-[520px] w-[720px] -translate-x-1/2 rounded-full bg-[#00F2FE]/[0.12] blur-[160px]" />
        <div className="absolute -left-24 top-32 h-[420px] w-[420px] rounded-full bg-[#4FACFE]/[0.14] blur-[140px]" />
        <div className="absolute -right-16 top-48 h-[380px] w-[380px] rounded-full bg-[#7F00FF]/[0.15] blur-[150px]" />
        {/* Mid page */}
        <div className="absolute left-[20%] top-[42%] h-[300px] w-[300px] rounded-full bg-[#7F00FF]/[0.1] blur-[120px]" />
        {/* Pricing zone */}
        <div className="absolute bottom-[18%] left-1/2 h-[420px] w-[680px] -translate-x-1/2 rounded-full bg-[#4FACFE]/[0.12] blur-[160px]" />
        <div className="absolute bottom-[12%] right-[10%] h-[320px] w-[320px] rounded-full bg-[#7F00FF]/[0.14] blur-[140px]" />
        <div className="lp-v2-dots absolute right-[8%] top-[18%] hidden h-48 w-36 opacity-30 lg:block" />
      </div>

      {/* NAV pill */}
      <header className="relative z-30 mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-5 sm:px-6">
        <Link
          href="/"
          className="text-[1.35rem] font-bold tracking-tight"
          style={{ fontFamily: "var(--font-lp-display), system-ui, sans-serif", color: GOLD }}
        >
          OperaRout
        </Link>
        <nav
          className={`hidden items-center rounded-full px-1 py-1 md:flex ${glassCyan}`}
        >
          <a
            href="#prints"
            className="rounded-full bg-white/10 px-4 py-1.5 text-[12px] font-semibold text-white shadow-[0_0_20px_rgba(0,242,254,0.15)]"
          >
            App
          </a>
          <a
            href="#nichos"
            className="rounded-full px-4 py-1.5 text-[12px] font-semibold text-slate-300 transition hover:bg-white/10 hover:text-white"
          >
            Nichos
          </a>
          <a
            href="#planos"
            className="rounded-full px-4 py-1.5 text-[12px] font-semibold text-slate-300 transition hover:bg-white/10 hover:text-white"
          >
            Planos
          </a>
          <Link
            href="/login"
            className="rounded-full px-4 py-1.5 text-[12px] font-semibold text-slate-300 transition hover:bg-white/10 hover:text-white"
          >
            Entrar
          </Link>
        </nav>
        <Link
          href="/cadastro"
          className="lp-cta rounded-full border border-cyan-400/40 bg-cyan-500/10 px-4 py-2 text-[12px] font-semibold text-cyan-100 transition duration-300 hover:border-cyan-300/60 hover:bg-cyan-400/20"
        >
          7 dias grátis
        </Link>
      </header>

      {/* HERO — composição em camadas */}
      <section className="relative z-10 mx-auto grid max-w-6xl items-center gap-8 px-4 pb-20 pt-6 sm:px-6 lg:grid-cols-[1fr_1.05fr] lg:gap-4 lg:pb-28 lg:pt-10">
        <div className="lp-fade-up relative z-20 space-y-5">
          <div className="inline-flex items-center rounded-full border border-cyan-400/25 bg-cyan-500/10 px-4 py-1.5 text-[11px] font-semibold tracking-wide text-cyan-100 shadow-[0_0_24px_rgba(0,242,254,0.12)] backdrop-blur-md">
            Controle de máquinas em pontos
          </div>
          <h1
            className={`max-w-[12ch] text-[clamp(3rem,9vw,5.5rem)] leading-[0.92] ${headline}`}
            style={{ fontFamily: "var(--font-lp-display), system-ui, sans-serif" }}
          >
            <span className="bg-gradient-to-r from-[#4FACFE] via-[#00F2FE] to-[#7eb8d4] bg-clip-text text-transparent">
              Leitura
            </span>
            <br />
            <span>que fecha</span>
            <br />
            <span className="bg-gradient-to-r from-white via-slate-200 to-[#c4a574] bg-clip-text text-transparent">
              o dia.
            </span>
          </h1>
          <p className="max-w-md text-[15px] leading-relaxed text-slate-400">
            OperaRoute é o comando da operação: cassino, fura-fura, ursinho e mais. Visita o
            ponto, lê o painel, registra foto, cobra — e o negativo não some no WhatsApp.
          </p>
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <Link href="/cadastro" className={ctaPrimary}>
              Testar grátis agora
              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
            </Link>
            <a
              href="#prints"
              className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] px-5 py-3 text-[13px] font-medium text-slate-300 backdrop-blur-md transition hover:border-cyan-400/30 hover:text-white"
            >
              Ver telas do app
              <span className="text-cyan-300">≫</span>
            </a>
          </div>
        </div>

        <div className="lp-fade-up-delay relative mx-auto h-[520px] w-full max-w-[440px] lg:h-[580px] lg:max-w-none">
          {/* telefone de trás — dashboard */}
          <div className="absolute left-0 top-8 w-[58%] rotate-[-8deg] scale-[0.92] opacity-90 lg:left-2">
            <PhoneBezel>
              <ScreenDashboard />
            </PhoneBezel>
          </div>
          {/* telefone da frente — coleta */}
          <div className="absolute right-0 top-0 z-10 w-[62%] rotate-[6deg] lg:right-4">
            <PhoneBezel glow>
              <ScreenColetaCassino />
            </PhoneBezel>
          </div>
          {/* chip flutuante */}
          <div
            className={`absolute bottom-16 left-[8%] z-20 hidden rounded-2xl px-4 py-3 shadow-2xl sm:block ${glassCyan}`}
          >
            <p className="text-[10px] uppercase tracking-wider text-cyan-300/80">Operação hoje</p>
            <p
              className="text-[1.35rem] font-bold tracking-tight text-white"
              style={{ fontFamily: "var(--font-lp-display), system-ui, sans-serif" }}
            >
              R$ 4.820
            </p>
          </div>
        </div>
      </section>

      {/* marquee nichos */}
      <div
        id="nichos"
        className="relative z-10 border-y border-white/[0.06] bg-slate-950/50 py-4 backdrop-blur-md"
      >
        <div className="lp-marquee flex gap-10 whitespace-nowrap text-[13px] font-medium tracking-wide text-cyan-200/80">
          {[...NICHOS, ...NICHOS, ...NICHOS].map((n, i) => (
            <span key={`${n}-${i}`} className="inline-flex items-center gap-10">
              {n}
              <span className="text-[#7F00FF]/60">◆</span>
            </span>
          ))}
        </div>
      </div>

      {/* PRINTS — galeria das telas */}
      <section id="prints" className="relative z-10 mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-cyan-300/80">
              Prints do app
            </p>
            <h2
              className={`mt-2 max-w-[16ch] text-[clamp(2rem,5vw,3.25rem)] leading-[1.05] ${headline}`}
              style={{ fontFamily: "var(--font-lp-display), system-ui, sans-serif" }}
            >
              As telas que você usa no campo.
            </h2>
          </div>
          <p className="max-w-sm text-[14px] leading-relaxed text-slate-400">
            Não é mock genérico. É o fluxo real: dashboard, leitura de cassino, pontos e
            pendências — do jeito que a equipe opera.
          </p>
        </div>

        <div className="mt-14 grid gap-8 lg:grid-cols-12 lg:gap-6">
          {/* Dashboard — grande */}
          <figure className="lp-print-card relative lg:col-span-7">
            <div
              className={`overflow-hidden rounded-[1.5rem] p-3 shadow-[0_30px_80px_rgba(0,0,0,0.55)] sm:p-4 ${glass}`}
            >
              <div className="overflow-hidden rounded-xl border border-white/[0.06]">
                <ScreenDashboardDesktop />
              </div>
            </div>
            <figcaption className="mt-4 flex items-baseline justify-between gap-3">
              <div>
                <p
                  className="text-[1.25rem] font-semibold tracking-tight text-white"
                  style={{ fontFamily: "var(--font-lp-display), system-ui, sans-serif" }}
                >
                  Dashboard
                </p>
                <p className="text-[13px] text-slate-500">
                  Arrecadação, pendências e pulso da operação
                </p>
              </div>
              <span className="text-[11px] font-medium text-cyan-300/70">01</span>
            </figcaption>
          </figure>

          {/* Coleta phone */}
          <figure className="lp-print-card relative mx-auto w-full max-w-[300px] lg:col-span-5 lg:mx-0 lg:mt-12">
            <PhoneBezel glow className="mx-auto">
              <ScreenColetaCassino />
            </PhoneBezel>
            <figcaption className="mt-4 text-center lg:text-left">
              <p
                className="text-[1.25rem] font-semibold tracking-tight text-white"
                style={{ fontFamily: "var(--font-lp-display), system-ui, sans-serif" }}
              >
                Coleta · Cassino
              </p>
              <p className="text-[13px] text-slate-500">
                Entrada, saída, foto, comissão e a cobrar
              </p>
            </figcaption>
          </figure>

          {/* Pontos */}
          <figure className="lp-print-card relative mx-auto w-full max-w-[280px] lg:col-span-4 lg:mx-0">
            <PhoneBezel>
              <ScreenPontos />
            </PhoneBezel>
            <figcaption className="mt-4">
              <p
                className="text-[1.15rem] font-semibold tracking-tight text-white"
                style={{ fontFamily: "var(--font-lp-display), system-ui, sans-serif" }}
              >
                Pontos
              </p>
              <p className="text-[13px] text-slate-500">Máquinas, status e atalho pra visita</p>
            </figcaption>
          </figure>

          {/* Pendências */}
          <figure className="lp-print-card relative mx-auto w-full max-w-[280px] lg:col-span-4 lg:mx-0 lg:mt-10">
            <PhoneBezel>
              <ScreenPendencias />
            </PhoneBezel>
            <figcaption className="mt-4">
              <p
                className="text-[1.15rem] font-semibold tracking-tight text-white"
                style={{ fontFamily: "var(--font-lp-display), system-ui, sans-serif" }}
              >
                Pendências
              </p>
              <p className="text-[13px] text-slate-500">Negativo e haver no lugar certo</p>
            </figcaption>
          </figure>

          {/* Visita */}
          <figure className="lp-print-card relative mx-auto w-full max-w-[280px] lg:col-span-4 lg:mx-0 lg:mt-4">
            <PhoneBezel>
              <ScreenVisita />
            </PhoneBezel>
            <figcaption className="mt-4">
              <p
                className="text-[1.15rem] font-semibold tracking-tight text-white"
                style={{ fontFamily: "var(--font-lp-display), system-ui, sans-serif" }}
              >
                Visita ao ponto
              </p>
              <p className="text-[13px] text-slate-500">Nichos do dia num só fechamento</p>
            </figcaption>
          </figure>
        </div>
      </section>

      {/* problema */}
      <section className="relative z-10 border-t border-white/[0.06]">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-24">
          <h2
            className={`max-w-[18ch] text-[clamp(1.85rem,4vw,2.75rem)] leading-[1.08] ${headline}`}
            style={{ fontFamily: "var(--font-lp-display), system-ui, sans-serif" }}
          >
            Caderno no bolso ou painel no celular?
          </h2>
          <div className={`mt-12 grid overflow-hidden rounded-3xl lg:grid-cols-2 ${glass}`}>
            <div className="border-b border-white/10 bg-rose-950/20 p-7 backdrop-blur-md sm:p-9 lg:border-b-0 lg:border-r">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-rose-300/70">
                Sem o app
              </p>
              <ul className="mt-5 space-y-3 text-[14px] text-slate-300">
                {[
                  "Foto do visor no grupo — ninguém confere",
                  "Negativo “combinado” some na próxima",
                  "Comissão no dedo, erro no bolso",
                  "Dono só descobre o buraco no fim do mês",
                ].map((t) => (
                  <li key={t} className="flex gap-3">
                    <X className="mt-0.5 h-4 w-4 shrink-0 text-rose-400/80 drop-shadow-[0_0_8px_rgba(251,113,133,0.45)]" />
                    {t}
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-cyan-500/[0.04] p-7 backdrop-blur-md sm:p-9">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-300/90">
                Com OperaRoute
              </p>
              <ul className="mt-5 space-y-3 text-[14px] text-slate-200">
                {[
                  "Leitura + foto no registro da visita",
                  "Negativo e haver ficam no ponto",
                  "Comissão e operação na hora",
                  "Dashboard ao vivo pra quem manda",
                ].map((t) => (
                  <li key={t} className="flex gap-3">
                    <Check className="lp-icon-glow mt-0.5 h-4 w-4 shrink-0 text-cyan-300" />
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* planos */}
      <section id="planos" className="relative z-10 mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-24">
        <div
          className="pointer-events-none absolute left-1/2 top-0 h-[360px] w-[640px] -translate-x-1/2 rounded-full bg-[#00F2FE]/[0.08] blur-[140px]"
          aria-hidden
        />
        <div className="relative text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-cyan-300/80">
            Planos
          </p>
          <h2
            className={`mt-2 text-[clamp(1.85rem,4vw,2.75rem)] ${headline}`}
            style={{ fontFamily: "var(--font-lp-display), system-ui, sans-serif" }}
          >
            Do tamanho da sua operação
          </h2>
          <div className={`mt-7 inline-flex rounded-full p-1 ${glass}`}>
            <button
              type="button"
              onClick={() => setCiclo("mensal")}
              className={`rounded-full px-4 py-2 text-[12px] font-semibold transition ${
                ciclo === "mensal"
                  ? "bg-gradient-to-r from-[#4FACFE] to-[#00F2FE] text-[#05070c] shadow-[0_0_24px_rgba(0,242,254,0.35)]"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Mensal
            </button>
            <button
              type="button"
              onClick={() => setCiclo("anual")}
              className={`rounded-full px-4 py-2 text-[12px] font-semibold transition ${
                ciclo === "anual"
                  ? "bg-gradient-to-r from-[#4FACFE] to-[#00F2FE] text-[#05070c] shadow-[0_0_24px_rgba(0,242,254,0.35)]"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Anual · {MULTIPLICADOR_ANUAL_PADRAO}×
            </button>
          </div>
        </div>
        <div className="relative mt-12 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {PLANOS_PADRAO.map((plano) => {
            const mensal = plano.precoMensal;
            const anual = calcPrecoAnual(plano.id) ?? mensal * MULTIPLICADOR_ANUAL_PADRAO;
            const valor = ciclo === "mensal" ? mensal : anual;
            return (
              <div
                key={plano.id}
                className={`relative flex flex-col rounded-2xl p-5 transition duration-300 ${
                  plano.destaque
                    ? `${glassCyan} shadow-[0_0_50px_rgba(0,242,254,0.12)] ring-1 ring-cyan-400/30`
                    : `${glass} hover:border-white/20`
                }`}
              >
                {plano.destaque && (
                  <span className="absolute -top-2.5 left-4 rounded-full bg-gradient-to-r from-[#4FACFE] to-[#00F2FE] px-2.5 py-0.5 text-[9px] font-bold uppercase text-[#05070c] shadow-[0_0_20px_rgba(0,242,254,0.4)]">
                    Mais usado
                  </span>
                )}
                <p
                  className="text-[13px] font-semibold text-cyan-200"
                  style={{ fontFamily: "var(--font-lp-display), system-ui, sans-serif" }}
                >
                  {plano.nome}
                </p>
                <p className="text-[11px] text-slate-500">{plano.labelPontos}</p>
                <p
                  className="mt-4 text-[1.7rem] font-bold tracking-tight text-white"
                  style={{ fontFamily: "var(--font-lp-display), system-ui, sans-serif" }}
                >
                  {formatBRL(valor)}
                  <span className="text-[12px] font-medium text-slate-500">
                    {ciclo === "mensal" ? "/mês" : "/ano"}
                  </span>
                </p>
                <p className="mt-2 flex-1 text-[12.5px] leading-relaxed text-slate-400">
                  {plano.descricao}
                </p>
                <Link
                  href="/cadastro"
                  className={
                    plano.destaque
                      ? ctaPrimaryBlock
                      : "mt-5 block rounded-full border border-white/10 py-2.5 text-center text-[12px] font-bold text-white transition hover:border-cyan-400/40 hover:bg-white/[0.04]"
                  }
                >
                  Começar grátis
                </Link>
              </div>
            );
          })}
        </div>
      </section>

      <section className="relative z-10 mx-auto max-w-6xl px-4 pb-20 sm:px-6">
        <div
          className={`relative overflow-hidden rounded-[2rem] px-6 py-14 text-center sm:px-12 ${glassCyan}`}
        >
          <div
            className="pointer-events-none absolute -left-10 top-0 h-48 w-48 rounded-full bg-[#00F2FE]/15 blur-[100px]"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute -right-10 bottom-0 h-48 w-48 rounded-full bg-[#7F00FF]/20 blur-[100px]"
            aria-hidden
          />
          <div className="lp-v2-waves absolute inset-0 opacity-20" aria-hidden />
          <h2
            className={`relative text-[clamp(1.7rem,4vw,2.5rem)] ${headline}`}
            style={{ fontFamily: "var(--font-lp-display), system-ui, sans-serif" }}
          >
            Na próxima coleta, o painel já pode estar no app.
          </h2>
          <Link href="/cadastro" className={`relative mt-8 ${ctaPrimary}`}>
            Criar conta — 7 dias grátis
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <footer className="relative z-10 border-t border-white/10">
        <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-12 sm:px-6 md:flex-row md:justify-between">
          <div>
            <p
              className="text-[1.4rem] font-bold tracking-tight"
              style={{ fontFamily: "var(--font-lp-display), system-ui, sans-serif", color: GOLD }}
            >
              OperaRout
            </p>
            <p className="mt-2 max-w-xs text-[13px] text-slate-500">
              Leituras, coletas e financeiro — cassino e nichos no mesmo sinal.
            </p>
          </div>
          <div className="flex flex-wrap gap-x-10 gap-y-5 text-[13px] text-slate-400">
            <Link href="/login" className="transition hover:text-cyan-200">
              Entrar
            </Link>
            <Link href="/cadastro" className="transition hover:text-cyan-200">
              Criar conta
            </Link>
            <Link href="/suporte-contato" className="transition hover:text-cyan-200">
              Contato
            </Link>
            <a
              href={`https://wa.me/${WHATSAPP}`}
              target="_blank"
              rel="noopener noreferrer"
              className="transition hover:text-cyan-200"
            >
              WhatsApp
            </a>
            <Link href="/termos" className="transition hover:text-cyan-200">
              Termos
            </Link>
            <Link href="/privacidade" className="transition hover:text-cyan-200">
              Privacidade
            </Link>
          </div>
        </div>
        <div className="border-t border-white/[0.04] py-4 text-center text-[11px] text-slate-600">
          © {new Date().getFullYear()} OperaRoute
        </div>
      </footer>
    </div>
  );
}

function PhoneBezel({
  children,
  glow,
  className = "",
}: {
  children: React.ReactNode;
  glow?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`relative aspect-[9/18.2] w-full overflow-hidden rounded-[1.85rem] border border-white/15 bg-[#05070c] ${
        glow ? "lp-phone-glow" : "shadow-[0_25px_60px_rgba(0,0,0,0.55)]"
      } ${className}`}
    >
      <div className="absolute left-1/2 top-2 z-10 h-4 w-[4.5rem] -translate-x-1/2 rounded-full bg-black/80" />
      <div className="h-full overflow-hidden pt-7">{children}</div>
    </div>
  );
}

function ScreenDashboard() {
  return (
    <div className="flex h-full flex-col bg-[#070a10] px-3 pb-3 text-[10px]">
      <p className="text-[9px] uppercase tracking-[0.2em] text-[#c4a574]/70">Operação</p>
      <p
        className="text-[15px] font-semibold tracking-tight text-[#f4efe6]"
        style={{ fontFamily: "var(--font-lp-display), system-ui, sans-serif" }}
      >
        Bom dia, Adilson
      </p>
      <div className="mt-3 grid grid-cols-2 gap-1.5">
        {[
          { l: "Arrecadado", v: "R$ 4.820", c: "text-emerald-400/90" },
          { l: "Pendências", v: "7 abertas", c: "text-amber-300/90" },
          { l: "Pontos", v: "28 ativos", c: "text-[#f4efe6]" },
          { l: "Negativos", v: "R$ 640", c: "text-rose-400/90" },
        ].map((k) => (
          <div key={k.l} className="rounded-lg border border-white/[0.06] bg-white/[0.03] p-2">
            <p className="text-[8px] text-[#6b7382]">{k.l}</p>
            <p className={`mt-0.5 text-[11px] font-semibold ${k.c}`}>{k.v}</p>
          </div>
        ))}
      </div>
      <div className="mt-3 flex-1 rounded-lg border border-white/[0.06] bg-white/[0.02] p-2">
        <p className="mb-2 text-[8px] text-[#6b7382]">Últimos 7 dias</p>
        <div className="flex h-16 items-end gap-1">
          {[40, 65, 45, 80, 55, 90, 70].map((h, i) => (
            <div
              key={i}
              className="flex-1 rounded-sm bg-gradient-to-t from-[#4FACFE]/80 to-[#00F2FE]/50"
              style={{ height: `${h}%` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function ScreenDashboardDesktop() {
  return (
    <div className="bg-[#070a10] p-4 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.22em] text-cyan-300/70">Dashboard</p>
          <p
            className="text-[1.65rem] font-bold tracking-tight text-[#f4efe6] sm:text-[2rem]"
            style={{ fontFamily: "var(--font-lp-display), system-ui, sans-serif" }}
          >
            Pulso da operação
          </p>
        </div>
        <div className="flex gap-2 text-[10px]">
          <span className="rounded-full border border-cyan-400/30 px-2.5 py-1 text-cyan-200">
            Cassino
          </span>
          <span className="rounded-full border border-white/10 px-2.5 py-1 text-slate-400">
            Fura-fura
          </span>
        </div>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { l: "Arrecadado", v: "R$ 18.420", sub: "+12% vs sem." },
          { l: "Operação", v: "R$ 11.280", sub: "após comissão" },
          { l: "Pendências", v: "R$ 2.140", sub: "9 abertas" },
          { l: "Negativos", v: "R$ 890", sub: "3 pontos" },
        ].map((k) => (
          <div
            key={k.l}
            className="rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-3"
          >
            <p className="text-[10px] text-[#6b7382]">{k.l}</p>
            <p
              className="mt-1 text-[1.15rem] font-semibold tracking-tight text-white sm:text-[1.25rem]"
              style={{ fontFamily: "var(--font-lp-display), system-ui, sans-serif" }}
            >
              {k.v}
            </p>
            <p className="mt-0.5 text-[10px] text-cyan-300/70">{k.sub}</p>
          </div>
        ))}
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-[1.4fr_1fr]">
        <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
          <p className="text-[10px] text-[#6b7382]">Coletas · 7 dias</p>
          <div className="mt-3 flex h-24 items-end gap-1.5">
            {[35, 55, 42, 78, 60, 92, 70].map((h, i) => (
              <div key={i} className="flex flex-1 flex-col items-center gap-1">
                <div
                  className="w-full rounded-sm bg-gradient-to-t from-[#4FACFE] to-[#00F2FE]/70"
                  style={{ height: `${h}%` }}
                />
                <span className="text-[8px] text-[#5c6573]">
                  {["S", "T", "Q", "Q", "S", "S", "D"][i]}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="space-y-2 rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
          <p className="text-[10px] text-[#6b7382]">Top pontos</p>
          {[
            ["Bar do Pedro", "R$ 2.180"],
            ["Posto Lima", "R$ 1.640"],
            ["Mercado Sul", "R$ 1.210"],
          ].map(([n, v]) => (
            <div key={n} className="flex justify-between text-[11px]">
              <span className="text-[#c9d0db]">{n}</span>
              <span className="font-semibold text-cyan-300">{v}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ScreenColetaCassino() {
  return (
    <div className="flex h-full flex-col bg-[#070a10] px-3 pb-3">
      <p className="text-[8px] uppercase tracking-[0.2em] text-cyan-300/70">Coleta cassino</p>
      <p
        className="text-[14px] font-semibold tracking-tight text-white"
        style={{ fontFamily: "var(--font-lp-display), system-ui, sans-serif" }}
      >
        Bar do Pedro
      </p>
      <div className="mt-2.5 space-y-1.5">
        {[
          { n: "Painel 00033", e: "1.284.500", s: "1.198.200" },
          { n: "Painel 00041", e: "892.100", s: "851.040" },
        ].map((m) => (
          <div key={m.n} className="rounded-lg border border-white/[0.07] bg-white/[0.03] p-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-medium text-[#f4efe6]">{m.n}</span>
              <Camera className="lp-icon-glow h-3 w-3 text-cyan-300" />
            </div>
            <div className="mt-1.5 grid grid-cols-2 gap-1 text-[9px]">
              <div>
                <p className="text-[#5c6573]">Entrada</p>
                <p className="font-semibold tabular-nums text-emerald-400/90">{m.e}</p>
              </div>
              <div>
                <p className="text-[#5c6573]">Saída</p>
                <p className="font-semibold tabular-nums text-rose-400/90">{m.s}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-auto space-y-1.5 pt-2">
        <div className="rounded-lg border border-cyan-400/25 bg-cyan-500/10 px-2.5 py-2">
          <div className="flex justify-between text-[8px] text-cyan-300/80">
            <span>Lucro</span>
            <span>Comissão 30%</span>
          </div>
          <p
            className="text-[1.2rem] font-bold tabular-nums tracking-tight text-white"
            style={{ fontFamily: "var(--font-lp-display), system-ui, sans-serif" }}
          >
            R$ 1.273,60
          </p>
        </div>
        <div className="rounded-md bg-gradient-to-r from-[#4FACFE] to-[#00F2FE] py-1.5 text-center text-[10px] font-bold text-[#05070c]">
          Registrar coleta
        </div>
      </div>
    </div>
  );
}

function ScreenPontos() {
  return (
    <div className="flex h-full flex-col bg-[#070a10] px-3 pb-3">
      <p className="text-[8px] uppercase tracking-[0.2em] text-cyan-300/70">Pontos</p>
      <p
        className="text-[14px] font-semibold tracking-tight text-white"
        style={{ fontFamily: "var(--font-lp-display), system-ui, sans-serif" }}
      >
        28 ativos
      </p>
      <div className="mt-3 space-y-1.5">
        {[
          { n: "Bar do Pedro", m: "4 máq.", st: "OK" },
          { n: "Posto Lima", m: "2 máq.", st: "Pend." },
          { n: "Mercado Sul", m: "3 máq.", st: "OK" },
          { n: "Lan House RX", m: "6 máq.", st: "Neg." },
        ].map((p) => (
          <div
            key={p.n}
            className="flex items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.03] px-2 py-2"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-cyan-500/15">
              <MapPin className="lp-icon-glow h-3 w-3 text-cyan-300" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[10px] font-medium text-[#f4efe6]">{p.n}</p>
              <p className="text-[8px] text-[#6b7382]">{p.m}</p>
            </div>
            <span
              className={`text-[8px] font-semibold ${
                p.st === "OK"
                  ? "text-emerald-400/90"
                  : p.st === "Neg."
                    ? "text-rose-400/90"
                    : "text-amber-300/90"
              }`}
            >
              {p.st}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ScreenPendencias() {
  return (
    <div className="flex h-full flex-col bg-[#070a10] px-3 pb-3">
      <p className="text-[8px] uppercase tracking-[0.2em] text-cyan-300/70">Pendências</p>
      <p
        className="text-[14px] font-semibold tracking-tight text-white"
        style={{ fontFamily: "var(--font-lp-display), system-ui, sans-serif" }}
      >
        Em aberto
      </p>
      <div className="mt-3 space-y-1.5">
        {[
          { t: "Negativo", p: "Lan House RX", v: "R$ 320", ic: AlertTriangle, c: "text-rose-400" },
          { t: "Haver", p: "Bar do Pedro", v: "R$ 85", ic: Wallet, c: "text-cyan-300" },
          { t: "Parcial", p: "Posto Lima", v: "R$ 410", ic: Activity, c: "text-amber-300" },
          { t: "Negativo", p: "Mercado Sul", v: "R$ 150", ic: AlertTriangle, c: "text-rose-400" },
        ].map((x) => (
          <div
            key={x.p + x.t}
            className="flex items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.03] px-2 py-2"
          >
            <x.ic className={`lp-icon-glow h-3.5 w-3.5 shrink-0 ${x.c}`} />
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-medium text-[#f4efe6]">{x.t}</p>
              <p className="truncate text-[8px] text-[#6b7382]">{x.p}</p>
            </div>
            <span className="text-[10px] font-semibold text-white">{x.v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ScreenVisita() {
  return (
    <div className="flex h-full flex-col bg-[#070a10] px-3 pb-3">
      <p className="text-[8px] uppercase tracking-[0.2em] text-cyan-300/70">Visita ao ponto</p>
      <p
        className="text-[14px] font-semibold tracking-tight text-white"
        style={{ fontFamily: "var(--font-lp-display), system-ui, sans-serif" }}
      >
        Posto Lima
      </p>
      <div className="mt-3 space-y-1.5">
        {[
          { n: "Cassino", s: "2 leituras", ic: Activity },
          { n: "Fura-fura", s: "1 coleta", ic: Package },
          { n: "Cobrar", s: "R$ 680,00", ic: Wallet },
        ].map((x) => (
          <div
            key={x.n}
            className="flex items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.03] px-2.5 py-2.5"
          >
            <x.ic className="lp-icon-glow h-3.5 w-3.5 text-cyan-300" />
            <div className="flex-1">
              <p className="text-[10px] font-medium text-white">{x.n}</p>
              <p className="text-[8px] text-[#6b7382]">{x.s}</p>
            </div>
            <span className="text-[9px] text-cyan-300">Abrir</span>
          </div>
        ))}
      </div>
      <div className="mt-auto rounded-md bg-gradient-to-r from-[#4FACFE] to-[#00F2FE] py-2 text-center text-[10px] font-bold text-[#05070c]">
        Finalizar visita
      </div>
    </div>
  );
}

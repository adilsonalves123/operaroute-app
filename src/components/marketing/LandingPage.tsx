"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Camera,
  Check,
  Gauge,
  Layers,
  MapPin,
  ScanLine,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { Space_Grotesk, IBM_Plex_Sans } from "next/font/google";
import {
  PLANOS_PADRAO,
  calcPrecoAnual,
  MULTIPLICADOR_ANUAL_PADRAO,
} from "@/lib/pricing";

const display = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-lp-display",
  display: "swap",
});

const sans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-lp-sans",
  display: "swap",
});

const WHATSAPP =
  process.env.NEXT_PUBLIC_SUPORTE_WHATSAPP?.replace(/\D/g, "") || "5511999999999";

function formatBRL(n: number) {
  return n.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  });
}

const NICHOS_SHOW = [
  { name: "Cassino", hint: "Entrada · saída · comissão" },
  { name: "Fura-fura", hint: "Furos · brindes · kits" },
  { name: "Ursinho", hint: "Visor · estoque de prêmios" },
  { name: "Bolinha", hint: "Cápsulas · jogada" },
  { name: "Consignado", hint: "Expositor · recolha" },
  { name: "Diversão", hint: "Entrada · lucro real" },
] as const;

const PILARES = [
  {
    icon: ScanLine,
    title: "Leitura que fecha a máquina",
    text: "Entrada e saída do painel, foto do visor, comissão e o que sobra pra você — tudo na visita.",
  },
  {
    icon: Wallet,
    title: "Negativo, haver e cobrança",
    text: "O que o ponto deve e o que você deve ao ponto não some na conversa. Fica no histórico.",
  },
  {
    icon: Layers,
    title: "Vários nichos, um painel",
    text: "Cassino, fura-fura, ursinho, bolinha, consignado… a operação inteira no mesmo lugar.",
  },
  {
    icon: Users,
    title: "Dono e equipe no campo",
    text: "Operador coleta no celular. Você acompanha arrecadação, pendências e pontos em tempo real.",
  },
] as const;

export function LandingPage() {
  const [ciclo, setCiclo] = useState<"mensal" | "anual">("mensal");

  return (
    <div
      className={`${display.variable} ${sans.variable} lp-root relative min-h-dvh overflow-x-hidden bg-[#060910] text-[#f4f7fb]`}
      style={{ fontFamily: "var(--font-lp-sans), system-ui, sans-serif" }}
    >
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="lp-grid absolute inset-0 opacity-40" />
        <div className="lp-radar absolute left-1/2 top-[8%] h-[70vw] max-h-[640px] w-[70vw] max-w-[640px] -translate-x-1/2">
          <span className="lp-radar-ring" />
          <span className="lp-radar-ring lp-radar-ring-2" />
          <span className="lp-radar-sweep" />
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-64 bg-gradient-to-t from-[#060910] to-transparent" />
      </div>

      <header className="relative z-20 mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-5 sm:px-8">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="lp-live-dot" aria-hidden />
          <span
            className="text-[1.4rem] font-medium tracking-tight"
            style={{ fontFamily: "var(--font-lp-display), system-ui, sans-serif" }}
          >
            Opera<span className="text-[#7dd3e8]">Rout</span>
          </span>
        </Link>
        <nav className="hidden items-center gap-7 text-[13px] text-[#8b93a3] md:flex">
          <a href="#nichos" className="transition hover:text-white">
            Nichos
          </a>
          <a href="#leitura" className="transition hover:text-white">
            Leitura
          </a>
          <a href="#planos" className="transition hover:text-white">
            Planos
          </a>
          <Link href="/login" className="transition hover:text-white">
            Entrar
          </Link>
        </nav>
        <Link
          href="/cadastro"
          className="rounded-sm bg-[#7dd3e8] px-3.5 py-2 text-[12px] font-semibold text-[#060910] transition hover:bg-[#9ae0ef]"
        >
          7 dias grátis
        </Link>
      </header>

      {/* HERO — marca + uma promessa + mockup de leitura */}
      <section className="relative z-10 mx-auto flex min-h-[calc(100dvh-4.5rem)] w-full max-w-6xl flex-col justify-center px-5 pb-16 pt-4 sm:px-8 lg:grid lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:gap-10 lg:pb-20">
        <div className="lp-fade-up space-y-5 lg:space-y-6">
          <p className="text-[10px] font-medium uppercase tracking-[0.3em] text-[#7dd3e8]/75">
            Controle de operação · máquinas em pontos
          </p>
          <h1
            className="max-w-[11ch] text-[clamp(2.85rem,8.5vw,5.2rem)] font-medium leading-[0.88] tracking-[-0.045em]"
            style={{ fontFamily: "var(--font-lp-display), system-ui, sans-serif" }}
          >
            Opera
            <span className="text-[#7dd3e8]">Rout</span>
          </h1>
          <p
            className="max-w-[22ch] text-[clamp(1.25rem,3vw,1.65rem)] font-medium leading-snug tracking-tight text-[#e8ecf2]"
            style={{ fontFamily: "var(--font-lp-display), system-ui, sans-serif" }}
          >
            Cada leitura no painel. Cada centavo no lugar.
          </p>
          <p className="max-w-md text-[14.5px] leading-relaxed text-[#8b93a3] sm:text-[15px]">
            App pra quem opera cassino, fura-fura, ursinho e outros nichos: visita o ponto, lê a
            máquina, fecha a coleta e sabe o que sobrou — sem caderno, sem “acha que”.
          </p>
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <Link
              href="/cadastro"
              className="group inline-flex items-center gap-2 rounded-sm bg-[#7dd3e8] px-5 py-3 text-[13px] font-semibold text-[#060910] transition hover:bg-[#9ae0ef]"
            >
              Testar grátis agora
              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
            </Link>
            <a
              href="#leitura"
              className="inline-flex items-center rounded-sm border border-white/12 px-5 py-3 text-[13px] font-medium text-[#c9d0db] transition hover:border-[#7dd3e8]/35 hover:text-white"
            >
              Ver como funciona
            </a>
          </div>
          <p className="text-[11px] uppercase tracking-[0.14em] text-[#c9a87c]/90">
            7 dias grátis · sem cartão
          </p>
        </div>

        <div className="lp-fade-up-delay relative mx-auto mt-12 w-full max-w-[360px] lg:mt-0 lg:max-w-none">
          <LeituraMockup />
        </div>
      </section>

      {/* NICHOS */}
      <section id="nichos" className="relative z-10 border-y border-white/[0.06] bg-[#080d16]/90">
        <div className="mx-auto max-w-6xl px-5 py-14 sm:px-8 sm:py-16">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[10px] font-medium uppercase tracking-[0.28em] text-[#c9a87c]/85">
                Feito pro seu tipo de máquina
              </p>
              <h2
                className="mt-2 text-[clamp(1.5rem,3.5vw,2.1rem)] font-medium tracking-tight"
                style={{ fontFamily: "var(--font-lp-display), system-ui, sans-serif" }}
              >
                Nichos que o app já entende
              </h2>
            </div>
            <p className="max-w-sm text-[13px] leading-relaxed text-[#7a8494]">
              Não é planilha genérica. Cada módulo sabe o que perguntar na coleta.
            </p>
          </div>
          <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {NICHOS_SHOW.map((n) => (
              <div
                key={n.name}
                className="border border-white/[0.08] bg-white/[0.02] px-3 py-4 transition hover:border-[#7dd3e8]/30 hover:bg-[#7dd3e8]/[0.04]"
              >
                <p
                  className="text-[14px] font-medium text-[#f4f7fb]"
                  style={{ fontFamily: "var(--font-lp-display), system-ui, sans-serif" }}
                >
                  {n.name}
                </p>
                <p className="mt-1 text-[11px] leading-snug text-[#6b7382]">{n.hint}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PROBLEMA × SOLUÇÃO */}
      <section className="relative z-10 mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-24">
        <div className="max-w-2xl">
          <p className="text-[10px] font-medium uppercase tracking-[0.28em] text-[#7dd3e8]/75">
            A diferença no fechamento
          </p>
          <h2
            className="mt-3 text-[clamp(1.65rem,4vw,2.35rem)] font-medium tracking-tight"
            style={{ fontFamily: "var(--font-lp-display), system-ui, sans-serif" }}
          >
            Anotar no Zap ou fechar a máquina de verdade?
          </h2>
        </div>

        <div className="mt-12 grid gap-0 overflow-hidden border border-white/[0.08] lg:grid-cols-2">
          <div className="border-b border-white/[0.08] bg-rose-500/[0.03] p-6 sm:p-8 lg:border-b-0 lg:border-r">
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-rose-300/75">
              No improviso
            </p>
            <ul className="mt-5 space-y-3.5 text-[14px] text-[#a8b0bd]">
              {[
                "Foto do painel no grupo — ninguém sabe se bateu",
                "Negativo “combinado” que some na próxima visita",
                "Comissão calculada no dedo, erro que dói no bolso",
                "Equipe no campo, dono sem enxergar o dia",
              ].map((t) => (
                <li key={t} className="flex gap-3">
                  <X className="mt-0.5 h-4 w-4 shrink-0 text-rose-400/80" />
                  {t}
                </li>
              ))}
            </ul>
          </div>
          <div className="bg-[#7dd3e8]/[0.04] p-6 sm:p-8">
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#7dd3e8]/85">
              No OperaRoute
            </p>
            <ul className="mt-5 space-y-3.5 text-[14px] text-[#c9d0db]">
              {[
                "Leitura com entrada, saída e foto no registro da visita",
                "Negativo e haver ficam no ponto até quitar",
                "Comissão e operação calculadas na hora",
                "Painel ao vivo: o que entrou, o que falta cobrar",
              ].map((t) => (
                <li key={t} className="flex gap-3">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#7dd3e8]" />
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* LEITURA / FLUXO */}
      <section
        id="leitura"
        className="relative z-10 border-t border-white/[0.06] bg-[#080d16]/70"
      >
        <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-24">
          <div className="max-w-xl">
            <p className="text-[10px] font-medium uppercase tracking-[0.28em] text-[#c9a87c]/85">
              Fluxo da visita
            </p>
            <h2
              className="mt-3 text-[clamp(1.65rem,4vw,2.35rem)] font-medium tracking-tight"
              style={{ fontFamily: "var(--font-lp-display), system-ui, sans-serif" }}
            >
              Do ponto à apuração — em minutos
            </h2>
            <p className="mt-3 text-[14.5px] leading-relaxed text-[#8b93a3]">
              O operador chega, lê, cobra e segue. Você vê o resultado sem ligar perguntando
              “quanto deu?”.
            </p>
          </div>

          <ol className="mt-14 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                n: "01",
                icon: MapPin,
                t: "Abrir o ponto",
                d: "Máquinas do local, pendências e o que ficou da última visita.",
              },
              {
                n: "02",
                icon: Gauge,
                t: "Ler o painel",
                d: "Entrada e saída (cassino) ou furos/visor — do jeito do nicho.",
              },
              {
                n: "03",
                icon: Camera,
                t: "Provar com foto",
                d: "Visor na coleta. Histórico limpo se alguém questionar.",
              },
              {
                n: "04",
                icon: Wallet,
                t: "Fechar e cobrar",
                d: "Lucro, comissão, pix/dinheiro, negativo ou haver — registrado.",
              },
            ].map((s) => (
              <li key={s.n} className="relative border-t border-[#7dd3e8]/25 pt-5">
                <span className="text-[11px] font-medium tracking-[0.2em] text-[#7dd3e8]/70">
                  {s.n}
                </span>
                <s.icon className="mt-3 h-5 w-5 text-[#c9a87c]" />
                <h3
                  className="mt-3 text-[1.05rem] font-medium text-white"
                  style={{ fontFamily: "var(--font-lp-display), system-ui, sans-serif" }}
                >
                  {s.t}
                </h3>
                <p className="mt-2 text-[13px] leading-relaxed text-[#7a8494]">{s.d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* PILARES */}
      <section className="relative z-10 mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-24">
        <h2
          className="max-w-lg text-[clamp(1.65rem,4vw,2.35rem)] font-medium tracking-tight"
          style={{ fontFamily: "var(--font-lp-display), system-ui, sans-serif" }}
        >
          O que segura a operação no dia a dia
        </h2>
        <div className="mt-12 grid gap-10 sm:grid-cols-2">
          {PILARES.map((p) => (
            <article key={p.title} className="flex gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center border border-[#7dd3e8]/25 bg-[#7dd3e8]/[0.06] text-[#7dd3e8]">
                <p.icon className="h-5 w-5" />
              </div>
              <div>
                <h3
                  className="text-[1.1rem] font-medium text-white"
                  style={{ fontFamily: "var(--font-lp-display), system-ui, sans-serif" }}
                >
                  {p.title}
                </h3>
                <p className="mt-2 text-[14px] leading-relaxed text-[#8b93a3]">{p.text}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* PLANOS */}
      <section
        id="planos"
        className="relative z-10 border-t border-white/[0.06] bg-gradient-to-b from-[#080d16] to-[#060910]"
      >
        <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-24">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-[10px] font-medium uppercase tracking-[0.28em] text-[#c9a87c]/85">
              Por tamanho da operação
            </p>
            <h2
              className="mt-3 text-[clamp(1.65rem,4vw,2.35rem)] font-medium tracking-tight"
              style={{ fontFamily: "var(--font-lp-display), system-ui, sans-serif" }}
            >
              Planos que cabem nos seus pontos
            </h2>
            <p className="mt-3 text-[14px] text-[#8b93a3]">
              Quanto mais pontos e nichos, maior o plano. Teste 7 dias grátis.
            </p>
            <div className="mt-8 inline-flex border border-white/10 bg-black/40 p-1">
              <button
                type="button"
                onClick={() => setCiclo("mensal")}
                className={`px-4 py-2 text-[12px] font-semibold transition ${
                  ciclo === "mensal"
                    ? "bg-[#7dd3e8] text-[#060910]"
                    : "text-[#8b93a3] hover:text-white"
                }`}
              >
                Mensal
              </button>
              <button
                type="button"
                onClick={() => setCiclo("anual")}
                className={`px-4 py-2 text-[12px] font-semibold transition ${
                  ciclo === "anual"
                    ? "bg-[#7dd3e8] text-[#060910]"
                    : "text-[#8b93a3] hover:text-white"
                }`}
              >
                Anual · {MULTIPLICADOR_ANUAL_PADRAO}×
              </button>
            </div>
          </div>

          <div className="mt-12 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {PLANOS_PADRAO.map((plano) => {
              const mensal = plano.precoMensal;
              const anual = calcPrecoAnual(plano.id) ?? mensal * MULTIPLICADOR_ANUAL_PADRAO;
              const valor = ciclo === "mensal" ? mensal : anual;
              const porMes =
                ciclo === "anual" ? Math.round((anual / 12) * 100) / 100 : mensal;

              return (
                <div
                  key={plano.id}
                  className={`relative flex flex-col border p-5 ${
                    plano.destaque
                      ? "border-[#7dd3e8]/50 bg-[#7dd3e8]/[0.06]"
                      : "border-white/[0.08] bg-white/[0.015]"
                  }`}
                >
                  {plano.destaque && (
                    <span className="absolute -top-2.5 left-4 bg-[#7dd3e8] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#060910]">
                      Mais usado
                    </span>
                  )}
                  <p className="text-[13px] font-semibold text-[#7dd3e8]">{plano.nome}</p>
                  <p className="mt-0.5 text-[11px] text-[#6b7382]">{plano.labelPontos}</p>
                  <p
                    className="mt-4 text-[1.75rem] font-medium tracking-tight"
                    style={{ fontFamily: "var(--font-lp-display), system-ui, sans-serif" }}
                  >
                    {formatBRL(valor)}
                    <span className="text-[12px] font-normal text-[#6b7382]">
                      {ciclo === "mensal" ? "/mês" : "/ano"}
                    </span>
                  </p>
                  {ciclo === "anual" && (
                    <p className="text-[11px] text-[#5c6573]">≈ {formatBRL(porMes)}/mês</p>
                  )}
                  <p className="mt-3 flex-1 text-[12.5px] leading-relaxed text-[#8b93a3]">
                    {plano.descricao}
                  </p>
                  <p className="mt-3 text-[11px] text-[#7a8494]">
                    Até {plano.maxNichos} nicho{plano.maxNichos > 1 ? "s" : ""}
                  </p>
                  <Link
                    href="/cadastro"
                    className={`mt-5 block py-2.5 text-center text-[12px] font-semibold transition ${
                      plano.destaque
                        ? "bg-[#7dd3e8] text-[#060910] hover:bg-[#9ae0ef]"
                        : "border border-white/12 text-white hover:border-[#7dd3e8]/40"
                    }`}
                  >
                    Começar grátis
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="relative z-10 mx-auto max-w-6xl px-5 pb-20 sm:px-8">
        <div className="relative overflow-hidden border border-[#7dd3e8]/20 bg-[#0a101c] px-6 py-14 text-center sm:px-12">
          <div className="pointer-events-none absolute inset-0 lp-grid opacity-20" aria-hidden />
          <h2
            className="relative text-[clamp(1.55rem,3.5vw,2.15rem)] font-medium tracking-tight"
            style={{ fontFamily: "var(--font-lp-display), system-ui, sans-serif" }}
          >
            Na próxima coleta, o painel já pode estar no app.
          </h2>
          <p className="relative mx-auto mt-3 max-w-md text-[14px] text-[#8b93a3]">
            Cadastre a operação, escolha os nichos e leve a equipe pro campo com o mesmo sinal.
          </p>
          <Link
            href="/cadastro"
            className="relative mt-8 inline-flex items-center gap-2 bg-[#7dd3e8] px-6 py-3 text-[13px] font-semibold text-[#060910] transition hover:bg-[#9ae0ef]"
          >
            Criar conta — 7 dias grátis
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <footer className="relative z-10 border-t border-white/[0.06]">
        <div className="mx-auto flex max-w-6xl flex-col gap-8 px-5 py-12 sm:px-8 md:flex-row md:justify-between">
          <div>
            <p
              className="text-[1.25rem] font-medium"
              style={{ fontFamily: "var(--font-lp-display), system-ui, sans-serif" }}
            >
              Opera<span className="text-[#7dd3e8]">Rout</span>
            </p>
            <p className="mt-2 max-w-xs text-[13px] leading-relaxed text-[#5c6573]">
              Comando da operação: leituras, coletas, pontos e financeiro — cassino e outros
              nichos no mesmo app.
            </p>
          </div>
          <div className="flex flex-wrap gap-x-10 gap-y-6 text-[13px]">
            <div className="space-y-2">
              <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#4a5260]">
                Conta
              </p>
              <Link href="/login" className="block text-[#8b93a3] hover:text-white">
                Entrar
              </Link>
              <Link href="/cadastro" className="block text-[#8b93a3] hover:text-white">
                Criar conta
              </Link>
              <a href="#planos" className="block text-[#8b93a3] hover:text-white">
                Planos
              </a>
            </div>
            <div className="space-y-2">
              <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#4a5260]">
                Suporte
              </p>
              <Link href="/suporte-contato" className="block text-[#8b93a3] hover:text-white">
                Contato
              </Link>
              <a
                href={`https://wa.me/${WHATSAPP}`}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-[#8b93a3] hover:text-white"
              >
                WhatsApp
              </a>
              <Link href="/downloads" className="block text-[#8b93a3] hover:text-white">
                Baixar app
              </Link>
            </div>
            <div className="space-y-2">
              <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#4a5260]">
                Legal
              </p>
              <Link href="/termos" className="block text-[#8b93a3] hover:text-white">
                Termos
              </Link>
              <Link href="/privacidade" className="block text-[#8b93a3] hover:text-white">
                Privacidade
              </Link>
            </div>
          </div>
        </div>
        <div className="border-t border-white/[0.04] py-5 text-center text-[11px] text-[#4a5260]">
          © {new Date().getFullYear()} OperaRoute · canal seguro
        </div>
      </footer>
    </div>
  );
}

/** Mock fiel à coleta cassino: entrada / saída / operação */
function LeituraMockup() {
  return (
    <div className="lp-phone-screen relative mx-auto aspect-[9/17.5] w-full max-w-[300px] overflow-hidden rounded-[1.85rem] border border-white/12 bg-[#0a0f18] lg:max-w-[320px]">
      <div className="absolute left-1/2 top-2 z-10 h-4 w-20 -translate-x-1/2 rounded-full bg-black/70" />
      <div className="flex h-full flex-col px-3.5 pb-4 pt-9">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-[9px] uppercase tracking-[0.22em] text-[#7dd3e8]/65">
              Coleta cassino
            </p>
            <p
              className="mt-0.5 text-[15px] font-medium text-white"
              style={{ fontFamily: "var(--font-lp-display), system-ui, sans-serif" }}
            >
              Bar do Pedro
            </p>
          </div>
          <span className="rounded-sm bg-[#c9a87c]/15 px-1.5 py-0.5 text-[9px] font-medium text-[#c9a87c]">
            2 máquinas
          </span>
        </div>

        <div className="mt-4 space-y-2">
          <div className="border border-white/[0.07] bg-white/[0.03] px-2.5 py-2.5">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-medium text-[#f4f7fb]">Painel 00033</p>
              <ScanLine className="h-3 w-3 text-[#7dd3e8]" />
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-[10px]">
              <div>
                <p className="text-[#5c6573]">Entrada</p>
                <p className="font-semibold tabular-nums text-emerald-400/90">1.284.500</p>
              </div>
              <div>
                <p className="text-[#5c6573]">Saída</p>
                <p className="font-semibold tabular-nums text-rose-400/90">1.198.200</p>
              </div>
            </div>
          </div>
          <div className="border border-white/[0.07] bg-white/[0.03] px-2.5 py-2.5">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-medium text-[#f4f7fb]">Painel 00041</p>
              <Camera className="h-3 w-3 text-[#c9a87c]" />
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-[10px]">
              <div>
                <p className="text-[#5c6573]">Entrada</p>
                <p className="font-semibold tabular-nums text-emerald-400/90">892.100</p>
              </div>
              <div>
                <p className="text-[#5c6573]">Saída</p>
                <p className="font-semibold tabular-nums text-rose-400/90">851.040</p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-auto space-y-2 pt-4">
          <div className="border border-[#7dd3e8]/25 bg-[#7dd3e8]/[0.07] px-3 py-2.5">
            <div className="flex justify-between text-[10px] text-[#7dd3e8]/80">
              <span>Lucro período</span>
              <span>Comissão 30%</span>
            </div>
            <div className="mt-1 flex items-end justify-between">
              <p
                className="text-[1.35rem] font-medium tabular-nums text-white"
                style={{ fontFamily: "var(--font-lp-display), system-ui, sans-serif" }}
              >
                R$ 1.273,60
              </p>
              <p className="pb-0.5 text-[11px] text-[#8b93a3]">op. R$ 891,52</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="border border-white/[0.06] bg-black/25 px-2 py-1.5">
              <p className="text-[8px] uppercase tracking-wide text-[#5c6573]">Negativo</p>
              <p className="text-[12px] font-semibold text-amber-200/90">R$ 120,00</p>
            </div>
            <div className="border border-white/[0.06] bg-black/25 px-2 py-1.5">
              <p className="text-[8px] uppercase tracking-wide text-[#5c6573]">A cobrar</p>
              <p className="text-[12px] font-semibold text-[#7dd3e8]">R$ 1.011,52</p>
            </div>
          </div>
          <div className="bg-[#7dd3e8] py-2 text-center text-[11px] font-semibold text-[#060910]">
            Registrar coleta
          </div>
        </div>
      </div>
    </div>
  );
}

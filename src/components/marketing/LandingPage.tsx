"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Check,
  Fuel,
  MapPinned,
  Route,
  Smartphone,
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

const FEATURES = [
  {
    icon: Route,
    title: "Rotas que respeitam a operação",
    text: "Organize a sequência de pontos do dia e saia com o caminho certo — sem improvisar no meio da rua.",
  },
  {
    icon: Fuel,
    title: "Menos retrabalho, mais coleta",
    text: "Cada visita registrada no celular: leituras, valores, pendências e o que ficou para a próxima.",
  },
  {
    icon: BarChart3,
    title: "Números que fecham no fim do dia",
    text: "Relatórios de coletas, paradas e financeiro no mesmo painel — você enxerga o buraco antes dele virar prejuízo.",
  },
  {
    icon: Smartphone,
    title: "Feito para usar no campo",
    text: "Interface limpa no celular. O operador coleta; o dono acompanha. Sem planilha no bolso.",
  },
] as const;

export function LandingPage() {
  const [ciclo, setCiclo] = useState<"mensal" | "anual">("mensal");

  return (
    <div
      className={`${display.variable} ${sans.variable} lp-root relative min-h-dvh overflow-x-hidden bg-[#070b14] text-[#f4f7fb]`}
      style={{ fontFamily: "var(--font-lp-sans), system-ui, sans-serif" }}
    >
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="lp-grid absolute inset-0 opacity-[0.35]" />
        <div className="absolute -left-1/4 top-[-10%] h-[55vh] w-[70vw] rounded-full bg-[#7dd3e8]/10 blur-[100px]" />
        <div className="absolute right-[-20%] top-[20%] h-[40vh] w-[50vw] rounded-full bg-[#c9a87c]/8 blur-[120px]" />
      </div>

      <header className="relative z-20 mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-5 sm:px-8">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="lp-live-dot" aria-hidden />
          <span
            className="text-[1.35rem] font-medium tracking-tight"
            style={{ fontFamily: "var(--font-lp-display), system-ui, sans-serif" }}
          >
            Opera<span className="text-[#7dd3e8]">Rout</span>
          </span>
        </Link>
        <nav className="hidden items-center gap-8 text-[13px] text-[#9aa3b2] md:flex">
          <a href="#problema" className="transition hover:text-[#f4f7fb]">
            Por quê
          </a>
          <a href="#recursos" className="transition hover:text-[#f4f7fb]">
            Recursos
          </a>
          <a href="#planos" className="transition hover:text-[#f4f7fb]">
            Planos
          </a>
          <Link href="/login" className="transition hover:text-[#f4f7fb]">
            Entrar
          </Link>
        </nav>
        <Link
          href="/cadastro"
          className="rounded-md bg-[#7dd3e8] px-3.5 py-2 text-[12px] font-semibold tracking-wide text-[#070b14] transition hover:bg-[#9ae0ef]"
        >
          7 dias grátis
        </Link>
      </header>

      {/* HERO — uma composição, brand first */}
      <section className="relative z-10 mx-auto grid min-h-[calc(100dvh-4.5rem)] w-full max-w-6xl items-center gap-10 px-5 pb-16 pt-6 sm:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:gap-12 lg:pb-20 lg:pt-4">
        <div className="lp-fade-up space-y-6">
          <p className="text-[10px] font-medium uppercase tracking-[0.28em] text-[#7dd3e8]/80">
            Sistema online · operação em tempo real
          </p>
          <h1
            className="max-w-[14ch] text-[clamp(2.6rem,7vw,4.4rem)] font-medium leading-[0.92] tracking-[-0.04em] text-[#f4f7fb]"
            style={{ fontFamily: "var(--font-lp-display), system-ui, sans-serif" }}
          >
            Sua rota rende mais. Seu dia termina cedo.
          </h1>
          <p className="max-w-md text-[15px] leading-relaxed text-[#9aa3b2] sm:text-[16px]">
            OperaRoute organiza pontos, coletas e financeiro no celular — para quem vive de
            máquina em ponto e não pode perder tempo com planilha.
          </p>
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <Link
              href="/cadastro"
              className="group inline-flex items-center gap-2 rounded-md bg-[#7dd3e8] px-5 py-3 text-[13px] font-semibold text-[#070b14] transition hover:bg-[#9ae0ef]"
            >
              Começar agora — testar grátis
              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
            </Link>
            <a
              href="#planos"
              className="inline-flex items-center rounded-md border border-white/15 px-5 py-3 text-[13px] font-medium text-[#c9d0db] transition hover:border-[#7dd3e8]/40 hover:text-[#f4f7fb]"
            >
              Ver planos
            </a>
          </div>
          <p className="text-[12px] text-[#6b7382]">
            7 dias grátis · sem cartão · cancele quando quiser
          </p>
        </div>

        <div className="lp-fade-up-delay relative mx-auto w-full max-w-[340px] lg:max-w-none">
          <PhoneMockup />
        </div>
      </section>

      {/* PROBLEMA vs SOLUÇÃO */}
      <section
        id="problema"
        className="relative z-10 border-t border-white/[0.06] bg-[#0a0f18]/80"
      >
        <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-24">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-[10px] font-medium uppercase tracking-[0.28em] text-[#c9a87c]/90">
              O custo do improviso
            </p>
            <h2
              className="mt-3 text-[clamp(1.75rem,4vw,2.5rem)] font-medium tracking-tight text-[#f4f7fb]"
              style={{ fontFamily: "var(--font-lp-display), system-ui, sans-serif" }}
            >
              Caderno no bolso ou comando na mão?
            </h2>
            <p className="mt-3 text-[15px] leading-relaxed text-[#8b93a3]">
              Planejar rota no WhatsApp e anotar coleta no papel parece barato — até o negativo
              aparecer e ninguém lembrar de onde veio.
            </p>
          </div>

          <div className="mt-14 grid gap-6 lg:grid-cols-2 lg:gap-10">
            <div className="space-y-4 rounded-2xl border border-rose-500/20 bg-rose-500/[0.04] p-6 sm:p-8">
              <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-rose-300/80">
                Sem OperaRoute
              </p>
              <ul className="space-y-3 text-[14px] text-[#b8bec9]">
                {[
                  "Rota montada de cabeça — volta no mesmo bairro duas vezes",
                  "Leituras e valores espalhados em conversa e papel",
                  "Negativo e haver somem até a próxima cobrança",
                  "Dono só descobre o buraco no fim do mês",
                ].map((item) => (
                  <li key={item} className="flex gap-3">
                    <X className="mt-0.5 h-4 w-4 shrink-0 text-rose-400/90" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-4 rounded-2xl border border-[#7dd3e8]/25 bg-[#7dd3e8]/[0.05] p-6 sm:p-8">
              <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-[#7dd3e8]/90">
                Com OperaRoute
              </p>
              <ul className="space-y-3 text-[14px] text-[#c9d0db]">
                {[
                  "Pontos na ordem certa — menos km, mais coleta",
                  "Visita registrada no celular com o que importa",
                  "Pendências e negativos acompanham o ponto",
                  "Painel ao vivo: o que entrou, o que falta, o que cobrar",
                ].map((item) => (
                  <li key={item} className="flex gap-3">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#7dd3e8]" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* RECURSOS */}
      <section id="recursos" className="relative z-10 mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-24">
        <div className="max-w-xl">
          <p className="text-[10px] font-medium uppercase tracking-[0.28em] text-[#7dd3e8]/75">
            No campo e no escritório
          </p>
          <h2
            className="mt-3 text-[clamp(1.75rem,4vw,2.5rem)] font-medium tracking-tight"
            style={{ fontFamily: "var(--font-lp-display), system-ui, sans-serif" }}
          >
            Tudo que a operação precisa — sem ruído
          </h2>
          <p className="mt-3 text-[15px] leading-relaxed text-[#8b93a3]">
            Do ponto à rota, da coleta ao financeiro. Um sinal só.
          </p>
        </div>

        <div className="mt-12 grid gap-8 sm:grid-cols-2">
          {FEATURES.map((f) => (
            <article key={f.title} className="group border-t border-white/10 pt-6">
              <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[#7dd3e8]/20 bg-[#7dd3e8]/[0.06] text-[#7dd3e8] transition group-hover:border-[#7dd3e8]/40">
                <f.icon className="h-5 w-5" />
              </div>
              <h3
                className="text-[1.15rem] font-medium tracking-tight text-[#f4f7fb]"
                style={{ fontFamily: "var(--font-lp-display), system-ui, sans-serif" }}
              >
                {f.title}
              </h3>
              <p className="mt-2 text-[14px] leading-relaxed text-[#8b93a3]">{f.text}</p>
            </article>
          ))}
        </div>
      </section>

      {/* PLANOS */}
      <section
        id="planos"
        className="relative z-10 border-t border-white/[0.06] bg-gradient-to-b from-[#0a0f18] to-[#070b14]"
      >
        <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-24">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-[10px] font-medium uppercase tracking-[0.28em] text-[#c9a87c]/90">
              Preço simples
            </p>
            <h2
              className="mt-3 text-[clamp(1.75rem,4vw,2.5rem)] font-medium tracking-tight"
              style={{ fontFamily: "var(--font-lp-display), system-ui, sans-serif" }}
            >
              Escolha pelo tamanho da operação
            </h2>
            <p className="mt-3 text-[15px] text-[#8b93a3]">
              Planos por quantidade de pontos. Comece grátis por 7 dias.
            </p>

            <div className="mt-8 inline-flex rounded-full border border-white/10 bg-black/30 p-1">
              <button
                type="button"
                onClick={() => setCiclo("mensal")}
                className={`rounded-full px-4 py-2 text-[12px] font-semibold transition ${
                  ciclo === "mensal"
                    ? "bg-[#7dd3e8] text-[#070b14]"
                    : "text-[#9aa3b2] hover:text-white"
                }`}
              >
                Mensal
              </button>
              <button
                type="button"
                onClick={() => setCiclo("anual")}
                className={`rounded-full px-4 py-2 text-[12px] font-semibold transition ${
                  ciclo === "anual"
                    ? "bg-[#7dd3e8] text-[#070b14]"
                    : "text-[#9aa3b2] hover:text-white"
                }`}
              >
                Anual
                <span className="ml-1.5 text-[10px] opacity-80">
                  {MULTIPLICADOR_ANUAL_PADRAO}× mensal
                </span>
              </button>
            </div>
          </div>

          <div className="mt-12 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {PLANOS_PADRAO.map((plano) => {
              const mensal = plano.precoMensal;
              const anual = calcPrecoAnual(plano.id) ?? mensal * MULTIPLICADOR_ANUAL_PADRAO;
              const valor = ciclo === "mensal" ? mensal : anual;
              const porMes =
                ciclo === "anual" ? Math.round((anual / 12) * 100) / 100 : mensal;

              return (
                <div
                  key={plano.id}
                  className={`relative flex flex-col rounded-2xl border p-6 ${
                    plano.destaque
                      ? "border-[#7dd3e8]/45 bg-[#7dd3e8]/[0.07] shadow-[0_0_40px_rgba(125,211,232,0.08)]"
                      : "border-white/[0.08] bg-white/[0.02]"
                  }`}
                >
                  {plano.destaque && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#7dd3e8] px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#070b14]">
                      Mais escolhido
                    </span>
                  )}
                  <p className="text-[13px] font-semibold text-[#7dd3e8]">{plano.nome}</p>
                  <p className="mt-1 text-[12px] text-[#8b93a3]">{plano.labelPontos}</p>
                  <p
                    className="mt-5 text-[1.85rem] font-medium tracking-tight text-[#f4f7fb]"
                    style={{ fontFamily: "var(--font-lp-display), system-ui, sans-serif" }}
                  >
                    {formatBRL(valor)}
                    <span className="text-[13px] font-normal text-[#8b93a3]">
                      {ciclo === "mensal" ? "/mês" : "/ano"}
                    </span>
                  </p>
                  {ciclo === "anual" && (
                    <p className="mt-1 text-[11px] text-[#6b7382]">
                      ≈ {formatBRL(porMes)}/mês
                    </p>
                  )}
                  <p className="mt-3 flex-1 text-[13px] leading-relaxed text-[#9aa3b2]">
                    {plano.descricao}
                  </p>
                  <ul className="mt-4 space-y-2 text-[12px] text-[#b8bec9]">
                    <li className="flex gap-2">
                      <MapPinned className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#7dd3e8]" />
                      Até {plano.limitePontos >= 9999 ? "ilimitado" : plano.limitePontos} pontos
                    </li>
                    <li className="flex gap-2">
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#7dd3e8]" />
                      Até {plano.maxNichos} nicho{plano.maxNichos > 1 ? "s" : ""}
                    </li>
                  </ul>
                  <Link
                    href="/cadastro"
                    className={`mt-6 block rounded-md py-2.5 text-center text-[13px] font-semibold transition ${
                      plano.destaque
                        ? "bg-[#7dd3e8] text-[#070b14] hover:bg-[#9ae0ef]"
                        : "border border-white/15 text-[#f4f7fb] hover:border-[#7dd3e8]/40"
                    }`}
                  >
                    Testar grátis
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA final */}
      <section className="relative z-10 mx-auto max-w-6xl px-5 pb-20 sm:px-8">
        <div className="overflow-hidden rounded-3xl border border-[#7dd3e8]/20 bg-gradient-to-br from-[#0e1624] to-[#070b14] px-6 py-12 text-center sm:px-12">
          <h2
            className="text-[clamp(1.6rem,3.5vw,2.2rem)] font-medium tracking-tight"
            style={{ fontFamily: "var(--font-lp-display), system-ui, sans-serif" }}
          >
            Amanhã a rota já pode estar sob controle.
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-[14px] text-[#8b93a3]">
            Crie sua conta em minutos. Configure os pontos. Sua equipe coleta com o app.
          </p>
          <Link
            href="/cadastro"
            className="mt-7 inline-flex items-center gap-2 rounded-md bg-[#7dd3e8] px-6 py-3 text-[13px] font-semibold text-[#070b14] transition hover:bg-[#9ae0ef]"
          >
            Começar agora — 7 dias grátis
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <footer className="relative z-10 border-t border-white/[0.06]">
        <div className="mx-auto flex max-w-6xl flex-col gap-8 px-5 py-12 sm:px-8 md:flex-row md:justify-between">
          <div>
            <p
              className="text-[1.2rem] font-medium"
              style={{ fontFamily: "var(--font-lp-display), system-ui, sans-serif" }}
            >
              Opera<span className="text-[#7dd3e8]">Rout</span>
            </p>
            <p className="mt-2 max-w-xs text-[13px] text-[#6b7382]">
              Comando da operação em tempo real — pontos, coletas e rotas no mesmo sinal.
            </p>
          </div>
          <div className="flex flex-wrap gap-x-10 gap-y-6 text-[13px]">
            <div className="space-y-2">
              <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#5c6573]">
                Produto
              </p>
              <Link href="/login" className="block text-[#9aa3b2] hover:text-white">
                Entrar
              </Link>
              <Link href="/cadastro" className="block text-[#9aa3b2] hover:text-white">
                Criar conta
              </Link>
              <a href="#planos" className="block text-[#9aa3b2] hover:text-white">
                Planos
              </a>
            </div>
            <div className="space-y-2">
              <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#5c6573]">
                Suporte
              </p>
              <Link href="/suporte-contato" className="block text-[#9aa3b2] hover:text-white">
                Contato
              </Link>
              <a
                href={`https://wa.me/${WHATSAPP}`}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-[#9aa3b2] hover:text-white"
              >
                WhatsApp
              </a>
              <Link href="/downloads" className="block text-[#9aa3b2] hover:text-white">
                Baixar app
              </Link>
            </div>
            <div className="space-y-2">
              <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#5c6573]">
                Legal
              </p>
              <Link href="/termos" className="block text-[#9aa3b2] hover:text-white">
                Termos
              </Link>
              <Link href="/privacidade" className="block text-[#9aa3b2] hover:text-white">
                Privacidade
              </Link>
            </div>
          </div>
        </div>
        <div className="border-t border-white/[0.04] py-5 text-center text-[11px] text-[#5c6573]">
          © {new Date().getFullYear()} OperaRoute · canal seguro
        </div>
      </footer>
    </div>
  );
}

function PhoneMockup() {
  return (
    <div className="lp-phone-screen relative mx-auto aspect-[9/18.5] w-full max-w-[280px] overflow-hidden rounded-[2.2rem] border border-white/15 bg-[#0c121c] sm:max-w-[300px] lg:max-w-[320px]">
      <div className="absolute left-1/2 top-2.5 z-10 h-5 w-24 -translate-x-1/2 rounded-full bg-black/80" />
      <div className="flex h-full flex-col px-4 pb-5 pt-10">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[9px] uppercase tracking-[0.2em] text-[#7dd3e8]/70">Hoje</p>
            <p
              className="text-[1.15rem] font-medium text-white"
              style={{ fontFamily: "var(--font-lp-display), system-ui, sans-serif" }}
            >
              Rota Sul
            </p>
          </div>
          <span className="rounded-full bg-[#7dd3e8]/15 px-2 py-0.5 text-[10px] font-medium text-[#7dd3e8]">
            8 pontos
          </span>
        </div>

        <div className="mt-5 space-y-2.5">
          {[
            { nome: "Posto Central", status: "Coletado", ok: true },
            { nome: "Mercado Lima", status: "Em rota", ok: false },
            { nome: "Bar do Zé", status: "Próximo", ok: false },
          ].map((p) => (
            <div
              key={p.nome}
              className="flex items-center justify-between rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-2.5"
            >
              <div className="flex items-center gap-2.5">
                <span
                  className={`h-2 w-2 rounded-full ${p.ok ? "bg-emerald-400" : "bg-[#c9a87c]"}`}
                />
                <div>
                  <p className="text-[12px] font-medium text-[#f4f7fb]">{p.nome}</p>
                  <p className="text-[10px] text-[#6b7382]">{p.status}</p>
                </div>
              </div>
              <Route className="h-3.5 w-3.5 text-[#5c6573]" />
            </div>
          ))}
        </div>

        <div className="mt-auto space-y-3 pt-6">
          <div className="rounded-xl border border-[#7dd3e8]/20 bg-[#7dd3e8]/[0.06] p-3">
            <p className="text-[10px] uppercase tracking-wider text-[#7dd3e8]/80">
              Arrecadado hoje
            </p>
            <p
              className="mt-1 text-[1.4rem] font-medium text-white"
              style={{ fontFamily: "var(--font-lp-display), system-ui, sans-serif" }}
            >
              R$ 2.480,00
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg border border-white/[0.06] bg-black/20 px-2.5 py-2">
              <p className="text-[9px] text-[#6b7382]">Pendências</p>
              <p className="text-[13px] font-semibold text-[#c9a87c]">3 abertas</p>
            </div>
            <div className="rounded-lg border border-white/[0.06] bg-black/20 px-2.5 py-2">
              <p className="text-[9px] text-[#6b7382]">Km estimados</p>
              <p className="text-[13px] font-semibold text-[#f4f7fb]">42 km</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

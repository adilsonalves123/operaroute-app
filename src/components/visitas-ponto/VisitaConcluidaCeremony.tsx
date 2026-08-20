"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  Building2,
  Circle,
  CircleDot,
  Gamepad2,
  Package,
  Store,
  ToyBrick,
} from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import type { VisitaPontoNicho, VisitaPontoResumo } from "@/lib/visitas-ponto/types";
import type { TotaisComprovanteVisita } from "@/lib/visitas-ponto/comprovante-totais";
import { valorNichoComprovante } from "@/lib/visitas-ponto/comprovante-totais";
import { WhatsappVisitaPontoPanel } from "@/components/visitas-ponto/WhatsappVisitaPontoPanel";
import { ComissaoStaffLinha } from "@/components/equipe/ComissaoStaffLinha";

const ICONS: Partial<Record<VisitaPontoNicho, typeof Building2>> = {
  cassino: Building2,
  fura_fura: CircleDot,
  ursinho: ToyBrick,
  diversao: Gamepad2,
  bolinha: Circle,
  consignado: Store,
};

type Props = {
  resumo: VisitaPontoResumo;
  totais: TotaisComprovanteVisita;
  quitada: boolean;
  dividaSaldo: number;
  pontoWhatsapp?: string | null;
  chavePix?: string | null;
  nomeOperacao?: string | null;
  comissaoStaffPercentual?: number;
};

function formatDataVisita(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  try {
    return d.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return d.toISOString().slice(0, 16).replace("T", " ");
  }
}

export function VisitaConcluidaCeremony({
  resumo,
  totais,
  quitada,
  dividaSaldo,
  pontoWhatsapp = null,
  chavePix = null,
  nomeOperacao = null,
  comissaoStaffPercentual,
}: Props) {
  const [ativo, setAtivo] = useState(false);
  /** Só no cliente — evita mismatch SSR/UTC na hidratação. */
  const [dataStr, setDataStr] = useState("");

  useEffect(() => {
    setAtivo(true);
    setDataStr(formatDataVisita(resumo.finalizadaEm ?? resumo.createdAt));
  }, [resumo.finalizadaEm, resumo.createdAt]);

  const checkout = resumo.checkout;
  const primeiroNicho = resumo.nichos[0];
  const nichosLabel =
    resumo.nichos.length === 1 && primeiroNicho
      ? primeiroNicho.label
      : `${resumo.nichos.length} nichos`;

  return (
    <div
      className="relative -mx-4 -mt-2 min-h-[calc(100dvh-5.5rem)] px-4 pb-20 sm:-mx-6 sm:px-6"
      style={{ fontFamily: "Outfit, ui-sans-serif, system-ui, sans-serif" }}
    >
      <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden>
        <div
          className="absolute inset-0"
          style={{
            background: quitada
              ? "radial-gradient(ellipse 90% 55% at 50% -12%, rgba(196,165,116,0.18), transparent 58%), radial-gradient(ellipse 50% 40% at 100% 30%, rgba(196,165,116,0.06), transparent 50%), radial-gradient(ellipse 40% 35% at 0% 80%, rgba(80,60,30,0.14), transparent 45%), linear-gradient(180deg, #05070c 0%, #0a0c12 48%, #06080e 100%)"
              : "radial-gradient(ellipse 90% 55% at 50% -12%, rgba(251,191,36,0.12), transparent 58%), radial-gradient(ellipse 40% 35% at 0% 80%, rgba(120,70,20,0.12), transparent 45%), linear-gradient(180deg, #05070c 0%, #0a0c12 48%, #06080e 100%)",
          }}
        />
      </div>

      <style>{`
        @keyframes visitaRise {
          from { opacity: 0; transform: translateY(18px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes visitaLine {
          from { transform: scaleX(0); }
          to { transform: scaleX(1); }
        }
      `}</style>

      <div className="mx-auto max-w-2xl pt-8 sm:pt-12">
        <header
          className={cn("transition-opacity duration-700", ativo ? "opacity-100" : "opacity-0")}
          style={{ animation: ativo ? "visitaRise 0.9s ease-out both" : undefined }}
        >
          <p
            className="text-[11px] font-medium uppercase text-[#c4a574]"
            style={{ letterSpacing: "0.42em" }}
          >
            OperaRout
          </p>
          <h1
            className="mt-5 text-[clamp(2.75rem,9vw,4.25rem)] leading-[0.92] tracking-tight text-[#f4efe6]"
            style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
          >
            {resumo.pontoNome || "Ponto"}
          </h1>
          <p className="mt-4 max-w-md text-[15px] leading-relaxed text-slate-400">
            {quitada
              ? "Fechamento concluído. A visita encerrou quitada — o caixa desta passagem está resolvido."
              : `Visita encerrada com saldo em aberto de ${formatCurrency(totais.restante)}.`}
          </p>
          <div
            className="mt-8 h-px w-full origin-left bg-gradient-to-r from-[#c4a574]/70 via-[#c4a574]/20 to-transparent"
            style={{ animation: ativo ? "visitaLine 1.1s 0.15s ease-out both" : undefined }}
          />
        </header>

        <section
          className="mt-10"
          style={{ animation: ativo ? "visitaRise 0.8s 0.12s ease-out both" : undefined }}
        >
          <p
            className="text-[11px] uppercase text-slate-500"
            style={{ letterSpacing: "0.28em" }}
          >
            {quitada ? "Total liquidado" : "Total da visita"}
          </p>
          <p
            className="mt-2 text-[clamp(2.8rem,8vw,4rem)] leading-none tracking-tight tabular-nums text-[#f4efe6]"
            style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
          >
            {formatCurrency(totais.totalACobrar)}
          </p>
          <div className="mt-5 flex flex-wrap items-baseline gap-x-6 gap-y-2 text-sm">
            <p className="text-slate-400">
              Recebido{" "}
              <span className="tabular-nums text-[#e8dcc8]">{formatCurrency(totais.valorPago)}</span>
            </p>
            <span className="hidden text-slate-700 sm:inline" aria-hidden>
              ·
            </span>
            {quitada ? (
              <p className="font-medium tracking-wide text-[#c4a574]">Quitado</p>
            ) : (
              <p className="tabular-nums text-amber-300/90">
                Em aberto {formatCurrency(totais.restante)}
              </p>
            )}
          </div>
          <p className="mt-3 min-h-[1.25rem] text-[12px] text-slate-600">
            {dataStr}
            {dataStr ? <span className="text-slate-700"> · </span> : null}
            {nichosLabel}
          </p>
          {totais.desconto > 0.009 && (
            <p className="mt-2 text-[12px] text-slate-500">
              Desconto {formatCurrency(totais.desconto)}
            </p>
          )}
          <ComissaoStaffLinha
            className="mt-5"
            compact
            lucroAposBrindes={resumo.totalLucro}
            percentual={comissaoStaffPercentual}
          />
        </section>

        <section
          className="mt-10 flex flex-wrap items-center gap-4"
          style={{ animation: ativo ? "visitaRise 0.75s 0.22s ease-out both" : undefined }}
        >
          <Link
            href={`/pontos/${resumo.pontoId}`}
            className="group inline-flex items-center gap-2 bg-[#c4a574] px-6 py-3.5 text-[13px] font-semibold tracking-wide text-[#1a140c] transition hover:bg-[#d4b888]"
          >
            Voltar ao ponto
            <ArrowUpRight className="h-4 w-4 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </Link>
          <Link
            href="/coletas"
            className="text-[13px] text-slate-400 underline-offset-4 transition hover:text-[#e8dcc8] hover:underline"
          >
            Nova coleta
          </Link>
        </section>

        <section
          className="mt-14"
          style={{ animation: ativo ? "visitaRise 0.75s 0.28s ease-out both" : undefined }}
        >
          <p
            className="text-[11px] uppercase text-slate-500"
            style={{ letterSpacing: "0.28em" }}
          >
            Comprovante
          </p>
          <p className="mt-2 max-w-md text-sm text-slate-400">
            {quitada
              ? "Opcional — envie o recibo ao cliente ou guarde o PNG."
              : "Envie a cobrança do restante ou o comprovante parcial."}
          </p>
          <div className="mt-5">
            <WhatsappVisitaPontoPanel
              resumo={resumo}
              whatsapp={pontoWhatsapp}
              dividaSaldo={dividaSaldo}
              desconto={totais.desconto}
              pix={checkout?.valorPix}
              dinheiro={checkout?.valorDinheiro}
              chavePix={chavePix}
              nomeOperacao={nomeOperacao}
              variante="ceremony"
            />
          </div>
        </section>

        {resumo.nichos.length > 0 && (
          <section
            className="mt-16"
            style={{ animation: ativo ? "visitaRise 0.75s 0.34s ease-out both" : undefined }}
          >
            <p
              className="text-[11px] uppercase text-slate-500"
              style={{ letterSpacing: "0.28em" }}
            >
              Detalhe da passagem
            </p>
            <ul className="mt-6 divide-y divide-white/[0.06] border-y border-white/[0.08]">
              {resumo.nichos.map((nicho) => {
                const Icon = ICONS[nicho.nicho] ?? Package;
                const valor = valorNichoComprovante(nicho);
                return (
                  <li key={nicho.nicho} className="py-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <Icon className="h-3.5 w-3.5 shrink-0 text-[#c4a574]/70" />
                          <h2
                            className="text-xl text-[#f4efe6]"
                            style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
                          >
                            {nicho.label}
                          </h2>
                        </div>
                        {nicho.maquinas.length > 0 && (
                          <ul className="mt-3 space-y-1.5 pl-5">
                            {nicho.maquinas.map((m) => (
                              <li
                                key={m.id}
                                className="flex justify-between gap-4 text-[13px] text-slate-500"
                              >
                                <span className="truncate">
                                  {m.nome}
                                  {m.numeroMaquina ? ` · #${m.numeroMaquina}` : ""}
                                </span>
                                <span className="shrink-0 tabular-nums text-slate-400">
                                  {formatCurrency(
                                    nicho.nicho === "cassino" ? m.lucro : m.valorCobravel
                                  )}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                        {nicho.href && (
                          <Link
                            href={nicho.href}
                            className="mt-3 inline-block pl-5 text-[12px] text-[#c4a574]/80 underline-offset-4 hover:text-[#c4a574] hover:underline"
                          >
                            Ver coleta
                          </Link>
                        )}
                      </div>
                      <p
                        className="shrink-0 text-right text-2xl tabular-nums text-[#e8dcc8]"
                        style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
                      >
                        {formatCurrency(valor)}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {resumo.cassinoNegativo && (
          <section className="mt-10 border-l-2 border-red-400/40 pl-4">
            <p className="text-sm text-red-300/90">Cassino negativo — fora da cobrança</p>
            <p className="mt-1 text-sm text-slate-500">
              Operação {formatCurrency(resumo.cassinoNegativo.valorOperacao)} · lucro{" "}
              {formatCurrency(resumo.cassinoNegativo.lucroReais)}
            </p>
            <Link
              href={resumo.cassinoNegativo.href}
              className="mt-2 inline-block text-[12px] text-[#c4a574] hover:underline"
            >
              Corrigir leituras e valores
            </Link>
          </section>
        )}
      </div>
    </div>
  );
}

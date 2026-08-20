"use client";

import Link from "next/link";
import { ArrowLeft, Building2, Circle, CircleDot, Gamepad2, Store, ToyBrick } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import type { VisitaPontoResumo } from "@/lib/visitas-ponto/types";
import { VisitaPontoCheckoutForm } from "@/components/visitas-ponto/VisitaPontoCheckoutForm";
import { VisitaPontoNav } from "@/components/visitas-ponto/VisitaPontoNav";
import { VisitaConcluidaCeremony } from "@/components/visitas-ponto/VisitaConcluidaCeremony";
import { ComissaoStaffLinha } from "@/components/equipe/ComissaoStaffLinha";
import type { VisitaPontoNicho } from "@/lib/visitas-ponto/types";
import {
  totaisComprovanteVisita,
} from "@/lib/visitas-ponto/comprovante-totais";

const ICONS: Record<VisitaPontoNicho, typeof Building2> = {
  cassino: Building2,
  fura_fura: CircleDot,
  ursinho: ToyBrick,
  diversao: Gamepad2,
  bolinha: Circle,
  consignado: Store,
};

type Props = {
  resumo: VisitaPontoResumo;
  dividaSaldo: number;
  haverSaldo?: number;
  pontoWhatsapp?: string | null;
  chavePix?: string | null;
  nomeOperacao?: string | null;
  nichosDisponiveis?: VisitaPontoNicho[];
  /** % do operador da visita (ou do usuário logado). */
  comissaoStaffPercentual?: number;
};

export function VisitaPontoResumoView({
  resumo,
  dividaSaldo,
  haverSaldo = 0,
  pontoWhatsapp = null,
  chavePix = null,
  nomeOperacao = null,
  nichosDisponiveis,
  comissaoStaffPercentual,
}: Props) {
  const emRascunho = resumo.status === "rascunho";
  const nichosFeitos = resumo.nichos.map((n) => n.nicho);
  const totaisFinal = !emRascunho
    ? totaisComprovanteVisita(resumo, { dividaSaldo })
    : null;
  const visitaQuitada =
    Boolean(totaisFinal) && (totaisFinal?.restante ?? 1) <= 0.009;

  if (!emRascunho && totaisFinal) {
    return (
      <VisitaConcluidaCeremony
        resumo={resumo}
        totais={totaisFinal}
        quitada={visitaQuitada}
        dividaSaldo={dividaSaldo}
        pontoWhatsapp={pontoWhatsapp}
        chavePix={chavePix}
        nomeOperacao={nomeOperacao}
        comissaoStaffPercentual={comissaoStaffPercentual}
      />
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <VisitaPontoNav
        visitaPontoId={resumo.visitaPontoId}
        pontoId={resumo.pontoId}
        nichosDisponiveis={nichosDisponiveis}
        nichosFeitos={nichosFeitos}
        active="cobrar"
        pontoNome={resumo.pontoNome}
        subtotalCobravel={resumo.subtotalCobravel}
      />

      <header className="space-y-3">
        <Link
          href={`/visitas-ponto/${resumo.visitaPontoId}`}
          className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-primary-neon"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Voltar à visita
        </Link>
        <div>
          <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Cobrar visita</p>
          <h1 className="text-2xl font-bold text-white">{resumo.pontoNome}</h1>
          <p className="mt-1 text-sm text-slate-400">
            Prévia e pagamento de todos os nichos. Descontos de operação já entram no valor de cada
            coleta.
          </p>
        </div>
      </header>

      <VisitaPontoCheckoutForm
        resumo={resumo}
        dividaSaldo={dividaSaldo}
        haverSaldo={haverSaldo}
        pontoWhatsapp={pontoWhatsapp}
        chavePix={chavePix}
        nomeOperacao={nomeOperacao}
      />

      {resumo.totalLucro > 0.009 && (
        <ComissaoStaffLinha
          lucroAposBrindes={resumo.totalLucro}
          percentual={comissaoStaffPercentual}
        />
      )}

      <div className="space-y-4">
        {resumo.nichos.map((nicho) => {
          const Icon = ICONS[nicho.nicho] ?? Building2;
          const valorNicho = nicho.totalCobravel;
          return (
            <section
              key={nicho.nicho}
              className="overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.02]"
            >
              <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-slate-400" />
                  <h2 className="font-semibold text-white">{nicho.label}</h2>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold tabular-nums text-white">
                    {formatCurrency(valorNicho)}
                  </p>
                </div>
              </div>
              {nicho.maquinas.length > 0 ? (
                <ul className="divide-y divide-white/[0.04]">
                  {nicho.maquinas.map((m) => (
                    <li key={m.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                      <span className="text-slate-300">
                        {m.nome}
                        {m.numeroMaquina ? ` · #${m.numeroMaquina}` : ""}
                      </span>
                      <span
                        className={cn(
                          "font-medium tabular-nums",
                          m.lucro >= 0 ? "text-green-400" : "text-red-400"
                        )}
                      >
                        {formatCurrency(nicho.nicho === "cassino" ? m.lucro : m.valorCobravel)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="px-4 py-3 text-sm text-slate-500">Sem detalhe por máquina.</p>
              )}
              {nicho.custoBrindes > 0.009 && (
                <p className="border-t border-white/[0.04] px-4 py-2 text-xs text-amber-400/90">
                  Brindes: {formatCurrency(nicho.custoBrindes)}
                </p>
              )}
              {nicho.totalLucro > 0.009 && (
                <div className="border-t border-white/[0.04] px-4 py-2">
                  <ComissaoStaffLinha
                    compact
                    lucroAposBrindes={nicho.totalLucro}
                    percentual={comissaoStaffPercentual}
                  />
                </div>
              )}
              {nicho.href && (
                <div className="border-t border-white/[0.04] px-4 py-2">
                  <Link href={nicho.href} className="text-xs text-primary-neon hover:underline">
                    {resumo.status === "finalizada" &&
                    (nicho.nicho === "cassino" || nicho.nicho === "fura_fura")
                      ? "Corrigir leituras e valores →"
                      : "Ver coleta completa →"}
                  </Link>
                </div>
              )}
            </section>
          );
        })}
      </div>

      {resumo.cassinoNegativo && (
        <section className="rounded-xl border border-red-500/20 bg-red-500/[0.04] p-4">
          <p className="text-sm font-medium text-red-300">Cassino negativo — fora da cobrança</p>
          <p className="mt-1 text-sm text-slate-400">
            Operação {formatCurrency(resumo.cassinoNegativo.valorOperacao)} · lucro{" "}
            {formatCurrency(resumo.cassinoNegativo.lucroReais)}
          </p>
          <Link
            href={resumo.cassinoNegativo.href}
            className="mt-2 inline-block text-xs text-primary-neon hover:underline"
          >
            Corrigir leituras e valores →
          </Link>
        </section>
      )}

      {resumo.nichos.length === 0 && (
        <p className="text-sm text-slate-500">Nenhuma coleta registrada nesta visita ainda.</p>
      )}
    </div>
  );
}

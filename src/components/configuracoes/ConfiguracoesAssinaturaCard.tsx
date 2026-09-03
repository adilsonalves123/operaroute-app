import Link from "next/link";
import { ArrowUpRight, Sparkles } from "lucide-react";
import {
  type AcessoAssinaturaInput,
  diasRestantesTrial,
  estaEmTrial,
  temPagamentoValido,
  trialExpirado,
  trialFimEfetivoIso,
} from "@/lib/assinatura-acesso";
import { getPlanoByFaixa, type FaixaPontos, type PlanoDefinicao } from "@/lib/pricing";
import { champagneLink, ConfigPanelBody } from "@/components/configuracoes/configuracoes-ui";

type Props = {
  acesso: AcessoAssinaturaInput;
  faixa: FaixaPontos;
  planos?: PlanoDefinicao[];
  embedded?: boolean;
};

export function ConfiguracoesAssinaturaCard({
  acesso,
  faixa,
  planos,
  embedded = false,
}: Props) {
  const plano = getPlanoByFaixa(faixa, planos);
  const pagamentoOk = temPagamentoValido(acesso);
  const emTrial = estaEmTrial(acesso);
  const expirado = trialExpirado(acesso);
  const trialFim = trialFimEfetivoIso(acesso);
  const dias = diasRestantesTrial(trialFim);

  let statusLabel = "Sem período ativo";
  let statusClass = "text-at-muted border-at bg-at-card-soft";
  if (pagamentoOk) {
    statusLabel = "Pagamento confirmado";
    statusClass = "text-emerald-700 border-emerald-500/25 bg-emerald-500/10 dark:text-emerald-200";
  } else if (emTrial) {
    statusLabel = `${dias} dia${dias === 1 ? "" : "s"} de teste`;
    statusClass = "text-at-link border-[var(--at-tab-active-border)] bg-at-tab-active/15";
  } else if (expirado) {
    statusLabel = "Teste encerrado";
    statusClass = "text-rose-700 border-rose-500/25 bg-rose-500/10 dark:text-rose-200";
  }

  const inner = (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full border px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.1em] ${statusClass}`}
          >
            {statusLabel}
          </span>
          {pagamentoOk && acesso.assinatura_vence_em ? (
            <span className="text-[12px] text-at-muted">
              Vence em{" "}
              {new Date(acesso.assinatura_vence_em).toLocaleDateString("pt-BR")}
            </span>
          ) : null}
        </div>
        <div>
          <p className="text-[15px] font-medium text-at-primary">{plano.nome}</p>
          <p className="mt-1 text-[13px] text-at-muted">
            {pagamentoOk
              ? "Sua operação está ativa com o plano contratado."
              : emTrial
                ? "Período de teste sem cobrança automática."
                : "Escolha um plano para continuar usando o OperaRoute."}
          </p>
        </div>
      </div>
      <Link
        href="/planos"
        className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-at bg-at-card-soft px-4 py-2.5 text-[13px] font-medium text-at-link transition hover:bg-at-tab-active/10 ${champagneLink}`}
      >
        <Sparkles className="h-4 w-4" />
        Ver planos
        <ArrowUpRight className="h-3.5 w-3.5 opacity-70" />
      </Link>
    </div>
  );

  if (embedded) return inner;

  return <ConfigPanelBody>{inner}</ConfigPanelBody>;
}

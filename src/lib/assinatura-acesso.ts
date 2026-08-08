/** Dias de teste grátis no cadastro (sem cartão). */
export const TRIAL_DIAS_PADRAO = 7;

export function trialFimEm(dias = TRIAL_DIAS_PADRAO, from = new Date()): Date {
  return new Date(from.getTime() + dias * 24 * 60 * 60 * 1000);
}

export function trialFimIso(dias = TRIAL_DIAS_PADRAO, from = new Date()): string {
  return trialFimEm(dias, from).toISOString();
}

export type AcessoAssinaturaInput = {
  assinatura_ativa?: boolean | null;
  trial_fim?: string | null;
  trial_inicio?: string | null;
  assinatura_vence_em?: string | null;
  empresa_created_at?: string | null;
};

export type OwnerProfileAcesso = {
  assinatura_ativa?: boolean | null;
  trial_fim?: string | null;
  trial_inicio?: string | null;
};

export type EmpresaAcesso = {
  assinatura_vence_em?: string | null;
  created_at?: string | null;
};

function diasAte(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return null;
  return Math.ceil((t - Date.now()) / (24 * 60 * 60 * 1000));
}

export function buildAcessoAssinaturaInput(
  ownerProfile: OwnerProfileAcesso | null | undefined,
  empresa: EmpresaAcesso | null | undefined
): AcessoAssinaturaInput {
  return {
    assinatura_ativa: ownerProfile?.assinatura_ativa,
    trial_fim: ownerProfile?.trial_fim,
    trial_inicio: ownerProfile?.trial_inicio,
    assinatura_vence_em: empresa?.assinatura_vence_em,
    empresa_created_at: empresa?.created_at,
  };
}

/**
 * Pagamento real: período de assinatura ainda válido.
 * Não confia só na flag assinatura_ativa (legado/RPC antigo).
 */
export function temPagamentoValido(p: AcessoAssinaturaInput): boolean {
  const dias = diasAte(p.assinatura_vence_em);
  return dias != null && dias >= 0;
}

/** Fim do trial inferido quando trial_fim não foi gravado. */
export function trialFimEfetivo(p: AcessoAssinaturaInput): Date | null {
  if (p.trial_fim) {
    const d = new Date(p.trial_fim);
    if (Number.isFinite(d.getTime())) return d;
  }
  const baseIso = p.trial_inicio ?? p.empresa_created_at;
  if (!baseIso) return null;
  const base = new Date(baseIso);
  if (!Number.isFinite(base.getTime())) return null;
  return trialFimEm(TRIAL_DIAS_PADRAO, base);
}

export function trialFimEfetivoIso(p: AcessoAssinaturaInput): string | null {
  const d = trialFimEfetivo(p);
  return d ? d.toISOString() : null;
}

/** Em trial: sem pagamento válido e ainda dentro do período de teste. */
export function estaEmTrial(p: AcessoAssinaturaInput): boolean {
  if (temPagamentoValido(p)) return false;
  const fim = trialFimEfetivo(p);
  if (!fim) return false;
  return fim.getTime() > Date.now();
}

/** Trial acabou e não há assinatura paga. */
export function trialExpirado(p: AcessoAssinaturaInput): boolean {
  if (temPagamentoValido(p)) return false;
  const fim = trialFimEfetivo(p);
  if (!fim) return true;
  return fim.getTime() <= Date.now();
}

/**
 * Pode usar o app:
 * - assinatura com vencimento futuro (pagamento confirmado), ou
 * - ainda dentro dos 7 dias de teste.
 */
export function temAcessoOperacao(p: AcessoAssinaturaInput): boolean {
  if (temPagamentoValido(p)) return true;
  const fim = trialFimEfetivo(p);
  if (!fim) return false;
  return fim.getTime() > Date.now();
}

/** Dias restantes do trial (0 se expirou ou não há trial). */
export function diasRestantesTrial(
  trialFim: string | null | undefined,
  input?: Omit<AcessoAssinaturaInput, "trial_fim">
): number {
  const fim =
    trialFim
      ? new Date(trialFim)
      : input
        ? trialFimEfetivo({ ...input, trial_fim: null })
        : null;
  if (!fim || !Number.isFinite(fim.getTime())) return 0;
  const diff = fim.getTime() - Date.now();
  if (diff <= 0) return 0;
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

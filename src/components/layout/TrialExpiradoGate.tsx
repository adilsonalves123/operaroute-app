import Link from "next/link";
import { ArrowRight, CreditCard, Lock, ShieldCheck } from "lucide-react";

/** Bloqueia o app quando o trial de 7 dias acabou e não há assinatura. */
export function TrialExpiradoGate() {
  return (
    <div className="flex flex-1 items-center justify-center px-4 py-8 sm:p-6">
      <div className="w-full max-w-3xl overflow-hidden rounded-[28px] border border-white/[0.08] bg-[radial-gradient(circle_at_top,_rgba(196,165,116,0.14),_transparent_32%),linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] shadow-[0_24px_80px_rgba(0,0,0,0.35)] backdrop-blur-xl">
        <div className="border-b border-white/[0.06] px-6 py-5 sm:px-8">
          <span className="inline-flex items-center gap-2 rounded-full border border-rose-500/25 bg-rose-500/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-rose-200">
            <Lock className="h-3.5 w-3.5" />
            Acesso pausado
          </span>
        </div>

        <div className="grid gap-8 px-6 py-8 sm:px-8 sm:py-10 lg:grid-cols-[1.35fr_0.9fr] lg:items-center">
          <div className="space-y-6">
            <div className="space-y-3">
              <h1 className="text-3xl font-semibold tracking-tight text-[#f4efe6] sm:text-4xl">
                Seu periodo de teste chegou ao fim
              </h1>
              <p className="max-w-xl text-[15px] leading-relaxed text-slate-300 sm:text-base">
                O OperaRoute bloqueou a operacao porque os 7 dias gratis terminaram
                e ainda nao houve confirmacao de pagamento. Para liberar tudo de
                novo, basta escolher um plano e concluir a assinatura.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/[0.08] bg-black/20 p-4">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl border border-[#c4a574]/25 bg-[#c4a574]/10 text-[#e8d5b0]">
                  <CreditCard className="h-4 w-4" />
                </div>
                <p className="text-sm font-medium text-[#f4efe6]">
                  Reativacao imediata
                </p>
                <p className="mt-1 text-[13px] leading-relaxed text-slate-400">
                  Assim que a assinatura for confirmada, o acesso volta para sua
                  operacao.
                </p>
              </div>

              <div className="rounded-2xl border border-white/[0.08] bg-black/20 p-4">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-500/25 bg-emerald-500/10 text-emerald-200">
                  <ShieldCheck className="h-4 w-4" />
                </div>
                <p className="text-sm font-medium text-[#f4efe6]">
                  Dados preservados
                </p>
                <p className="mt-1 text-[13px] leading-relaxed text-slate-400">
                  Seus pontos, equipamentos, coletas e configuracoes continuam
                  salvos.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Link
                href="/planos"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#c4a574] px-5 py-3 text-[13px] font-semibold text-[#0a0e16] transition hover:brightness-110"
              >
                Escolher plano agora
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/suporte"
                className="inline-flex items-center justify-center rounded-xl border border-white/12 bg-white/[0.03] px-5 py-3 text-[13px] font-medium text-slate-200 transition hover:border-[#c4a574]/30 hover:text-[#e8d5b0]"
              >
                Falar com o suporte
              </Link>
            </div>
          </div>

          <div className="rounded-[24px] border border-white/[0.08] bg-[#0a0e16]/80 p-5 sm:p-6">
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#c4a574]/80">
              O que acontece agora
            </p>
            <div className="mt-4 space-y-4">
              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
                <p className="text-sm font-medium text-[#f4efe6]">1. Escolha seu plano</p>
                <p className="mt-1 text-[13px] leading-relaxed text-slate-400">
                  Veja os valores e selecione a faixa ideal para a sua operacao.
                </p>
              </div>
              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
                <p className="text-sm font-medium text-[#f4efe6]">2. Pague pelo Mercado Pago</p>
                <p className="mt-1 text-[13px] leading-relaxed text-slate-400">
                  A renovacao e manual, sem cobranca automatica no cartao.
                </p>
              </div>
              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
                <p className="text-sm font-medium text-[#f4efe6]">3. Volte a operar</p>
                <p className="mt-1 text-[13px] leading-relaxed text-slate-400">
                  Depois da confirmacao, o acesso ao app e liberado novamente.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

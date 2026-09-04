"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Clock, HandCoins, Loader2 } from "lucide-react";
import { ColetaRecebimentoFields } from "@/components/coletas/layout";
import { WhatsappVisitaPontoPanel } from "@/components/visitas-ponto/WhatsappVisitaPontoPanel";
import { calcularCheckoutVisita } from "@/lib/visitas-ponto/checkout";
import type { VisitaPontoResumo } from "@/lib/visitas-ponto/types";
import { cn, formatCurrency, parseMoneyInput } from "@/lib/utils";
import { useSubmitLock } from "@/hooks/use-submit-lock";
import { parseFetchJson } from "@/lib/http/parse-fetch-json";

type Props = {
  resumo: VisitaPontoResumo;
  dividaSaldo: number;
  haverSaldo?: number;
  pontoWhatsapp?: string | null;
  chavePix?: string | null;
  nomeOperacao?: string | null;
};

export function VisitaPontoCheckoutForm({
  resumo,
  dividaSaldo,
  haverSaldo = 0,
  pontoWhatsapp = null,
  chavePix = null,
  nomeOperacao = null,
}: Props) {
  const router = useRouter();
  const [desconto, setDesconto] = useState("");
  const [pix, setPix] = useState("");
  const [dinheiro, setDinheiro] = useState("");
  const [descontarHaver, setDescontarHaver] = useState(false);
  const [incluirDivida, setIncluirDivida] = useState(true);
  const [loading, setLoading] = useState(false);
  const submitLock = useSubmitLock();
  const [erro, setErro] = useState("");

  const pixNum = parseMoneyInput(pix);
  const dinheiroNum = parseMoneyInput(dinheiro);
  const descontoNum = parseMoneyInput(desconto);
  const dividaNoCheckout = incluirDivida ? dividaSaldo : 0;

  const calculo = useMemo(
    () =>
      calcularCheckoutVisita({
        subtotalCobravel: resumo.subtotalCobravel,
        dividaAnteriorTotal: dividaNoCheckout,
        dividaRecebidaInicio: 0,
        desconto: descontoNum,
        pix: pixNum,
        dinheiro: dinheiroNum,
        haverSaldo,
        descontarHaver,
      }),
    [
      resumo.subtotalCobravel,
      dividaNoCheckout,
      descontoNum,
      pixNum,
      dinheiroNum,
      haverSaldo,
      descontarHaver,
    ]
  );

  const temHaver = haverSaldo > 0.009;
  const temDivida = dividaSaldo > 0.009;
  const semRecebimentoAgora =
    calculo.valorPago <= 0.009 && calculo.haverAbatido <= 0.009;
  const dividaRestante = incluirDivida
    ? Math.max(0, dividaSaldo - calculo.aplicadoDivida)
    : dividaSaldo;

  async function handleFinalizar() {
    if (loading || !submitLock.tryLock()) return;
    setErro("");
    setLoading(true);
    let concluido = false;
    try {
      const res = await fetch(`/api/visitas-ponto/${resumo.visitaPontoId}/finalizar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          desconto: descontoNum,
          valor_pix: pix,
          valor_dinheiro: dinheiro,
          descontar_haver: descontarHaver,
          incluir_divida: incluirDivida,
        }),
      });
      const data = await parseFetchJson<{ error?: string }>(res);
      if (!res.ok) {
        setErro(data.error ?? "Erro ao finalizar visita.");
        return;
      }
      concluido = true;
      router.push(`/visitas-ponto/${resumo.visitaPontoId}/resumo`);
      router.refresh();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro de conexão.");
    } finally {
      setLoading(false);
      if (!concluido) submitLock.unlock();
    }
  }

  return (
    <section className="rounded-2xl border border-primary-neon/25 bg-black/20 p-5 space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-white">Cobrar visita</h2>
        <p className="mt-1 text-sm text-at-muted">
          Um só lugar: operações de hoje, dívida, haver, pix e dinheiro.
        </p>
      </div>

      <div className="space-y-2 text-sm">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-at-muted">
          1 · Operação de hoje
        </p>
        {resumo.nichos.map((n) => (
          <div key={n.nicho} className="flex justify-between text-at-primary/85">
            <span>{n.label}</span>
            <span className="tabular-nums">{formatCurrency(n.totalCobravel)}</span>
          </div>
        ))}
        <div className="flex justify-between border-t border-at pt-2 text-at-muted">
          <span>Subtotal visita</span>
          <span className="tabular-nums">{formatCurrency(resumo.subtotalCobravel)}</span>
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-at-muted">
          2 · Ajustes
        </p>

        {temDivida && (
          <label
            className={cn(
              "flex cursor-pointer gap-3 rounded-lg border p-3 transition-colors",
              incluirDivida
                ? "border-amber-500/40 bg-amber-500/10"
                : "border-at-soft bg-black/20 hover:border-at-soft"
            )}
          >
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 accent-amber-400"
              checked={incluirDivida}
              onChange={(e) => setIncluirDivida(e.target.checked)}
            />
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 text-sm font-medium text-amber-200">
                <Clock className="h-4 w-4 shrink-0" />
                Incluir dívida anterior
              </p>
              <p className="mt-0.5 text-xs text-at-muted">
                Pendências antigas: {formatCurrency(dividaSaldo)}
                {incluirDivida
                  ? " · entra no total a cobrar (pode pagar parcial)"
                  : " · fica de fora desta cobrança"}
              </p>
              {resumo.dividaRecebidaInicio != null &&
                resumo.dividaRecebidaInicio > 0.009 && (
                  <p className="mt-1 text-[11px] text-at-muted">
                    Já recebido no início desta visita:{" "}
                    {formatCurrency(resumo.dividaRecebidaInicio)}
                  </p>
                )}
            </div>
            <span className="shrink-0 text-sm font-semibold tabular-nums text-amber-200">
              {incluirDivida ? `+ ${formatCurrency(dividaSaldo)}` : formatCurrency(dividaSaldo)}
            </span>
          </label>
        )}

        {temHaver && (
          <label
            className={cn(
              "flex cursor-pointer gap-3 rounded-lg border p-3 transition-colors",
              descontarHaver
                ? "border-cyan-500/40 bg-cyan-500/10"
                : "border-at-soft bg-black/20 hover:border-at-soft"
            )}
          >
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 accent-cyan-400"
              checked={descontarHaver}
              onChange={(e) => setDescontarHaver(e.target.checked)}
            />
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 text-sm font-medium text-cyan-200">
                <HandCoins className="h-4 w-4 shrink-0" />
                Descontar haver do ponto
              </p>
              <p className="mt-0.5 text-xs text-at-muted">
                Crédito aberto: {formatCurrency(haverSaldo)}
                {descontarHaver && calculo.haverAbatido > 0.009
                  ? ` · abate ${formatCurrency(calculo.haverAbatido)} nesta cobrança`
                  : " · abate do valor da visita de hoje"}
              </p>
            </div>
          </label>
        )}

        {calculo.desconto > 0.009 && (
          <div className="flex justify-between text-sm text-rose-300 px-1">
            <span>Desconto no total</span>
            <span className="tabular-nums">− {formatCurrency(calculo.desconto)}</span>
          </div>
        )}

        {calculo.haverAbatido > 0.009 && (
          <div className="flex justify-between text-sm text-cyan-300 px-1">
            <span>Haver descontado</span>
            <span className="tabular-nums">− {formatCurrency(calculo.haverAbatido)}</span>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-primary-neon/30 bg-primary-neon/[0.08] px-4 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary-neon/80">
          3 · A cobrar agora
        </p>
        <p className="mt-1 text-3xl font-bold tabular-nums text-primary-neon">
          {formatCurrency(calculo.totalACobrar)}
        </p>
        {!incluirDivida && temDivida && (
          <p className="mt-1 text-xs text-amber-300/90">
            Dívida de {formatCurrency(dividaSaldo)} fica pendente (não incluída).
          </p>
        )}
      </div>

      <ColetaRecebimentoFields
        desconto={desconto}
        pix={pix}
        dinheiro={dinheiro}
        onDescontoChange={setDesconto}
        onPixChange={setPix}
        onDinheiroChange={setDinheiro}
        hint={
          incluirDivida && temDivida
            ? "O pagamento cobre a visita de hoje primeiro. O que sobrar abate a dívida antiga (pode ser parcial)."
            : "Informe pix e dinheiro desta visita. Dívida antiga fora do total."
        }
        status={{
          valorPago: calculo.valorPago,
          saldoPendente: calculo.restante,
          haver: calculo.haver,
          quitado: calculo.restante <= 0.009 && calculo.valorPago > 0.009,
          aplicadoVisita: Math.min(calculo.aplicadoVisita, calculo.subtotalAposDesconto),
          dividaAbatida: calculo.aplicadoDivida,
          dividaRestante: incluirDivida ? dividaRestante : 0,
          mensagem: (() => {
            if (calculo.valorPago <= 0.009 && calculo.haverAbatido <= 0.009) {
              return undefined;
            }
            if (!incluirDivida && temDivida) {
              return calculo.restante <= 0.009
                ? `Visita quitada. Dívida antiga de ${formatCurrency(dividaSaldo)} continua pendente.`
                : `Ainda deve ${formatCurrency(calculo.restante)} desta visita. Dívida antiga (${formatCurrency(dividaSaldo)}) fora.`;
            }
            if (calculo.restante <= 0.009) {
              return calculo.haver > 0.009
                ? `Quitado. Sobrou ${formatCurrency(calculo.haver)} de haver para o ponto.`
                : "Quitado — nada a dever nesta cobrança.";
            }
            if (calculo.aplicadoDivida <= 0.009 && dividaSaldo > 0.009) {
              return `Ainda deve ${formatCurrency(calculo.restante)}. Dívida anterior ainda não foi abatida.`;
            }
            if (calculo.aplicadoDivida > 0.009 && dividaRestante > 0.009) {
              return `Pago parcial. Ainda deve ${formatCurrency(calculo.restante)} (inclui ${formatCurrency(dividaRestante)} de dívida antiga).`;
            }
            return `Pago parcial. Ainda deve ${formatCurrency(calculo.restante)}.`;
          })(),
        }}
      />

      {(calculo.valorPago > 0.009 || calculo.restante > 0.009) && (
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg border border-green-500/25 bg-green-500/5 px-3 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-green-400/80">
              Pago hoje
            </p>
            <p className="mt-1 text-xl font-bold tabular-nums text-green-300">
              {formatCurrency(calculo.valorPago)}
            </p>
          </div>
          <div
            className={cn(
              "rounded-lg border px-3 py-3",
              calculo.restante > 0.009
                ? "border-amber-500/25 bg-amber-500/5"
                : "border-at bg-white/[0.02]"
            )}
          >
            <p
              className={cn(
                "text-[10px] font-semibold uppercase tracking-wider",
                calculo.restante > 0.009 ? "text-amber-400/80" : "text-at-muted"
              )}
            >
              Ainda deve
            </p>
            <p
              className={cn(
                "mt-1 text-xl font-bold tabular-nums",
                calculo.restante > 0.009 ? "text-amber-300" : "text-at-muted"
              )}
            >
              {formatCurrency(calculo.restante)}
            </p>
          </div>
        </div>
      )}

      <WhatsappVisitaPontoPanel
        resumo={resumo}
        whatsapp={pontoWhatsapp}
        dividaSaldo={dividaNoCheckout}
        desconto={descontoNum}
        pix={pixNum}
        dinheiro={dinheiroNum}
        previa
        chavePix={chavePix}
        nomeOperacao={nomeOperacao}
        haverSaldo={haverSaldo}
        descontarHaver={descontarHaver}
      />

      <button
        type="button"
        onClick={handleFinalizar}
        disabled={loading || resumo.itensConcluidos === 0}
        className={cn(
          "inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary-neon px-4 py-3 text-sm font-semibold text-black hover:bg-primary-neon/90 disabled:opacity-40"
        )}
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        {semRecebimentoAgora ? "Concluir" : "Confirmar recebimento"}
      </button>
      {semRecebimentoAgora && (
        <p className="text-center text-xs text-at-muted">
          Sem pix/dinheiro o cassino não é marcado como quitado. O valor fica em aberto.
        </p>
      )}

      {erro && <p className="text-sm text-red-400">{erro}</p>}
    </section>
  );
}

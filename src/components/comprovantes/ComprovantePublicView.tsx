"use client";

import { useRef, useState } from "react";
import { Download, Loader2, Share2 } from "lucide-react";
import { captureElementAsPng } from "@/lib/nichos/cassino/capture-relatorio";
import { downloadBlob } from "@/lib/nichos/cassino/relatorio";
import { formatContador } from "@/lib/nichos/cassino";
import {
  resolverOcasiaoComprovante,
  type ComprovanteSnapshot,
} from "@/lib/comprovantes/types";
import { formatCurrency } from "@/lib/utils";

/**
 * Layout único e estável. A ocasião só troca rótulos e quais linhas aparecem:
 * - cobranca: total a cobrar / pago / ainda deve
 * - misto_haver / quitado_haver: haver anterior → abatido → restante
 * - visita_negativa: negativo da visita (sem cobrança)
 * - recupera_negativo: negativo anterior → recuperado → restante
 */
export function ComprovantePublicView({
  snapshot,
}: {
  snapshot: ComprovanteSnapshot;
}) {
  const reportRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false);
  const dataStr = new Date(snapshot.dataIso).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });

  const ocasiao = resolverOcasiaoComprovante(snapshot);
  const visitaNegativa = ocasiao === "visita_negativa";
  const recuperaNegativo = ocasiao === "recupera_negativo";
  const temMaquinas = (snapshot.maquinas?.length ?? 0) > 0;

  const valorOperacional = snapshot.valorOperacional ?? snapshot.subtotal;
  const comissao = snapshot.comissao ?? 0;
  const temOperacional =
    !visitaNegativa &&
    ((snapshot.valorOperacional != null && snapshot.valorOperacional > 0.009) ||
      (snapshot.comissao != null && snapshot.comissao > 0.009));
  const comissaoLabel =
    snapshot.comissaoPercentual != null && snapshot.comissaoPercentual > 0
      ? `Comissão (${snapshot.comissaoPercentual}%)`
      : "Comissão";

  const prejuizo =
    snapshot.prejuizo ??
    Math.abs(
      (snapshot.maquinas ?? []).reduce((s, m) => s + Math.min(0, m.lucro), 0)
    );

  const haverAbatido = snapshot.haverAbatido ?? 0;
  const haverAnterior =
    snapshot.haverAnterior ??
    (haverAbatido > 0.009 || (snapshot.haverRestante ?? 0) > 0.009
      ? haverAbatido + (snapshot.haverRestante ?? 0)
      : 0);
  const haverRestante =
    haverAnterior > 0.009
      ? Math.max(0, Math.round((haverAnterior - haverAbatido) * 100) / 100)
      : snapshot.haverRestante ?? 0;

  const negativoAnterior = snapshot.negativoAnterior ?? 0;
  const negativoRecuperado = snapshot.negativoRecuperado ?? 0;
  const negativoRestante =
    snapshot.negativoRestante ??
    Math.max(0, negativoAnterior - negativoRecuperado);

  const totalBruto =
    snapshot.totalBruto ??
    (haverAbatido > 0.009
      ? snapshot.totalACobrar + haverAbatido
      : snapshot.totalACobrar);
  const totalPagoExibido =
    Math.round((snapshot.valorPago + haverAbatido) * 100) / 100;

  /** Número do card principal — e o rótulo — conforme a história. */
  const hero = (() => {
    if (visitaNegativa) {
      return {
        label: "Negativo da visita",
        valor: prejuizo,
        tom: "negativo" as const,
        hint: "Sem cobrança nesta visita",
      };
    }
    if (recuperaNegativo && negativoAnterior > 0.009) {
      return {
        label: "Negativo anterior",
        valor: negativoAnterior,
        tom: "negativo" as const,
        hint: undefined,
      };
    }
    if (recuperaNegativo && negativoRestante <= 0.009) {
      return {
        label: "Negativo quitado",
        valor: 0,
        tom: "ok" as const,
        hint: undefined,
      };
    }
    return {
      label: "Total",
      valor: totalBruto,
      tom: "total" as const,
      hint: undefined,
    };
  })();

  const labelAindaDeve = recuperaNegativo ? "Negativo restante" : "Ainda deve";
  const valorAindaDeve = recuperaNegativo
    ? negativoRestante
    : snapshot.restante;
  const labelPago = recuperaNegativo ? "Recuperado" : "Total pago";
  const valorPagoBox = recuperaNegativo
    ? Math.max(negativoRecuperado, totalPagoExibido)
    : totalPagoExibido;
  const mostrarCobrancaGrid = !visitaNegativa;
  const mostrarPix =
    !visitaNegativa &&
    !recuperaNegativo &&
    snapshot.restante > 0.009 &&
    Boolean(snapshot.chavePix);

  const temLinhasMeio =
    visitaNegativa ||
    (!visitaNegativa &&
      (temOperacional ||
        (!temOperacional && !recuperaNegativo) ||
        (!recuperaNegativo && snapshot.divida > 0.009) ||
        snapshot.desconto > 0.009 ||
        haverAnterior > 0.009 ||
        haverAbatido > 0.009));

  async function handleSalvarPng() {
    if (!reportRef.current) return;
    setLoading(true);
    try {
      const blob = await captureElementAsPng(reportRef.current);
      downloadBlob(blob, `comprovante-${snapshot.pontoNome.slice(0, 24)}.png`);
    } finally {
      setLoading(false);
    }
  }

  async function handleShare() {
    const text = [
      `${snapshot.previa ? "Prévia" : "Comprovante"} — ${snapshot.pontoNome}`,
      `${hero.label}: ${formatCurrency(hero.valor)}`,
      typeof window !== "undefined" ? window.location.href : null,
    ]
      .filter(Boolean)
      .join("\n");

    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: `Comprovante — ${snapshot.pontoNome}`,
          text,
          url: window.location.href,
        });
        return;
      } catch {
        /* cancelou */
      }
    }
    await handleSalvarPng();
  }

  const tituloTopo = snapshot.previa
    ? "Prévia"
    : visitaNegativa
      ? "Operação negativa"
      : recuperaNegativo
        ? "Recuperação de negativo"
        : "Comprovante";

  return (
    <div className="mx-auto w-full max-w-md space-y-4 px-4 py-8">
      <div
        ref={reportRef}
        className="overflow-hidden rounded-2xl border border-white/10 bg-[#0b1220] text-white shadow-xl"
      >
        <div className="border-b border-white/10 bg-gradient-to-br from-cyan-500/20 to-transparent px-5 py-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-300/90">
            {tituloTopo}
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">
            {snapshot.empresaNome}
          </h1>
          <p className="mt-1 text-sm text-slate-300">{snapshot.pontoNome}</p>
          <p className="mt-0.5 text-xs text-slate-500">{dataStr}</p>
        </div>

        <div className="space-y-4 px-5 py-5 text-sm">
          {!visitaNegativa && snapshot.nichos.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Operação
              </p>
              {snapshot.nichos.map((n) => (
                <div key={n.label} className="flex justify-between text-slate-200">
                  <span>{n.label}</span>
                  <span className="tabular-nums">{formatCurrency(n.valor)}</span>
                </div>
              ))}
            </div>
          )}

          {temMaquinas && (
            <div className="space-y-1.5 border-t border-white/[0.06] pt-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Máquinas
              </p>
              {snapshot.maquinas!.map((m, i) => {
                const temContadores =
                  m.entradaAtual != null || m.saidaAtual != null;
                return (
                  <div key={`${m.nome}-${i}`} className="space-y-0.5">
                    <div className="flex justify-between text-slate-400">
                      <span className="truncate pr-2">{m.nome}</span>
                      <span
                        className={`tabular-nums shrink-0 ${
                          m.lucro < -0.009 ? "text-red-300" : ""
                        }`}
                      >
                        {formatCurrency(m.lucro)}
                      </span>
                    </div>
                    {temContadores && (
                      <p className="text-[11px] text-slate-600">
                        {m.entradaAtual != null && (
                          <span>
                            Entrada{" "}
                            <span className="tabular-nums text-slate-500">
                              {formatContador(m.entradaAtual)}
                            </span>
                          </span>
                        )}
                        {m.entradaAtual != null && m.saidaAtual != null && (
                          <span className="mx-1.5">·</span>
                        )}
                        {m.saidaAtual != null && (
                          <span>
                            Saída{" "}
                            <span className="tabular-nums text-slate-500">
                              {formatContador(m.saidaAtual)}
                            </span>
                          </span>
                        )}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {temLinhasMeio && (
          <div className="space-y-1.5 border-t border-white/[0.06] pt-3">
            {visitaNegativa ? (
              <>
                <div className="flex justify-between text-red-300">
                  <span>Negativo da visita</span>
                  <span className="tabular-nums">{formatCurrency(prejuizo)}</span>
                </div>
                {(snapshot.valorDeixado ?? 0) > 0.009 && (
                  <div className="flex justify-between text-amber-300">
                    <span>Valor deixado (operador)</span>
                    <span className="tabular-nums">
                      {formatCurrency(snapshot.valorDeixado!)}
                    </span>
                  </div>
                )}
                {snapshot.haverGerado > 0.009 && (
                  <div className="flex justify-between text-cyan-300">
                    <span>Haver gerado</span>
                    <span className="tabular-nums">
                      {formatCurrency(snapshot.haverGerado)}
                    </span>
                  </div>
                )}
              </>
            ) : (
              <>
                {temOperacional && (
                  <>
                    <div className="flex justify-between text-slate-300">
                      <span>Valor operacional</span>
                      <span className="tabular-nums">
                        {formatCurrency(valorOperacional)}
                      </span>
                    </div>
                    {comissao > 0.009 && (
                      <div className="flex justify-between text-slate-300">
                        <span>{comissaoLabel}</span>
                        <span className="tabular-nums">
                          {formatCurrency(comissao)}
                        </span>
                      </div>
                    )}
                  </>
                )}

                {!temOperacional && !recuperaNegativo && (
                  <div className="flex justify-between text-slate-300">
                    <span>Subtotal</span>
                    <span className="tabular-nums">
                      {formatCurrency(snapshot.subtotal)}
                    </span>
                  </div>
                )}

                {!recuperaNegativo && snapshot.divida > 0.009 && (
                  <div className="flex justify-between text-amber-300">
                    <span>Dívida anterior</span>
                    <span className="tabular-nums">
                      + {formatCurrency(snapshot.divida)}
                    </span>
                  </div>
                )}
                {snapshot.desconto > 0.009 && (
                  <div className="flex justify-between text-rose-300">
                    <span>Desconto</span>
                    <span className="tabular-nums">
                      − {formatCurrency(snapshot.desconto)}
                    </span>
                  </div>
                )}

                {haverAnterior > 0.009 && (
                  <div className="flex justify-between text-cyan-300">
                    <span>Haver anterior</span>
                    <span className="tabular-nums">
                      {formatCurrency(haverAnterior)}
                    </span>
                  </div>
                )}
                {haverAbatido > 0.009 && (
                  <div className="flex justify-between text-cyan-300">
                    <span>Abatido do haver</span>
                    <span className="tabular-nums">
                      − {formatCurrency(haverAbatido)}
                    </span>
                  </div>
                )}
                {haverAbatido > 0.009 && (
                  <div className="flex justify-between text-slate-400">
                    <span>Haver restante</span>
                    <span className="tabular-nums">
                      {formatCurrency(haverRestante)}
                    </span>
                  </div>
                )}
              </>
            )}
          </div>
          )}

          <div
            className={`rounded-xl border px-4 py-3 ${
              hero.tom === "negativo"
                ? "border-red-500/30 bg-red-500/10"
                : hero.tom === "ok"
                  ? "border-green-500/30 bg-green-500/10"
                  : "border-cyan-500/30 bg-cyan-500/10"
            }`}
          >
            <p
              className={`text-[11px] font-semibold uppercase tracking-wider ${
                hero.tom === "negativo"
                  ? "text-red-300/80"
                  : hero.tom === "ok"
                    ? "text-green-300/80"
                    : "text-cyan-300/80"
              }`}
            >
              {hero.label}
            </p>
            <p
              className={`mt-0.5 text-3xl font-bold tabular-nums ${
                hero.tom === "negativo"
                  ? "text-red-200"
                  : hero.tom === "ok"
                    ? "text-green-200"
                    : "text-cyan-200"
              }`}
            >
              {formatCurrency(hero.valor)}
            </p>
            {hero.hint && (
              <p className="mt-1.5 text-xs text-slate-500">{hero.hint}</p>
            )}
          </div>

          {mostrarCobrancaGrid && (
            <>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg border border-green-500/25 bg-green-500/5 px-3 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-green-400/80">
                    {labelPago}
                  </p>
                  <p className="mt-1 text-xl font-bold tabular-nums text-green-300">
                    {formatCurrency(valorPagoBox)}
                  </p>
                  {!recuperaNegativo &&
                    haverAbatido > 0.009 &&
                    snapshot.valorPago > 0.009 && (
                    <p className="mt-1 text-[10px] text-slate-500">
                      {formatCurrency(snapshot.valorPago)} + haver{" "}
                      {formatCurrency(haverAbatido)}
                    </p>
                  )}
                  {!recuperaNegativo &&
                    haverAbatido > 0.009 &&
                    snapshot.valorPago <= 0.009 && (
                    <p className="mt-1 text-[10px] text-slate-500">via haver</p>
                  )}
                </div>
                <div
                  className={`rounded-lg border px-3 py-3 ${
                    valorAindaDeve > 0.009
                      ? "border-amber-500/25 bg-amber-500/5"
                      : "border-white/[0.06] bg-white/[0.02]"
                  }`}
                >
                  <p
                    className={`text-[10px] font-semibold uppercase tracking-wider ${
                      valorAindaDeve > 0.009
                        ? "text-amber-400/80"
                        : "text-slate-500"
                    }`}
                  >
                    {labelAindaDeve}
                  </p>
                  <p
                    className={`mt-1 text-xl font-bold tabular-nums ${
                      valorAindaDeve > 0.009
                        ? "text-amber-300"
                        : "text-slate-500"
                    }`}
                  >
                    {formatCurrency(valorAindaDeve)}
                  </p>
                </div>
              </div>

              {mostrarPix && (
                <div className="rounded-xl border border-violet-500/30 bg-violet-500/10 px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-violet-300/80">
                    Pix para pagar
                  </p>
                  <p className="mt-1 break-all font-mono text-base text-violet-100">
                    {snapshot.chavePix}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    Valor: {formatCurrency(snapshot.restante)}
                  </p>
                </div>
              )}
            </>
          )}

          {snapshot.notas?.map((n) => (
            <p key={n} className="text-xs text-slate-500">
              {n}
            </p>
          ))}
        </div>

        <div className="border-t border-white/10 px-5 py-3 text-center text-[11px] text-slate-600">
          OperaRout
        </div>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleShare}
          disabled={loading}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-cyan-400 px-4 py-3 text-sm font-semibold text-slate-950 hover:bg-cyan-300 disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Share2 className="h-4 w-4" />
          )}
          Compartilhar
        </button>
        <button
          type="button"
          onClick={handleSalvarPng}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm font-medium text-slate-200 hover:bg-white/10 disabled:opacity-50"
        >
          <Download className="h-4 w-4" />
          Salvar PNG
        </button>
      </div>
    </div>
  );
}

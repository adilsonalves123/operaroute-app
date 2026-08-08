"use client";

import type { ReactNode } from "react";
import { formatDateTime } from "@/lib/utils";
import {
  RELATORIO_COLORS as colors,
  RELATORIO_VALUE_STYLES,
  type RelatorioLinhaComprovante,
} from "@/lib/coletas/relatorio-comprovante-theme";

export function RelatorioBadgePrevia({
  negativa = false,
}: {
  negativa?: boolean;
}) {
  return (
    <div
      style={{
        marginBottom: 16,
        borderRadius: 8,
        backgroundColor: "rgba(245, 158, 11, 0.2)",
        border: "1px solid rgba(245, 158, 11, 0.4)",
        padding: "8px 12px",
        textAlign: "center",
        fontSize: 12,
        fontWeight: 700,
        color: "#fcd34d",
        letterSpacing: 0.5,
      }}
    >
      {negativa ? "PRÉVIA — OPERAÇÃO NEGATIVA" : "PRÉVIA — AGUARDANDO PAGAMENTO"}
    </div>
  );
}

export function RelatorioCabecalho({
  empresaNome,
  pontoNome,
  data,
  subtitulo,
}: {
  empresaNome: string;
  pontoNome: string;
  data: Date;
  /** Linha extra sob o ponto (ex.: Kit). */
  subtitulo?: string | null;
}) {
  return (
    <div
      style={{
        textAlign: "center",
        marginBottom: 16,
        paddingBottom: 12,
        borderBottom: `1px solid ${colors.border}`,
      }}
    >
      <p
        style={{
          margin: 0,
          fontSize: 10,
          textTransform: "uppercase",
          letterSpacing: 2,
          color: colors.cyan,
        }}
      >
        OperaRoute
      </p>
      <h2 style={{ margin: "4px 0 0", fontSize: 18, fontWeight: 700 }}>{empresaNome}</h2>
      <p style={{ margin: 0, fontSize: 14, color: colors.slate400 }}>{pontoNome}</p>
      {subtitulo ? (
        <p style={{ margin: "4px 0 0", fontSize: 12, color: colors.slate500 }}>{subtitulo}</p>
      ) : null}
      <p style={{ margin: "4px 0 0", fontSize: 12, color: colors.slate500 }}>
        {formatDateTime(data)}
      </p>
    </div>
  );
}

export function RelatorioFotoPainel({
  fotoUrl,
  alt,
  label = "Foto do painel",
}: {
  fotoUrl?: string | null;
  alt: string;
  label?: string;
}) {
  if (!fotoUrl || !(fotoUrl.startsWith("blob:") || fotoUrl.startsWith("http"))) {
    return null;
  }
  return (
    <div
      style={{
        marginTop: 12,
        borderRadius: 10,
        overflow: "hidden",
        border: `1px solid ${colors.border}`,
        backgroundColor: colors.bg,
      }}
    >
      <p
        style={{
          margin: 0,
          padding: "8px 10px 0",
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: 0.6,
          textTransform: "uppercase",
          color: colors.slate500,
        }}
      >
        {label}
      </p>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={fotoUrl}
        alt={alt}
        style={{
          display: "block",
          width: "100%",
          height: "auto",
          maxHeight: 420,
          objectFit: "contain",
          objectPosition: "center",
        }}
      />
    </div>
  );
}

export function RelatorioCardSoft({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        borderRadius: 8,
        backgroundColor: colors.cardSoft,
        padding: 12,
        fontSize: 12,
      }}
    >
      {children}
    </div>
  );
}

export function RelatorioResumoFinanceiro({
  linhas,
}: {
  linhas: RelatorioLinhaComprovante[];
}) {
  return (
    <div
      style={{
        borderRadius: 8,
        backgroundColor: colors.card,
        padding: 12,
        display: "flex",
        flexDirection: "column",
        gap: 6,
        fontSize: 12,
      }}
    >
      {linhas.map((linha, i) => (
        <div key={`${linha.label}-${i}`}>
          {linha.dividerBefore && (
            <div style={{ borderTop: `1px solid ${colors.border}`, margin: "6px 0" }} />
          )}
          {linha.secao ? (
            <p
              style={{
                margin: "8px 0 4px",
                fontSize: 10,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: 0.8,
                color: colors.slate500,
              }}
            >
              {linha.label}
            </p>
          ) : (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <span style={{ color: colors.slate400, flexShrink: 0 }}>{linha.label}</span>
                <span
                  style={{
                    textAlign: "right",
                    fontSize: linha.destaque ? 14 : 12,
                    ...RELATORIO_VALUE_STYLES[linha.variant ?? "default"],
                  }}
                >
                  {linha.valor}
                </span>
              </div>
              {linha.hint && (
                <p
                  style={{
                    margin: "2px 0 0",
                    fontSize: 10,
                    color: colors.slate500,
                    textAlign: "right",
                  }}
                >
                  {linha.hint}
                </p>
              )}
            </>
          )}
        </div>
      ))}
    </div>
  );
}

export { RELATORIO_COLORS, RELATORIO_SHELL_STYLE } from "@/lib/coletas/relatorio-comprovante-theme";

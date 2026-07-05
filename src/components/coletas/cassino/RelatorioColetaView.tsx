"use client";

import { forwardRef, type CSSProperties } from "react";
import { formatContador, centesimosToReais } from "@/lib/nichos/cassino";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import {
  buildResumoFinanceiroLinhas,
  type RelatorioColetaData,
  type ResumoFinanceiroVariant,
} from "@/lib/nichos/cassino/relatorio";

interface RelatorioColetaViewProps {
  data: RelatorioColetaData;
}

const colors = {
  bg: "#020617",
  card: "#0f172a",
  cardSoft: "rgba(15, 23, 42, 0.8)",
  border: "#334155",
  text: "#ffffff",
  slate300: "#cbd5e1",
  slate400: "#94a3b8",
  slate500: "#64748b",
  cyan: "#22d3ee",
  green: "#4ade80",
  red: "#f87171",
  amber: "#fbbf24",
  orange: "#fb923c",
};

const valueStyles: Record<ResumoFinanceiroVariant, CSSProperties> = {
  default: { color: colors.text, fontWeight: 500 },
  discount: { color: colors.orange, fontWeight: 500 },
  highlight: { color: colors.cyan, fontWeight: 700 },
  warning: { color: colors.amber, fontWeight: 500 },
  muted: { color: colors.slate300, fontWeight: 500 },
};

export const RelatorioColetaView = forwardRef<HTMLDivElement, RelatorioColetaViewProps>(
  function RelatorioColetaView({ data }, ref) {
    const { calculo: c, previa, empresaNome, pontoNome, comissaoPercentual } = data;
    const resumoLinhas = buildResumoFinanceiroLinhas(
      c,
      comissaoPercentual,
      data.adiantamento,
      { clientFacing: true }
    );

    return (
      <div
        ref={ref}
        style={{
          width: 380,
          backgroundColor: colors.bg,
          color: colors.text,
          padding: 20,
          borderRadius: 12,
          border: `1px solid ${colors.border}`,
          boxShadow: "0 25px 50px rgba(0, 0, 0, 0.45)",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        {previa && (
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
            {c.saldoNegativo
              ? "PRÉVIA — OPERAÇÃO NEGATIVA"
              : "PRÉVIA — AGUARDANDO PAGAMENTO"}
          </div>
        )}

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
          <p style={{ margin: "4px 0 0", fontSize: 12, color: colors.slate500 }}>
            {formatDateTime(data.data)}
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
          {data.maquinas.map((m) => (
            <div
              key={m.nome}
              style={{
                borderRadius: 8,
                backgroundColor: colors.cardSoft,
                padding: 12,
                fontSize: 12,
              }}
            >
              <p style={{ margin: "0 0 8px", fontWeight: 600, color: colors.text }}>{m.nome}</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div>
                    <p style={{ margin: 0, fontSize: 10, color: colors.slate500 }}>Entrada anterior</p>
                    <p style={{ margin: "2px 0 0", color: colors.slate300 }}>
                      {formatContador(m.entradaAnterior)}
                    </p>
                  </div>
                  <div>
                    <p style={{ margin: 0, fontSize: 10, color: colors.slate500 }}>Entrada atual</p>
                    <p style={{ margin: "2px 0 0", color: colors.green, fontWeight: 500 }}>
                      {formatContador(m.entradaAtual)}
                    </p>
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div>
                    <p style={{ margin: 0, fontSize: 10, color: colors.slate500 }}>Saída anterior</p>
                    <p style={{ margin: "2px 0 0", color: colors.slate300 }}>
                      {formatContador(m.saidaAnterior)}
                    </p>
                  </div>
                  <div>
                    <p style={{ margin: 0, fontSize: 10, color: colors.slate500 }}>Saída atual</p>
                    <p style={{ margin: "2px 0 0", color: colors.red, fontWeight: 500 }}>
                      {formatContador(m.saidaAtual)}
                    </p>
                  </div>
                </div>
              </div>
              <div
                style={{
                  marginTop: 10,
                  paddingTop: 8,
                  borderTop: `1px solid ${colors.border}`,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <span style={{ color: colors.slate400 }}>Operação</span>
                <span
                  style={{
                    fontWeight: 700,
                    color: m.lucroCentavos >= 0 ? colors.cyan : colors.red,
                  }}
                >
                  {formatCurrency(centesimosToReais(m.lucroCentavos))}
                </span>
              </div>
              {m.fotoUrl &&
                (m.fotoUrl.startsWith("blob:") || m.fotoUrl.startsWith("http")) && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={m.fotoUrl}
                    alt={`Foto ${m.nome}`}
                    style={{
                      marginTop: 8,
                      width: "100%",
                      height: 96,
                      objectFit: "cover",
                      borderRadius: 6,
                      border: `1px solid ${colors.border}`,
                    }}
                  />
                )}
            </div>
          ))}
        </div>

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
          {resumoLinhas.map((linha, i) => (
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
                        ...valueStyles[linha.variant ?? "default"],
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
      </div>
    );
  }
);

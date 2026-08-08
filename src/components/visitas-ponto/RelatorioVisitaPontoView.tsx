"use client";

import { forwardRef } from "react";
import { formatCurrency } from "@/lib/utils";
import {
  totaisComprovanteVisita,
  valorNichoComprovante,
} from "@/lib/visitas-ponto/comprovante-totais";
import type { VisitaPontoResumo } from "@/lib/visitas-ponto/types";

const colors = {
  bg: "#020617",
  card: "#0f172a",
  border: "#334155",
  text: "#ffffff",
  slate300: "#cbd5e1",
  slate400: "#94a3b8",
  slate500: "#64748b",
  cyan: "#22d3ee",
  green: "#4ade80",
  amber: "#fbbf24",
  orange: "#fb923c",
  red: "#f87171",
};

type Props = {
  resumo: VisitaPontoResumo;
  dividaSaldo?: number;
  desconto?: number;
  pix?: number;
  dinheiro?: number;
  previa?: boolean;
  haverSaldo?: number;
  descontarHaver?: boolean;
  /** Comprovante ampliado (modal) */
  expanded?: boolean;
};

export const RelatorioVisitaPontoView = forwardRef<HTMLDivElement, Props>(
  function RelatorioVisitaPontoView(
    {
      resumo,
      dividaSaldo = 0,
      desconto = 0,
      pix = 0,
      dinheiro = 0,
      previa = false,
      haverSaldo = 0,
      descontarHaver = false,
      expanded = false,
    },
    ref
  ) {
    const totais = totaisComprovanteVisita(resumo, {
      dividaSaldo,
      desconto,
      pix,
      dinheiro,
      haverSaldo,
      descontarHaver,
    });

    const dataStr = new Date(
      resumo.finalizadaEm ?? resumo.createdAt
    ).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    return (
      <div
        ref={ref}
        style={{
          width: expanded ? "min(100%, 560px)" : 380,
          maxWidth: "100%",
          boxSizing: "border-box",
          backgroundColor: colors.bg,
          color: colors.text,
          padding: expanded ? 28 : 20,
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
            PRÉVIA — VISITA AO PONTO
          </div>
        )}

        <div style={{ marginBottom: 16 }}>
          <p
            style={{
              margin: 0,
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: 1.2,
              textTransform: "uppercase",
              color: colors.slate500,
            }}
          >
            Visita ao ponto
          </p>
          <h2 style={{ margin: "4px 0 0", fontSize: 20, fontWeight: 700 }}>{resumo.pontoNome}</h2>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: colors.slate400 }}>{dataStr}</p>
        </div>

        {resumo.nichos.length > 0 && (
          <div
            style={{
              marginBottom: 14,
              borderRadius: 10,
              backgroundColor: colors.card,
              border: `1px solid ${colors.border}`,
              padding: 12,
            }}
          >
            <p
              style={{
                margin: "0 0 8px",
                fontSize: 11,
                fontWeight: 600,
                color: colors.slate500,
                textTransform: "uppercase",
                letterSpacing: 0.8,
              }}
            >
              Coletas
            </p>
            {resumo.nichos.map((n) => (
              <div
                key={n.nicho}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: 6,
                  fontSize: 13,
                }}
              >
                <span style={{ color: colors.slate300 }}>{n.label}</span>
                <span style={{ fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                  {formatCurrency(valorNichoComprovante(n))}
                </span>
              </div>
            ))}
          </div>
        )}

        <div
          style={{
            borderRadius: 10,
            backgroundColor: colors.card,
            border: `1px solid ${colors.border}`,
            padding: 12,
            fontSize: 13,
          }}
        >
          {totais.dividaSaldo > 0.009 && (
            <Row
              label="Dívida anterior"
              value={formatCurrency(totais.dividaSaldo)}
              valueColor={colors.amber}
            />
          )}
          <Row label="Subtotal visita" value={formatCurrency(totais.subtotal)} />
          {totais.desconto > 0.009 && (
            <Row
              label="Desconto"
              value={`− ${formatCurrency(totais.desconto)}`}
              valueColor={colors.orange}
            />
          )}
          {totais.haverAbatido > 0.009 && (
            <Row
              label="Haver descontado"
              value={`− ${formatCurrency(totais.haverAbatido)}`}
              valueColor={colors.cyan}
            />
          )}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginTop: 8,
              paddingTop: 8,
              borderTop: `1px solid ${colors.border}`,
            }}
          >
            <span style={{ fontWeight: 700 }}>Total a cobrar</span>
            <span
              style={{
                fontWeight: 800,
                color: colors.cyan,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {formatCurrency(totais.totalACobrar)}
            </span>
          </div>
          {totais.valorPago > 0.009 && (
            <Row
              label="Pago hoje"
              value={formatCurrency(totais.valorPago)}
              valueColor={colors.green}
            />
          )}
          {totais.restante > 0.009 && (
            <Row
              label="Ainda deve"
              value={formatCurrency(totais.restante)}
              valueColor={colors.amber}
            />
          )}
          {totais.haverGerado > 0.009 && (
            <Row
              label="Haver gerado"
              value={`+ ${formatCurrency(totais.haverGerado)}`}
              valueColor={colors.cyan}
            />
          )}
          {totais.valorPago > 0.009 && totais.restante <= 0.009 && !previa && (
            <p
              style={{
                margin: "10px 0 0",
                fontSize: 12,
                fontWeight: 600,
                color: colors.green,
              }}
            >
              ✓ Quitado
            </p>
          )}
        </div>

        {resumo.cassinoNegativo && (
          <div
            style={{
              marginTop: 12,
              borderRadius: 10,
              backgroundColor: "rgba(248, 113, 113, 0.08)",
              border: "1px solid rgba(248, 113, 113, 0.25)",
              padding: 12,
              fontSize: 12,
            }}
          >
            <p style={{ margin: 0, fontWeight: 600, color: colors.red }}>
              Cassino negativo (fora da cobrança)
            </p>
            <p style={{ margin: "4px 0 0", color: colors.slate400 }}>
              Operação {formatCurrency(resumo.cassinoNegativo.valorOperacao)}
            </p>
          </div>
        )}
      </div>
    );
  }
);

function Row({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        marginBottom: 4,
        gap: 12,
      }}
    >
      <span style={{ color: colors.slate400 }}>{label}</span>
      <span
        style={{
          fontWeight: 600,
          fontVariantNumeric: "tabular-nums",
          color: valueColor ?? colors.text,
        }}
      >
        {value}
      </span>
    </div>
  );
}

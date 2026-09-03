"use client";

import { Instrument_Serif, Outfit } from "next/font/google";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

const display = Instrument_Serif({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-config-display",
});

const sans = Outfit({
  subsets: ["latin"],
  variable: "--font-config-sans",
});

export const champagneLink =
  "text-at-link transition underline-offset-2 hover:underline hover:opacity-90";

export const champagneBtn =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-at bg-at-card-soft px-4 py-2.5 text-[13px] font-medium text-at-link transition hover:border-[var(--at-tab-active-border)] hover:bg-at-tab-active/10 disabled:opacity-50";

export const champagneBtnSolid =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-at-tab-active px-5 py-2.5 text-[13px] font-semibold text-[var(--at-tab-active-text)] transition hover:brightness-110 disabled:opacity-50";

export function ConfigShell({ children }: { children: ReactNode }) {
  return (
    <div
      className={cn(
        display.variable,
        sans.variable,
        "font-[family-name:var(--font-config-sans)]"
      )}
    >
      <div className="relative mx-auto max-w-4xl pt-6 sm:pt-10">{children}</div>
    </div>
  );
}

export function ConfigHero({
  nomeOperacao,
  subtitle,
  statusLabel,
  statusTone = "neutral",
}: {
  nomeOperacao: string;
  subtitle: string;
  statusLabel: string;
  statusTone?: "active" | "trial" | "expired" | "neutral";
}) {
  const toneClass = {
    active: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200",
    trial: "border-[var(--at-tab-active-border)] bg-at-tab-active/15 text-at-link",
    expired: "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-200",
    neutral: "border-at bg-at-card-soft text-at-muted",
  }[statusTone];

  return (
    <header className="mb-8 pt-2 sm:pt-0">
      <p className="text-[10px] font-medium uppercase tracking-[0.28em] text-at-link">
        Centro de controle
      </p>
      <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1
            className="text-[clamp(2rem,4vw,2.75rem)] leading-[1.05] tracking-tight text-at-primary"
            style={{ fontFamily: "var(--font-config-display), Georgia, serif" }}
          >
            Configurações
          </h1>
          <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-at-muted">
            {subtitle}
          </p>
          {nomeOperacao && (
            <p
              className="mt-3 truncate text-lg text-at-link"
              style={{ fontFamily: "var(--font-config-display), Georgia, serif" }}
            >
              {nomeOperacao}
            </p>
          )}
        </div>
        <span
          className={cn(
            "shrink-0 self-start rounded-full border px-3.5 py-1.5 text-[11px] font-medium uppercase tracking-[0.12em] sm:self-auto",
            toneClass
          )}
        >
          {statusLabel}
        </span>
      </div>
    </header>
  );
}

export function ConfigStatsStrip({
  items,
}: {
  items: { label: string; value: string; hint?: string }[];
}) {
  return (
    <div className="mb-8 grid grid-cols-2 gap-px overflow-hidden rounded-sm border border-at bg-at-grid sm:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="bg-at-card px-4 py-4">
          <p className="text-[10px] uppercase tracking-[0.16em] text-at-muted">
            {item.label}
          </p>
          <p
            className="mt-1.5 text-[22px] tabular-nums text-at-primary"
            style={{ fontFamily: "var(--font-config-display), Georgia, serif" }}
          >
            {item.value}
          </p>
          {item.hint && <p className="mt-0.5 text-[11px] text-at-soft">{item.hint}</p>}
        </div>
      ))}
    </div>
  );
}

export function ConfigSectionNav({
  items,
}: {
  items: { id: string; label: string }[];
}) {
  return (
    <nav
      className="mb-8 flex flex-wrap gap-2 rounded-xl border border-at bg-at-card-soft p-1.5"
      aria-label="Seções"
    >
      {items.map((item) => (
        <a
          key={item.id}
          href={`#${item.id}`}
          className="analise-tab-idle rounded-lg px-3 py-2 text-[12px] font-medium transition"
        >
          {item.label}
        </a>
      ))}
    </nav>
  );
}

export function ConfigSection({
  id,
  title,
  description,
  icon: Icon,
  action,
  children,
  variant = "default",
}: {
  id: string;
  title: string;
  description?: string;
  icon?: LucideIcon;
  action?: ReactNode;
  children: ReactNode;
  variant?: "default" | "danger";
}) {
  return (
    <section id={id} className="mb-8 scroll-mt-6 last:mb-0">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {Icon && (
              <span
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-lg border",
                  variant === "danger"
                    ? "border-rose-500/25 bg-rose-500/10 text-rose-600 dark:text-rose-300"
                    : "border-at bg-at-card-soft text-at-link"
                )}
              >
                <Icon className="h-4 w-4" />
              </span>
            )}
            <h2
              className="text-[18px] text-at-primary"
              style={{ fontFamily: "var(--font-config-display), Georgia, serif" }}
            >
              {title}
            </h2>
          </div>
          {description && (
            <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed text-at-muted">
              {description}
            </p>
          )}
        </div>
        {action}
      </div>
      <div
        className={cn(
          "overflow-hidden rounded-xl border",
          variant === "danger"
            ? "border-rose-500/20 bg-rose-500/[0.04]"
            : "border-at bg-at-card"
        )}
      >
        {children}
      </div>
    </section>
  );
}

export function ConfigPanelBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("p-5 sm:p-6", className)}>{children}</div>;
}

export function ConfigDataGrid({ children }: { children: ReactNode }) {
  return <div className="divide-y divide-[var(--at-border-soft)] text-[13px]">{children}</div>;
}

export function ConfigDataRow({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-6 px-0 py-3.5 first:pt-0 last:pb-0">
      <span className="shrink-0 text-at-muted">{label}</span>
      <span
        className={cn(
          "text-right leading-snug",
          highlight ? "font-medium text-at-link" : "text-at-primary"
        )}
      >
        {value}
      </span>
    </div>
  );
}

export function ConfigNichoPills({ labels }: { labels: string[] }) {
  if (!labels.length) return <span className="text-at-muted">—</span>;
  return (
    <div className="flex flex-wrap justify-end gap-1.5">
      {labels.map((l) => (
        <span
          key={l}
          className="rounded-md border border-at bg-at-card-soft px-2 py-0.5 text-[11px] text-at-link"
        >
          {l}
        </span>
      ))}
    </div>
  );
}

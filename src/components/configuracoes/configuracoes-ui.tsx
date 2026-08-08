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
  "text-[#c4a574] hover:text-[#e8d5b0] transition underline-offset-2 hover:underline";

export const champagneBtn =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-[#c4a574]/35 bg-[#c4a574]/10 px-4 py-2.5 text-[13px] font-medium text-[#e8d5b0] transition hover:border-[#c4a574]/55 hover:bg-[#c4a574]/15 disabled:opacity-50";

export const champagneBtnSolid =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-[#c4a574] px-5 py-2.5 text-[13px] font-semibold text-[#0a0e16] transition hover:brightness-110 disabled:opacity-50";

export function ConfigShell({ children }: { children: ReactNode }) {
  return (
    <div
      className={cn(
        display.variable,
        sans.variable,
        "relative -mx-4 -mt-2 min-h-[70vh] px-4 pb-16 sm:-mx-0 sm:px-0",
        "font-[family-name:var(--font-config-sans)]"
      )}
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[420px] opacity-90"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 20% -10%, rgba(196,165,116,0.14), transparent 55%), radial-gradient(ellipse 50% 40% at 90% 0%, rgba(0,212,255,0.06), transparent 50%)",
        }}
      />
      <div className="relative mx-auto max-w-4xl">{children}</div>
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
    active: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
    trial: "border-[#c4a574]/35 bg-[#c4a574]/10 text-[#e8d5b0]",
    expired: "border-rose-500/30 bg-rose-500/10 text-rose-200",
    neutral: "border-white/10 bg-white/[0.04] text-slate-300",
  }[statusTone];

  return (
    <header className="mb-8 pt-2 sm:pt-0">
      <p className="text-[10px] font-medium uppercase tracking-[0.28em] text-[#c4a574]/80">
        Centro de controle
      </p>
      <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1
            className="text-[clamp(2rem,4vw,2.75rem)] leading-[1.05] tracking-tight text-[#f4efe6]"
            style={{ fontFamily: "var(--font-config-display), Georgia, serif" }}
          >
            Configurações
          </h1>
          <p
            className="mt-2 text-[15px] text-slate-400 max-w-xl leading-relaxed"
            style={{ fontFamily: "var(--font-config-sans)" }}
          >
            {subtitle}
          </p>
          {nomeOperacao && (
            <p
              className="mt-3 text-lg text-[#e8d5b0]/90 truncate"
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
    <div className="mb-8 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-white/[0.07] bg-white/[0.07] sm:grid-cols-4">
      {items.map((item) => (
        <div
          key={item.label}
          className="bg-[#0a0e16]/90 px-4 py-4 backdrop-blur-sm"
        >
          <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
            {item.label}
          </p>
          <p
            className="mt-1.5 text-[22px] tabular-nums text-[#f4efe6]"
            style={{ fontFamily: "var(--font-config-display), Georgia, serif" }}
          >
            {item.value}
          </p>
          {item.hint && (
            <p className="mt-0.5 text-[11px] text-slate-600">{item.hint}</p>
          )}
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
      className="mb-8 flex flex-wrap gap-1.5 rounded-xl border border-white/[0.06] bg-[#0a0e16]/60 p-1.5 backdrop-blur-md"
      aria-label="Seções"
    >
      {items.map((item) => (
        <a
          key={item.id}
          href={`#${item.id}`}
          className="rounded-lg px-3 py-2 text-[12px] font-medium text-slate-400 transition hover:bg-white/[0.05] hover:text-[#e8d5b0]"
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
    <section
      id={id}
      className="scroll-mt-6 mb-8 last:mb-0"
    >
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {Icon && (
              <span
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-lg border",
                  variant === "danger"
                    ? "border-rose-500/25 bg-rose-500/10 text-rose-300"
                    : "border-[#c4a574]/25 bg-[#c4a574]/8 text-[#c4a574]"
                )}
              >
                <Icon className="h-4 w-4" />
              </span>
            )}
            <h2
              className="text-[18px] text-[#f4efe6]"
              style={{ fontFamily: "var(--font-config-display), Georgia, serif" }}
            >
              {title}
            </h2>
          </div>
          {description && (
            <p className="mt-1.5 text-[13px] leading-relaxed text-slate-500 max-w-2xl">
              {description}
            </p>
          )}
        </div>
        {action}
      </div>
      <div
        className={cn(
          "overflow-hidden rounded-xl border backdrop-blur-sm",
          variant === "danger"
            ? "border-rose-500/20 bg-gradient-to-b from-rose-500/[0.06] to-transparent"
            : "border-white/[0.07] bg-gradient-to-b from-white/[0.04] to-transparent"
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
  return (
    <div className="divide-y divide-white/[0.06] text-[13px]">{children}</div>
  );
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
    <div className="flex items-start justify-between gap-6 py-3.5 first:pt-0 last:pb-0 px-0">
      <span className="text-slate-500 shrink-0">{label}</span>
      <span
        className={cn(
          "text-right leading-snug",
          highlight ? "text-[#e8d5b0] font-medium" : "text-[#f4efe6]"
        )}
      >
        {value}
      </span>
    </div>
  );
}

export function ConfigNichoPills({ labels }: { labels: string[] }) {
  if (!labels.length) return <span className="text-slate-500">—</span>;
  return (
    <div className="flex flex-wrap justify-end gap-1.5">
      {labels.map((l) => (
        <span
          key={l}
          className="rounded-md border border-[#c4a574]/20 bg-[#c4a574]/8 px-2 py-0.5 text-[11px] text-[#e8d5b0]"
        >
          {l}
        </span>
      ))}
    </div>
  );
}

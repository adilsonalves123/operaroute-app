import type { ReactNode } from "react";

type Props = {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  action?: ReactNode;
};

/** Cabeçalho padrão das páginas premium (server-safe). */
export function PremiumPageHeader({
  eyebrow = "OperaRoute",
  title,
  subtitle,
  action,
}: Props) {
  return (
    <header className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <p
          className="text-[11px] font-medium uppercase tracking-[0.28em] text-at-link/90"
          style={{ letterSpacing: "0.28em" }}
        >
          {eyebrow}
        </p>
        <h1
          className="mt-3 text-[clamp(2rem,4.5vw,3.25rem)] leading-[0.95] tracking-tight text-at-primary"
          style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
        >
          {title}
        </h1>
        {subtitle ? (
          <p className="mt-3 max-w-lg text-[13px] text-at-muted">{subtitle}</p>
        ) : null}
      </div>
      {action ? <div className="flex shrink-0 flex-wrap gap-2">{action}</div> : null}
    </header>
  );
}

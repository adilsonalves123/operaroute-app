import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Instrument_Serif, Outfit } from "next/font/google";
import { cn } from "@/lib/utils";

const display = Instrument_Serif({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-coleta-display",
});

const sans = Outfit({
  subsets: ["latin"],
  variable: "--font-coleta-sans",
});

export function ColetaNovaPageShell({
  title,
  subtitle,
  children,
  className,
  backHref = "/coletas",
  topSlot,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  className?: string;
  backHref?: string;
  topSlot?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        display.variable,
        sans.variable,
        "mx-auto max-w-6xl space-y-5 pb-8",
        className
      )}
      style={{ fontFamily: "var(--font-coleta-sans), system-ui, sans-serif" }}
    >
      {topSlot}
      <div className="flex items-start gap-3 sm:items-center sm:gap-4">
        <Link
          href={backHref}
          className="mt-0.5 rounded-xl border border-at bg-[#0c1018]/80 p-2 text-at-muted transition hover:border-[#c4a574]/25 hover:text-at-primary"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="min-w-0">
          <h1
            className="text-2xl tracking-tight text-at-primary sm:text-[1.75rem]"
            style={{ fontFamily: "var(--font-coleta-display), Georgia, serif" }}
          >
            {title}
          </h1>
          <p className="mt-0.5 text-sm leading-snug text-at-muted">{subtitle}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

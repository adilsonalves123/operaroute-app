import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Instrument_Serif, Outfit } from "next/font/google";
import { cn } from "@/lib/utils";

const display = Instrument_Serif({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-ponto-display",
});

const sans = Outfit({
  subsets: ["latin"],
  variable: "--font-ponto-sans",
});

export function PontoFormPageShell({
  title,
  subtitle,
  backHref = "/pontos",
  children,
  className,
}: {
  title: string;
  subtitle: string;
  backHref?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        display.variable,
        sans.variable,
        "mx-auto max-w-2xl space-y-6 pb-8",
        className
      )}
      style={{ fontFamily: "var(--font-ponto-sans), system-ui, sans-serif" }}
    >
      <div className="flex items-start gap-3 sm:items-center sm:gap-4">
        <Link
          href={backHref}
          className="mt-0.5 rounded-xl border border-at bg-[#0c1018]/80 p-2 text-at-muted transition hover:border-[#c4a574]/25 hover:text-at-primary"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="min-w-0">
          <h1
            className="text-2xl tracking-tight text-at-primary"
            style={{ fontFamily: "var(--font-ponto-display), Georgia, serif" }}
          >
            {title}
          </h1>
          <p className="mt-0.5 text-sm text-at-muted">{subtitle}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Instrument_Serif, Outfit } from "next/font/google";
import {
  Building2,
  LayoutDashboard,
  LifeBuoy,
  ArrowLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";

const display = Instrument_Serif({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-plat-display",
});

const sans = Outfit({
  subsets: ["latin"],
  variable: "--font-plat-sans",
});

const NAV = [
  { href: "/plataforma", label: "Visão geral", icon: LayoutDashboard, exact: true },
  { href: "/plataforma/empresas", label: "Clientes", icon: Building2 },
  { href: "/suporte/inbox", label: "Suporte", icon: LifeBuoy },
];

export function PlataformaShell({
  children,
  title,
  subtitle,
}: {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
}) {
  const pathname = usePathname();

  return (
    <div
      className={cn(
        display.variable,
        sans.variable,
        "relative -mx-4 -mt-2 min-h-[calc(100dvh-5.5rem)] overflow-hidden px-4 pb-16 sm:-mx-6 sm:px-6"
      )}
      style={{ fontFamily: "var(--font-plat-sans), system-ui, sans-serif" }}
    >
      <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden>
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 70% 40% at 80% -5%, rgba(196,165,116,0.12), transparent 50%), radial-gradient(ellipse 35% 25% at 0% 70%, rgba(80,60,40,0.1), transparent 45%), linear-gradient(180deg, #05070c 0%, #0a0e16 55%, #07090f 100%)",
          }}
        />
      </div>

      <div className="mx-auto max-w-6xl pt-6 sm:pt-10">
        <div className="flex flex-wrap items-center gap-3 text-[12px]">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-slate-500 transition hover:text-[#c4a574]"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Voltar ao app
          </Link>
          <span className="text-slate-700">·</span>
          <p
            className="text-[11px] font-medium uppercase text-[#c4a574]/90"
            style={{ letterSpacing: "0.28em" }}
          >
            OperaRoute · Plataforma
          </p>
        </div>

        <header className="mt-5 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1
              className="text-[clamp(2rem,4.5vw,3.1rem)] leading-[0.95] tracking-tight text-[#f4efe6]"
              style={{ fontFamily: "var(--font-plat-display), Georgia, serif" }}
            >
              {title}
            </h1>
            {subtitle && (
              <p className="mt-3 max-w-xl text-[13px] text-slate-400">{subtitle}</p>
            )}
          </div>
          <nav className="flex flex-wrap gap-1.5">
            {NAV.map((item) => {
              const active = item.exact
                ? pathname === item.href
                : pathname === item.href || pathname.startsWith(item.href + "/");
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-sm border px-3.5 py-2 text-[12px] transition",
                    active
                      ? "border-[#c4a574]/40 bg-[#c4a574]/12 text-[#e8d5b0]"
                      : "border-white/[0.08] text-slate-400 hover:border-white/20 hover:text-[#f4efe6]"
                  )}
                >
                  <Icon className="h-3.5 w-3.5 opacity-80" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </header>

        <div className="mt-6 h-px w-full bg-gradient-to-r from-[#c4a574]/45 via-white/10 to-transparent" />

        <div className="mt-8">{children}</div>
      </div>
    </div>
  );
}

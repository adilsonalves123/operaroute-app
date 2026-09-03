"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Instrument_Serif, Outfit } from "next/font/google";
import {
  Bell,
  Building2,
  CreditCard,
  FileBarChart,
  Handshake,
  Home,
  ImageIcon,
  GraduationCap,
  Layers,
  LifeBuoy,
  LogOut,
  Menu,
  Moon,
  Package,
  Search,
  Settings,
  Sparkles,
  Sun,
  UserRound,
  Wallet,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { useDonoTheme } from "@/components/dono/DonoTheme";

const display = Instrument_Serif({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-dono-display",
});

const sans = Outfit({
  subsets: ["latin"],
  variable: "--font-dono-sans",
});

const NAV_MAIN = [
  { href: "/dono", label: "Dashboard", icon: Home, exact: true },
  { href: "/dono/empresas", label: "Clientes", icon: Building2 },
  { href: "/dono/assinaturas", label: "Assinaturas", icon: CreditCard },
  { href: "/dono/planos", label: "Planos", icon: Package },
  { href: "/dono/receita", label: "Financeiro", icon: Wallet },
  { href: "/dono/afiliados", label: "Afiliados", icon: Handshake },
  { href: "/dono/ia", label: "IA Copiloto", icon: Sparkles },
  { href: "/dono/nichos", label: "Fotos nichos", icon: ImageIcon },
  { href: "/dono/universidade", label: "Universidade", icon: GraduationCap },
  { href: "/dono/relatorios", label: "Relatórios", icon: FileBarChart },
  { href: "/dono/suporte", label: "Suporte", icon: LifeBuoy, badgeKey: "suporte" as const },
];

const NAV_BOTTOM = [
  { href: "/dono/configuracoes", label: "Configurações", icon: Settings },
  { href: "/dono/conta", label: "Minha conta", icon: UserRound },
];

function firstNameFromEmail(email?: string) {
  const fromEnv = process.env.NEXT_PUBLIC_DONO_NOME?.trim();
  if (fromEnv) return fromEnv;
  if (!email) return "Dono";
  const local = email.split("@")[0] ?? "Dono";
  const part = local.split(/[._-]/)[0] ?? local;
  return part.charAt(0).toUpperCase() + part.slice(1);
}

function DonoShellInner({
  children,
  title,
  subtitle,
  email,
  badgeSuporte,
  hideTitle,
}: {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
  email?: string;
  badgeSuporte?: number;
  hideTitle?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, toggle } = useDonoTheme();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [q, setQ] = useState("");
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifs, setNotifs] = useState<
    { id: string; titulo: string; detalhe: string; href?: string }[]
  >([]);

  const light = theme === "light";
  const nome = useMemo(() => firstNameFromEmail(email), [email]);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/dono/command");
        if (!res.ok) return;
        const data = await res.json();
        setNotifs(
          (data.alertas ?? []).slice(0, 6).map(
            (a: { id: string; titulo: string; detalhe: string; href?: string }) => ({
              id: a.id,
              titulo: a.titulo,
              detalhe: a.detalhe,
              href: a.href,
            })
          )
        );
      } catch {
        // ignore
      }
    })();
  }, []);

  async function sair() {
    await fetch("/api/dono/login", { method: "DELETE" });
    router.push("/dono/login");
    router.refresh();
  }

  function buscar(e: React.FormEvent) {
    e.preventDefault();
    const term = q.trim();
    if (!term) {
      router.push("/dono/empresas");
      return;
    }
    router.push(`/dono/empresas?q=${encodeURIComponent(term)}`);
  }

  const shellBg = light
    ? "bg-[#f4f1eb] text-slate-900"
    : "bg-[#07090f] text-at-primary";
  const asideBg = light
    ? "border-stone-200/80 bg-white/80"
    : "border-at bg-at-card/90";
  const topBg = light
    ? "border-stone-200/80 bg-white/70"
    : "border-at bg-at-card/70";
  const muted = light ? "text-at-muted" : "text-at-muted";
  const navIdle = light
    ? "text-at-soft hover:bg-stone-100 hover:text-slate-900"
    : "text-at-muted hover:bg-at-card-soft hover:text-at-primary";
  const navActive = light
    ? "bg-stone-900 text-white"
    : "bg-[#c4a574]/15 text-at-link";

  function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
    return (
      <>
        <div className="space-y-0.5">
          {NAV_MAIN.map((item) => {
            const active = item.exact
              ? pathname === item.href
              : pathname === item.href || pathname.startsWith(item.href + "/");
            const Icon = item.icon;
            const badge =
              item.badgeKey === "suporte" && badgeSuporte && badgeSuporte > 0
                ? badgeSuporte
                : null;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] transition",
                  active ? navActive : navIdle
                )}
              >
                <Icon className="h-4 w-4 shrink-0 opacity-80" />
                <span className="flex-1 truncate">{item.label}</span>
                {badge != null && (
                  <span
                    className={cn(
                      "rounded-md px-1.5 py-0.5 text-[10px] tabular-nums",
                      light
                        ? "bg-rose-100 text-rose-700"
                        : "bg-rose-500/20 text-rose-200"
                    )}
                  >
                    {badge}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
        <div className="mt-6 space-y-0.5 border-t border-inherit pt-4">
          {NAV_BOTTOM.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(item.href + "/");
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] transition",
                  active ? navActive : navIdle
                )}
              >
                <Icon className="h-4 w-4 shrink-0 opacity-80" />
                {item.label}
              </Link>
            );
          })}
        </div>
      </>
    );
  }

  return (
    <div
      className={cn(
        display.variable,
        sans.variable,
        "min-h-dvh transition-colors",
        shellBg
      )}
      style={{ fontFamily: "var(--font-dono-sans), system-ui, sans-serif" }}
      data-dono-theme={theme}
    >
      {!light && (
        <div className="pointer-events-none fixed inset-0 -z-10" aria-hidden>
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse 50% 30% at 10% 0%, rgba(196,165,116,0.1), transparent 50%), linear-gradient(180deg, #05070c 0%, #0a0e16 100%)",
            }}
          />
        </div>
      )}

      <div className="flex min-h-dvh">
        <aside
          className={cn(
            "hidden w-[240px] shrink-0 flex-col border-r backdrop-blur-md lg:flex",
            asideBg
          )}
        >
          <div className="flex items-center gap-2.5 px-4 py-5">
            <div
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-lg",
                light ? "bg-stone-900 text-white" : "bg-[#c4a574]/20 text-at-link"
              )}
            >
              <Layers className="h-4 w-4" />
            </div>
            <div>
              <p
                className={cn(
                  "text-[15px] leading-none",
                  light ? "text-slate-900" : "text-at-primary"
                )}
                style={{ fontFamily: "var(--font-dono-display), Georgia, serif" }}
              >
                OperaRoute
              </p>
              <p className={cn("mt-1 text-[11px]", muted)}>Painel da plataforma</p>
            </div>
          </div>
          <nav className="flex-1 overflow-y-auto px-3 pb-4">
            <NavLinks />
          </nav>
          <div
            className={cn(
              "border-t px-4 py-4",
              light ? "border-stone-200" : "border-at"
            )}
          >
            <p className={cn("truncate text-[12px]", muted)}>{email}</p>
            <button
              type="button"
              onClick={() => void sair()}
              className={cn(
                "mt-2 inline-flex items-center gap-1.5 text-[12px] transition",
                light ? "text-at-muted hover:text-slate-900" : "text-at-muted hover:text-at-link"
              )}
            >
              <LogOut className="h-3.5 w-3.5" />
              Sair
            </button>
          </div>
        </aside>

        {mobileOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <button
              type="button"
              className="absolute inset-0 bg-black/50"
              onClick={() => setMobileOpen(false)}
              aria-label="Fechar menu"
            />
            <aside
              className={cn(
                "absolute left-0 top-0 flex h-full w-[260px] flex-col border-r",
                light ? "bg-white" : "bg-at-card"
              )}
            >
              <div className="flex items-center justify-between px-4 py-4">
                <p
                  className="text-[18px]"
                  style={{ fontFamily: "var(--font-dono-display), Georgia, serif" }}
                >
                  OperaRoute
                </p>
                <button type="button" onClick={() => setMobileOpen(false)}>
                  <X className="h-5 w-5" />
                </button>
              </div>
              <nav className="flex-1 overflow-y-auto px-3">
                <NavLinks onNavigate={() => setMobileOpen(false)} />
              </nav>
            </aside>
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          <header
            className={cn(
              "sticky top-0 z-30 flex h-14 items-center gap-3 border-b px-3 backdrop-blur-md sm:px-5",
              topBg
            )}
          >
            <button
              type="button"
              className="rounded-lg p-2 lg:hidden"
              onClick={() => setMobileOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </button>

            <form onSubmit={buscar} className="relative hidden max-w-md flex-1 sm:block">
              <Search
                className={cn(
                  "pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2",
                  muted
                )}
                aria-hidden
              />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Pesquisar clientes…"
                className={cn(
                  "w-full rounded-lg border py-2 !pl-10 pr-3 text-[13px] outline-none",
                  light
                    ? "border-stone-200 bg-stone-50 text-slate-900 placeholder:text-at-muted focus:border-stone-400"
                    : "border-at-soft bg-at-card-soft text-at-primary placeholder:text-at-soft focus:border-[#c4a574]/40"
                )}
              />
            </form>

            <div className="ml-auto flex items-center gap-1.5">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setNotifOpen((v) => !v)}
                  className={cn(
                    "relative rounded-lg p-2 transition",
                    light ? "hover:bg-stone-100" : "hover:bg-white/[0.05]"
                  )}
                  title="Notificações"
                >
                  <Bell className="h-4 w-4" />
                  {notifs.length > 0 && (
                    <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-rose-400" />
                  )}
                </button>
                {notifOpen && (
                  <div
                    className={cn(
                      "absolute right-0 mt-2 w-80 overflow-hidden rounded-xl border shadow-xl",
                      light
                        ? "border-stone-200 bg-white"
                        : "border-at-soft bg-[#0d121c]"
                    )}
                  >
                    <p
                      className={cn(
                        "border-b px-3 py-2 text-[11px] uppercase tracking-wider",
                        light ? "border-stone-100 text-at-muted" : "border-white/5 text-at-muted"
                      )}
                    >
                      Notificações
                    </p>
                    <ul className="max-h-72 overflow-y-auto">
                      {notifs.length === 0 && (
                        <li className={cn("px-3 py-6 text-center text-[12px]", muted)}>
                          Nenhuma alerta no momento.
                        </li>
                      )}
                      {notifs.map((n) => (
                        <li key={n.id}>
                          <Link
                            href={n.href ?? "/dono"}
                            onClick={() => setNotifOpen(false)}
                            className={cn(
                              "block px-3 py-2.5 transition",
                              light ? "hover:bg-stone-50" : "hover:bg-at-card-soft"
                            )}
                          >
                            <p className="text-[13px]">{n.titulo}</p>
                            <p className={cn("text-[11px]", muted)}>{n.detalhe}</p>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={toggle}
                className={cn(
                  "rounded-lg p-2 transition",
                  light ? "hover:bg-stone-100" : "hover:bg-white/[0.05]"
                )}
                title={light ? "Tema escuro" : "Tema claro"}
              >
                {light ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
              </button>

              <Link
                href="/dono/conta"
                className={cn(
                  "ml-1 flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-[12px] transition",
                  light
                    ? "border-stone-200 hover:bg-stone-50"
                    : "border-at-soft hover:bg-at-card-soft"
                )}
              >
                <span
                  className={cn(
                    "flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-medium",
                    light ? "bg-stone-900 text-white" : "bg-[#c4a574]/25 text-at-link"
                  )}
                >
                  {nome.slice(0, 1)}
                </span>
                <span className="hidden sm:inline">{nome}</span>
              </Link>
            </div>
          </header>

          <main className="mx-auto w-full max-w-[1280px] flex-1 px-4 py-6 sm:px-6 sm:py-8">
            {!hideTitle && (
              <header className="mb-7">
                <h1
                  className={cn(
                    "text-[clamp(1.7rem,3vw,2.2rem)] leading-tight tracking-tight",
                    light ? "text-slate-900" : "text-at-primary"
                  )}
                  style={{ fontFamily: "var(--font-dono-display), Georgia, serif" }}
                >
                  {title}
                </h1>
                {subtitle && (
                  <p className={cn("mt-1.5 max-w-2xl text-[13px]", muted)}>
                    {subtitle}
                  </p>
                )}
              </header>
            )}
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}

export function DonoShell(props: {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
  email?: string;
  badgeSuporte?: number;
  wide?: boolean;
  hideTitle?: boolean;
}) {
  const { wide: _wide, ...rest } = props;
  void _wide;
  return <DonoShellInner {...rest} />;
}

export function saudacaoHora(nome: string) {
  const h = new Date().getHours();
  const periodo =
    h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
  return `${periodo}, ${nome}`;
}

export function nomeDoEmail(email?: string) {
  const fromEnv =
    typeof process !== "undefined"
      ? process.env.NEXT_PUBLIC_DONO_NOME?.trim()
      : undefined;
  if (fromEnv) return fromEnv;
  if (!email) return "Dono";
  const local = email.split("@")[0] ?? "Dono";
  const part = local.split(/[._-]/)[0] ?? local;
  return part.charAt(0).toUpperCase() + part.slice(1);
}

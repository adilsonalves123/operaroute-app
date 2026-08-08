import { Space_Grotesk, IBM_Plex_Sans } from "next/font/google";
import { AuthFunilTracker } from "@/components/dono/AuthFunilTracker";
import { AuthSignalField } from "@/components/auth/AuthSignalField";

const display = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-auth-display",
  display: "swap",
});

const sans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-auth-sans",
  display: "swap",
});

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={`${display.variable} ${sans.variable} auth-shell auth-shell-v2 relative min-h-screen overflow-x-hidden`}
    >
      <AuthFunilTracker />
      <AuthSignalField />

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-6xl flex-col lg:flex-row">
        {/* Marca: compacta no mobile para o formulário aparecer na 1ª tela */}
        <section className="auth-brand shrink-0 px-6 pb-4 pt-8 sm:px-10 lg:flex lg:max-w-[55%] lg:flex-1 lg:flex-col lg:justify-between lg:px-14 lg:py-16">
          <div className="flex items-center gap-3">
            <span className="auth-live-dot" aria-hidden />
            <span
              className="text-[11px] font-medium uppercase tracking-[0.28em] text-[#7dd3e8]/80"
              style={{ fontFamily: "var(--font-auth-sans), system-ui, sans-serif" }}
            >
              Sistema online
            </span>
          </div>

          <div className="mt-6 lg:mt-0">
            <p
              className="text-[clamp(2.4rem,8vw,5.75rem)] font-medium leading-[0.9] tracking-[-0.045em] text-[#f4f7fb]"
              style={{ fontFamily: "var(--font-auth-display), system-ui, sans-serif" }}
            >
              Opera
              <span className="text-[#7dd3e8]">Rout</span>
            </p>
            <div className="auth-scanline mt-4 h-px w-20 bg-gradient-to-r from-[#7dd3e8] to-transparent lg:mt-5 lg:w-24" />
            <p
              className="mt-4 hidden max-w-md text-[17px] leading-relaxed text-[#9aa3b2] sm:block"
              style={{ fontFamily: "var(--font-auth-sans), system-ui, sans-serif" }}
            >
              Comando da operação em tempo real — pontos, coletas e rotas no
              mesmo sinal.
            </p>
            <p
              className="mt-3 text-[11px] font-medium tracking-[0.16em] uppercase text-[#c9a87c] lg:mt-5 lg:text-[12px] lg:tracking-[0.18em]"
              style={{ fontFamily: "var(--font-auth-sans), system-ui, sans-serif" }}
            >
              7 dias grátis · sem cartão
            </p>
          </div>

          <p
            className="mt-8 hidden text-[11px] tracking-wide text-[#5c6573] lg:mt-14 lg:block"
            style={{ fontFamily: "var(--font-auth-sans), system-ui, sans-serif" }}
          >
            © {new Date().getFullYear()} OperaRoute · canal seguro
          </p>
        </section>

        {/* Formulário sempre visível */}
        <section className="flex flex-1 items-start justify-center px-6 pb-12 pt-2 sm:px-10 lg:items-center lg:justify-end lg:px-12 lg:py-16">
          <div
            className="auth-dock w-full max-w-[400px]"
            style={{ fontFamily: "var(--font-auth-sans), system-ui, sans-serif" }}
          >
            {children}
          </div>
        </section>
      </div>
    </div>
  );
}

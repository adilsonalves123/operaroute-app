import { Space_Grotesk, IBM_Plex_Sans } from "next/font/google";

const display = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-planos-display",
  display: "swap",
});

const sans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-planos-sans",
  display: "swap",
});

/** Fontes só na página de planos — não altera o app inteiro. */
export function PlanosShell({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={`${display.variable} ${sans.variable} planos-shell relative -mx-4 -mt-2 min-h-[70vh] px-4 pb-36 sm:-mx-0 sm:px-0 lg:pb-28`}
    >
      {children}
    </div>
  );
}

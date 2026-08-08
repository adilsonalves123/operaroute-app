import { Space_Grotesk, IBM_Plex_Sans } from "next/font/google";

const display = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-uni-display",
  display: "swap",
});

const sans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-uni-sans",
  display: "swap",
});

export function UniversidadeShell({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={`${display.variable} ${sans.variable} uni-shell relative -mx-4 -mt-2 min-h-[70vh] px-4 pb-24 sm:-mx-0 sm:px-0 lg:pb-10`}
    >
      {children}
    </div>
  );
}

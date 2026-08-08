import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import { getAppUrl } from "@/lib/app-url";
import "./globals.css";

const geist = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(getAppUrl()),
  title: "OperaRoute — Controle total da sua operação",
  description: "Sistema de gestão operacional para pequenos e médios operadores",
};

/** Garante env(safe-area-inset-*) no tablet/iOS (barra de gestos). */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={`${geist.variable} h-full`}>
      <body className="min-h-full antialiased">{children}</body>
    </html>
  );
}

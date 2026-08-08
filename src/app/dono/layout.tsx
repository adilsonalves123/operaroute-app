import { DonoThemeProvider } from "@/components/dono/DonoTheme";

export default function DonoRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DonoThemeProvider>{children}</DonoThemeProvider>;
}

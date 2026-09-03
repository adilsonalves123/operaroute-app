import { AppShell } from "@/components/layout/AppShell";
import { AppThemeProvider } from "@/components/layout/AppTheme";

export const dynamic = "force-dynamic";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppThemeProvider>
      <AppShell>{children}</AppShell>
    </AppThemeProvider>
  );
}

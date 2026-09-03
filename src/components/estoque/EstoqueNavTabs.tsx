import Link from "next/link";
import { cn } from "@/lib/utils";

type Tab = "central" | "alocados" | "kits";

const tabClass =
  "rounded-sm border px-3 py-2 text-xs font-medium transition";

export function EstoqueNavTabs({ active }: { active: Tab }) {
  return (
    <div className="flex flex-wrap gap-2">
      <Link
        href="/estoque"
        className={cn(
          tabClass,
          active === "central" ? "analise-tab-active" : "analise-tab-idle"
        )}
      >
        Estoque central
      </Link>
      <Link
        href="/estoque/alocados"
        className={cn(
          tabClass,
          active === "alocados" ? "analise-tab-active" : "analise-tab-idle"
        )}
      >
        Nos clientes
      </Link>
      <Link
        href="/estoque/kits"
        className={cn(
          tabClass,
          active === "kits" ? "analise-tab-active" : "analise-tab-idle"
        )}
      >
        Kits
      </Link>
    </div>
  );
}

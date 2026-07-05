"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { VisitasListClient } from "@/components/coletas/cassino/VisitasListClient";
import {
  FuraFuraColetasClient,
  type ColetaFuraListItem,
} from "@/components/coletas/fura-fura/FuraFuraColetasClient";

type Visita = Parameters<typeof VisitasListClient>[0]["visitas"][number];

type Tab = "cassino" | "fura_fura";

const tabs: { id: Tab; label: string }[] = [
  { id: "cassino", label: "Cassino" },
  { id: "fura_fura", label: "Fura Fura" },
];

export function ColetasMultiNichoTabs({
  visitas,
  coletasFura,
}: {
  visitas: Visita[];
  coletasFura: ColetaFuraListItem[];
}) {
  const [tab, setTab] = useState<Tab>("cassino");

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Coletas</h1>
          <div className="flex gap-6 mt-4 border-b border-slate-800">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={cn(
                  "pb-2.5 text-sm font-medium transition border-b-2 -mb-px",
                  tab === t.id
                    ? "border-primary-neon text-white"
                    : "border-transparent text-slate-500 hover:text-slate-300"
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <Link
          href={tab === "cassino" ? "/coletas/nova/cassino" : "/coletas/nova/fura-fura"}
          className="inline-flex items-center gap-2 rounded-lg bg-primary-neon px-4 py-2.5 text-sm font-semibold text-slate-900 hover:bg-cyan-300 shrink-0"
        >
          <Plus className="h-4 w-4" />
          {tab === "cassino" ? "Nova leitura" : "Nova coleta"}
        </Link>
      </div>

      {tab === "cassino" ? (
        <VisitasListClient visitas={visitas} />
      ) : (
        <FuraFuraColetasClient coletas={coletasFura} />
      )}
    </div>
  );
}

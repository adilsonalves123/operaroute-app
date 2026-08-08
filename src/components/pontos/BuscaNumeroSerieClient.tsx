"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { HistoricoNumeroSerie } from "@/components/pontos/HistoricoNumeroSerie";
import { FormInput } from "@/components/ui/FormInput";

export function BuscaNumeroSerieClient({ backHref = "/pontos" }: { backHref?: string }) {
  const [serie, setSerie] = useState("");
  const [buscou, setBuscou] = useState(false);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href={backHref} className="rounded-lg p-2 text-slate-400 hover:bg-slate-800">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">Buscar máquina</h1>
          <p className="text-slate-400 text-sm mt-0.5">
            Pesquise pelo número de série — histórico de leituras e fotos
          </p>
        </div>
      </div>

      <div className="glass-card p-6 space-y-4">
        <FormInput
          label="Número de série"
          placeholder="Digite ou cole o número de série"
          value={serie}
          onChange={(e) => {
            setSerie(e.target.value);
            setBuscou(true);
          }}
          hint="Mínimo 2 caracteres — a busca é automática"
        />

        {buscou && serie.trim().length >= 2 && <HistoricoNumeroSerie serie={serie} />}

        {buscou && serie.trim().length < 2 && (
          <p className="text-sm text-slate-500">Digite ao menos 2 caracteres para buscar.</p>
        )}
      </div>
    </div>
  );
}

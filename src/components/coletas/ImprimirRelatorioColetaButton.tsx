"use client";

import { useCallback, useState } from "react";
import { Printer } from "lucide-react";
import { ImprimirColetaSheet } from "@/components/coletas/ImprimirColetaSheet";
import { coletaBtnSecondaryClass } from "@/components/coletas/layout/coleta-form-styles";
import {
  montarCorpoImpressaoRelatorio,
  type FormatoImpressao,
  type RelatorioImpressaoOpts,
} from "@/lib/coletas/imprimir-relatorio-texto";
import { cn } from "@/lib/utils";

type Props = {
  disabled?: boolean;
  className?: string;
  getImpressaoOpts: () => RelatorioImpressaoOpts;
};

export function ImprimirRelatorioColetaButton({ disabled, className, getImpressaoOpts }: Props) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [bodyHtml, setBodyHtml] = useState("");
  const [formato, setFormato] = useState<FormatoImpressao>("termica_58");

  const abrirSheet = useCallback(
    (formatoInicial: FormatoImpressao = "termica_58") => {
      const opts = getImpressaoOpts();
      const html = montarCorpoImpressaoRelatorio(opts);
      setBodyHtml(html);
      setFormato(formatoInicial);
      setSheetOpen(true);
    },
    [getImpressaoOpts]
  );

  function handleTapImprimir() {
    if (disabled) return;
    abrirSheet("termica_58");
  }

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={handleTapImprimir}
        className={cn(coletaBtnSecondaryClass("touch-manipulation"), className)}
      >
        <Printer className="h-4 w-4" />
        Imprimir
      </button>

      <ImprimirColetaSheet
        open={sheetOpen}
        bodyHtml={bodyHtml}
        formato={formato}
        onFormatoChange={setFormato}
        onClose={() => setSheetOpen(false)}
      />
    </>
  );
}

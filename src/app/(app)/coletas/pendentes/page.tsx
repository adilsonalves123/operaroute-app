import { Suspense } from "react";
import { FuraFuraPendentesClient } from "@/components/coletas/fura-fura/FuraFuraPendentesClient";

export default function ColetasPendentesPage() {
  return (
    <Suspense fallback={<div className="text-slate-500 p-8">Carregando...</div>}>
      <FuraFuraPendentesClient />
    </Suspense>
  );
}

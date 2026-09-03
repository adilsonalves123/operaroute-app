import { Suspense } from "react";
import { FuraFuraPendentesClient } from "@/components/coletas/fura-fura/FuraFuraPendentesClient";

export default function ColetasPendentesPage() {
  return (
    <Suspense fallback={<div className="text-at-muted p-8">Carregando...</div>}>
      <FuraFuraPendentesClient />
    </Suspense>
  );
}

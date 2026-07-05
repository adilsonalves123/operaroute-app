import { Suspense } from "react";
import { NovaColetaFuraFuraForm } from "@/components/coletas/fura-fura/NovaColetaFuraFuraForm";

export default function NovaColetaFuraFuraPage() {
  return (
    <Suspense fallback={<div className="text-slate-500 p-8">Carregando...</div>}>
      <NovaColetaFuraFuraForm />
    </Suspense>
  );
}

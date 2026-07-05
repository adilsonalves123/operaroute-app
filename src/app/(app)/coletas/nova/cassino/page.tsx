import { Suspense } from "react";
import { NovaColetaCassinoForm } from "@/components/coletas/cassino/NovaColetaCassinoForm";
import { LoadingState } from "@/components/ui/LoadingState";

export default function NovaColetaCassinoPage() {
  return (
    <Suspense fallback={<LoadingState message="Carregando..." />}>
      <NovaColetaCassinoForm />
    </Suspense>
  );
}

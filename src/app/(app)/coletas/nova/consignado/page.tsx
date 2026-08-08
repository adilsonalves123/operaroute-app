import { Suspense } from "react";
import { NovaColetaConsignadoForm } from "@/components/coletas/consignado/NovaColetaConsignadoForm";
import { LoadingState } from "@/components/ui/LoadingState";

/**
 * Não redireciona se o nicho “sumir” da lista da empresa — isso fazia o clique em
 * Consignado na visita cair em /coletas/nova (e às vezes no cassino), parecendo
 * que “não vai”. O formulário trata ponto/expositor vazio.
 */
export default async function NovaColetaConsignadoPage() {
  return (
    <Suspense fallback={<LoadingState message="Carregando..." />}>
      <NovaColetaConsignadoForm />
    </Suspense>
  );
}

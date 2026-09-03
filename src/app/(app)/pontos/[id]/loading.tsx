import { OperaRouteLoader } from "@/components/ui/OperaRouteLoader";

export default function PontoDetailLoading() {
  return (
    <div className="min-h-[70vh] w-full">
      <OperaRouteLoader variant="fullscreen" message="Abrindo o ponto..." />
    </div>
  );
}

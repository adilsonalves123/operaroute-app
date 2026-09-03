import { OperaRouteLoader } from "@/components/ui/OperaRouteLoader";

export default function AppLoading() {
  return (
    <div className="min-h-[70vh] w-full">
      <OperaRouteLoader variant="fullscreen" />
    </div>
  );
}

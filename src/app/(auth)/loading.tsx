import { OperaRouteLoader } from "@/components/ui/OperaRouteLoader";

export default function AuthLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <OperaRouteLoader variant="fullscreen" />
    </div>
  );
}

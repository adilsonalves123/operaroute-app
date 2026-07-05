import { Route } from "lucide-react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600/10 via-transparent to-cyan-500/5" />
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-neon/20 neon-glow">
              <Route className="h-5 w-5 text-primary-neon" />
            </div>
            <span className="text-2xl font-bold text-white">
              Opera<span className="text-primary-neon">Route</span>
            </span>
          </div>
        </div>
        <div className="relative z-10 space-y-6">
          <h1 className="text-4xl font-bold text-muted text-white leading-tight">
            Controle total da{" "}
            <span className="text-primary-neon">sua operação</span>
          </h1>
          <p className="text-lg text-slate-400 max-w-md">
            Gerencie pontos, coletas, financeiro, rotas e equipe em um só lugar.
            Feito para quem opera no campo.
          </p>
          <div className="flex gap-4">
            {["Pontos", "Coletas", "Financeiro", "Rotas"].map((item) => (
              <div
                key={item}
                className="glass-card px-4 py-2 text-sm text-slate-300"
              >
                {item}
              </div>
            ))}
          </div>
        </div>
        <p className="relative z-10 text-sm text-slate-500">
          © {new Date().getFullYear()} OperaRoute. Todos os direitos reservados.
        </p>
      </div>
      <div className="flex flex-1 items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-md">{children}</div>
      </div>
    </div>
  );
}

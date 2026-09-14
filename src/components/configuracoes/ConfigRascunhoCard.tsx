"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ClipboardPen } from "lucide-react";
import { ConfigPanelBody } from "@/components/configuracoes/configuracoes-ui";
import { cn } from "@/lib/utils";

type Props = {
  ativo: boolean;
  podeEditar: boolean;
  embedded?: boolean;
};

/** Liga/desliga o menu Rascunho (valores manuais). */
export function ConfigRascunhoCard({ ativo, podeEditar, embedded }: Props) {
  const router = useRouter();
  const [ligado, setLigado] = useState(ativo);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");

  async function alternar(next: boolean) {
    if (!podeEditar || loading) return;
    setLoading(true);
    setErro("");
    const prev = ligado;
    setLigado(next);
    try {
      const res = await fetch("/api/empresa/rascunho", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rascunho_dashboard_ativo: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setLigado(prev);
        setErro(data.error ?? "Não foi possível salvar.");
        return;
      }
      router.refresh();
    } catch {
      setLigado(prev);
      setErro("Falha de rede ao salvar.");
    } finally {
      setLoading(false);
    }
  }

  const body = (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2">
            <ClipboardPen className="h-4 w-4 text-at-link" />
            <p className="text-[14px] font-medium text-at-primary">Menu Rascunho</p>
          </div>
          <p className="text-[13px] leading-relaxed text-at-muted">
            Mostra no menu a tela Rascunho: digite os valores dos pontos, salve e
            veja só o resumo com os números.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={ligado}
          disabled={!podeEditar || loading}
          onClick={() => void alternar(!ligado)}
          className={cn(
            "relative h-7 w-12 shrink-0 rounded-full transition",
            ligado ? "bg-emerald-600" : "bg-at-track",
            (!podeEditar || loading) && "opacity-50"
          )}
        >
          <span
            className={cn(
              "absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white transition",
              ligado && "translate-x-5"
            )}
          />
        </button>
      </div>
      {!podeEditar ? (
        <p className="text-[12px] text-at-soft">
          Só o administrador pode ligar ou desligar.
        </p>
      ) : null}
      {erro ? <p className="text-[12px] text-red-400">{erro}</p> : null}
    </div>
  );

  if (embedded) {
    return <div className="p-5 sm:p-6">{body}</div>;
  }

  return <ConfigPanelBody>{body}</ConfigPanelBody>;
}

import { AlertBadge } from "@/components/ui/AlertBadge";
import { EquipamentoTransferirButton } from "@/components/pontos/EquipamentoTransferirButton";
import { EquipamentoExcluirButton } from "@/components/pontos/EquipamentoExcluirButton";
import {
  getEquipamentoDisplayNome,
  getEquipamentoTipoLabel,
  groupEquipamentosPorModulo,
  type EquipamentoGrupoId,
} from "@/lib/equipamentos";
import { formatContador } from "@/lib/nichos/cassino";
import type { Equipamento, EquipamentoTipo } from "@/lib/types/database";
import { Building2, Box, CircleDot, Gamepad2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

const grupoStyles: Record<
  EquipamentoGrupoId,
  {
    header: string;
    iconWrap: string;
    card: string;
    badge: "info" | "warning" | "success" | "purple";
  }
> = {
  maquinas_cassino: {
    header: "border-emerald-500/25 bg-emerald-500/5",
    iconWrap: "bg-emerald-500/15 text-emerald-400",
    card: "border-emerald-500/15 bg-emerald-950/20",
    badge: "info",
  },
  fura_fura: {
    header: "border-amber-500/25 bg-amber-500/5",
    iconWrap: "bg-amber-500/15 text-amber-400",
    card: "border-amber-500/15 bg-amber-950/20",
    badge: "warning",
  },
};

const grupoIcons: Record<EquipamentoGrupoId, ReactNode> = {
  maquinas_cassino: <Building2 className="h-4 w-4" />,
  fura_fura: <CircleDot className="h-4 w-4" />,
};

const tipoIcons: Partial<Record<EquipamentoTipo, ReactNode>> = {
  cassino: <Gamepad2 className="h-3.5 w-3.5" />,
  vending_ursinho: <Box className="h-3.5 w-3.5" />,
  fura_fura: <CircleDot className="h-3.5 w-3.5" />,
};

function EquipamentoCard({
  eq,
  pontoId,
  outrosPontos,
  grupoId,
  showSubtipo,
}: {
  eq: Equipamento;
  pontoId: string;
  outrosPontos?: { id: string; nome: string }[];
  grupoId: EquipamentoGrupoId;
  showSubtipo: boolean;
}) {
  const styles = grupoStyles[grupoId];

  return (
    <div className={cn("rounded-lg border p-4 space-y-3", styles.card)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="font-medium text-white truncate">{getEquipamentoDisplayNome(eq)}</p>
          {showSubtipo && (
            <AlertBadge variant={styles.badge} className="gap-1">
              {tipoIcons[eq.tipo]}
              {getEquipamentoTipoLabel(eq.tipo)}
            </AlertBadge>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <EquipamentoTransferirButton
            equipamento={eq}
            pontoAtualId={pontoId}
            outrosPontos={outrosPontos}
          />
          <EquipamentoExcluirButton equipamento={eq} />
        </div>
      </div>

      {eq.tipo === "cassino" && (
        <div className="grid grid-cols-2 gap-3 text-sm rounded-md bg-slate-950/40 px-3 py-2">
          <div>
            <span className="text-slate-500 block text-xs">Entrada atual</span>
            <span className="text-green-400 font-semibold tabular-nums">
              {eq.numero_entrada != null
                ? formatContador(Math.round(Number(eq.numero_entrada)))
                : "—"}
            </span>
          </div>
          <div>
            <span className="text-slate-500 block text-xs">Saída atual</span>
            <span className="text-red-400 font-semibold tabular-nums">
              {eq.numero_saida != null
                ? formatContador(Math.round(Number(eq.numero_saida)))
                : "—"}
            </span>
          </div>
        </div>
      )}

      {eq.tipo === "vending_ursinho" && (
        <div className="text-sm rounded-md bg-slate-950/40 px-3 py-2">
          <span className="text-slate-500 block text-xs">Entrada atual (visor)</span>
          <span className="text-emerald-300 font-semibold tabular-nums">
            {eq.entrada_atual != null
              ? formatContador(Math.round(Number(eq.entrada_atual)))
              : "—"}
          </span>
        </div>
      )}

      {eq.tipo === "fura_fura" && (
        <p className="text-xs text-amber-200/70 rounded-md bg-amber-500/5 border border-amber-500/10 px-3 py-2">
          Coleta por contagem de furos — sem leitura de painel
        </p>
      )}

      {eq.observacao && <p className="text-xs text-slate-500">{eq.observacao}</p>}
    </div>
  );
}

export function EquipamentosList({
  equipamentos,
  pontoId,
  outrosPontos,
}: {
  equipamentos: Equipamento[];
  pontoId: string;
  outrosPontos?: { id: string; nome: string }[];
}) {
  if (!equipamentos.length) {
    return (
      <p className="text-sm text-slate-400">Nenhum equipamento cadastrado neste ponto.</p>
    );
  }

  const grupos = groupEquipamentosPorModulo(equipamentos);
  const multiModulo = grupos.length > 1;

  return (
    <div className={cn("space-y-6", multiModulo && "space-y-8")}>
      {grupos.map(({ grupo, items }) => {
        const styles = grupoStyles[grupo.id];
        const showSubtipo = new Set(items.map((i) => i.tipo)).size > 1;

        return (
          <section key={grupo.id} className="space-y-3">
            <div
              className={cn(
                "flex items-center gap-3 rounded-lg border px-4 py-3",
                styles.header
              )}
            >
              <div className={cn("rounded-lg p-2 shrink-0", styles.iconWrap)}>
                {grupoIcons[grupo.id]}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm font-semibold text-white">{grupo.label}</h3>
                  <span className="text-xs text-slate-400">
                    {items.length} {items.length === 1 ? "máquina" : "máquinas"}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">{grupo.subtitle}</p>
              </div>
            </div>

            <div className="space-y-2 pl-0 sm:pl-2">
              {items.map((eq) => (
                <EquipamentoCard
                  key={eq.id}
                  eq={eq}
                  pontoId={pontoId}
                  outrosPontos={outrosPontos}
                  grupoId={grupo.id}
                  showSubtipo={showSubtipo}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

import type { Ponto } from "@/lib/types/database";

export const DIAS_SEM_COLETA_ALERTA = 30;

export type AlertaPontoFura = {
  id: string;
  tipo: "warning" | "danger" | "info";
  mensagem: string;
};

export type PontoFuraAlertas = Pick<
  Ponto,
  "ultima_coleta" | "furos_estoque" | "furos_minimo" | "nome"
>;

export function diasDesdeColeta(ultimaColeta: string | null | undefined): number | null {
  if (!ultimaColeta) return null;
  const diff = Date.now() - new Date(ultimaColeta).getTime();
  return Math.floor(diff / (24 * 60 * 60 * 1000));
}

export function alertasPontoFura(ponto: PontoFuraAlertas): AlertaPontoFura[] {
  const alertas: AlertaPontoFura[] = [];
  const dias = diasDesdeColeta(ponto.ultima_coleta);

  if (dias === null) {
    alertas.push({
      id: "sem-coleta",
      tipo: "warning",
      mensagem: "Nunca coletou neste ponto",
    });
  } else if (dias >= DIAS_SEM_COLETA_ALERTA) {
    alertas.push({
      id: "coleta-atrasada",
      tipo: "warning",
      mensagem: `Sem coleta há ${dias} dias`,
    });
  }

  if (
    ponto.furos_estoque != null &&
    ponto.furos_minimo != null &&
    ponto.furos_estoque <= ponto.furos_minimo
  ) {
    alertas.push({
      id: "furos-baixos",
      tipo: "danger",
      mensagem: `Furos baixos: ${ponto.furos_estoque} (mín. ${ponto.furos_minimo})`,
    });
  }

  return alertas;
}

export function prioridadeRotaPonto(ponto: PontoFuraAlertas): number {
  const alertas = alertasPontoFura(ponto);
  if (alertas.some((a) => a.id === "furos-baixos")) return 0;
  if (alertas.some((a) => a.id === "coleta-atrasada" || a.id === "sem-coleta")) return 1;
  const dias = diasDesdeColeta(ponto.ultima_coleta);
  return dias ?? 999;
}

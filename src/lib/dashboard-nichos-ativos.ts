import type { Nicho } from "@/lib/types/database";

export type DashboardNichoId =
  | "maquinas_cassino"
  | "fura_fura"
  | "ursinho"
  | "diversao"
  | "bolinha"
  | "consignado";

export function getDashboardNichosAtivos(nichos: Nicho[]): DashboardNichoId[] {
  const out: DashboardNichoId[] = [];
  if (nichos.includes("maquinas_cassino")) out.push("maquinas_cassino");
  if (nichos.includes("fura_fura")) out.push("fura_fura");
  if (nichos.includes("ursinho")) out.push("ursinho");
  if (nichos.includes("diversao")) out.push("diversao");
  if (nichos.includes("bolinha")) out.push("bolinha");
  if (nichos.includes("consignado")) out.push("consignado");
  return out;
}

export function isDashboardMultiNicho(nichos: Nicho[]): boolean {
  return getDashboardNichosAtivos(nichos).length > 1;
}

export function dashboardNichosLabel(nichos: DashboardNichoId[]): string {
  const labels: Record<DashboardNichoId, string> = {
    maquinas_cassino: "Cassino",
    fura_fura: "Fura Fura",
    ursinho: "Ursinho",
    diversao: "Diversão",
    bolinha: "Bolinha",
    consignado: "Consignado",
  };
  return nichos.map((n) => labels[n]).join(" · ");
}

import type { VisitaPontoNicho } from "@/lib/visitas-ponto/types";

export * from "@/lib/visitas-ponto/types";
export type { VisitaPontoNicho } from "@/lib/visitas-ponto/types";
export { fetchVisitaPontoResumo, montarResumoVisitaPonto, cobravelCassinoVisita } from "@/lib/visitas-ponto/resumo";
export { vincularItemVisitaPonto, parseVisitaPontoId } from "@/lib/visitas-ponto/vincular-item";
export { calcularCheckoutVisita, finalizarVisitaPontoComCheckout, aplicarRecebimentoDividaInicio, baixarPendenciaVisitaPonto } from "@/lib/visitas-ponto/checkout";
export { totalDividaAnteriorPonto, fetchCassinoVisitaIdsVisitaPonto } from "@/lib/visitas-ponto/divida-ponto";
export {
  mensagemWhatsAppVisitaPonto,
  mensagemCobrancaVisitaPonto,
  linkWhatsAppVisitaPonto,
  linkWhatsAppCobrancaVisitaPonto,
} from "@/lib/visitas-ponto/relatorio-whatsapp";

export function contarNichosOperacao(nichos: string[]): number {
  const principais = new Set<string>();
  if (nichos.includes("maquinas_cassino")) principais.add("cassino");
  if (nichos.includes("fura_fura")) principais.add("fura_fura");
  if (nichos.includes("ursinho") || nichos.includes("vending_ursinho")) principais.add("ursinho");
  if (nichos.includes("diversao")) principais.add("diversao");
  if (nichos.includes("bolinha")) principais.add("bolinha");
  if (nichos.includes("consignado")) principais.add("consignado");
  return principais.size;
}

export function visitaPontoDisponivel(nichos: string[]): boolean {
  return contarNichosOperacao(nichos) >= 2;
}

export function resolveNichosVisitaPonto(nichosAtivos: string[]): VisitaPontoNicho[] {
  const out: VisitaPontoNicho[] = [];
  if (nichosAtivos.includes("maquinas_cassino")) out.push("cassino");
  if (nichosAtivos.includes("ursinho") || nichosAtivos.includes("vending_ursinho")) {
    out.push("ursinho");
  }
  if (nichosAtivos.includes("fura_fura")) out.push("fura_fura");
  if (nichosAtivos.includes("diversao")) out.push("diversao");
  if (nichosAtivos.includes("bolinha")) out.push("bolinha");
  if (nichosAtivos.includes("consignado")) out.push("consignado");
  return out;
}

export function buildColetaUrl(
  nicho: VisitaPontoNicho,
  pontoId: string,
  visitaPontoId: string,
  opts?: { editarVisitaId?: string }
): string {
  const base =
    nicho === "cassino"
      ? "/coletas/nova/cassino"
      : nicho === "fura_fura"
        ? "/coletas/nova/fura-fura"
        : nicho === "diversao"
          ? "/coletas/nova/diversao"
          : nicho === "bolinha"
            ? "/coletas/nova/bolinha"
            : nicho === "consignado"
              ? "/coletas/nova/consignado"
              : "/coletas/nova/ursinho";
  const params = new URLSearchParams({
    ponto: pontoId,
    visita_ponto: visitaPontoId,
  });
  if (opts?.editarVisitaId) {
    params.set("editar_visita", opts.editarVisitaId);
  }
  return `${base}?${params.toString()}`;
}

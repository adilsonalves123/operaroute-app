import type { ParadaRota, PontoRotaInput } from "./otimizar-rota";
import { haversineKm } from "./otimizar-rota";
import type { Coordenada } from "./otimizar-rota";

export type RotaSalvaParada = {
  id: string;
  ponto_id: string;
  ordem: number;
  status: string;
  observacao?: string | null;
};

export type RotaSalva = {
  id: string;
  empresa_id: string;
  nome: string;
  operador_id: string | null;
  operador_nome?: string | null;
  cidade: string | null;
  bairro: string | null;
  status: string;
  created_at: string;
  paradas: RotaSalvaParada[];
  total_paradas: number;
};

export type OperadorRotaOpcao = {
  userId: string;
  nome: string;
  role: string;
  /** WhatsApp do membro (equipe) — usado para enviar a rota */
  whatsapp?: string | null;
};

export function paradasFromOrdemSalva(
  pontos: PontoRotaInput[],
  ordemSalva: { ponto_id: string; ordem: number }[],
  inicio: Coordenada | null = null
): { paradas: ParadaRota[]; distanciaTotalKm: number } {
  const sorted = [...ordemSalva].sort((a, b) => a.ordem - b.ordem);
  const paradas: ParadaRota[] = [];
  let distTotal = 0;
  let prev: Coordenada | PontoRotaInput | null = inicio;

  for (let i = 0; i < sorted.length; i++) {
    const p = pontos.find((x) => x.id === sorted[i].ponto_id);
    if (!p) continue;

    const temCoordenadas = p.latitude != null && p.longitude != null;
    let distanciaAnteriorKm: number | null = null;

    if (temCoordenadas && prev) {
      const dest = { latitude: p.latitude!, longitude: p.longitude! };
      distanciaAnteriorKm =
        "scorePrioridade" in (prev as PontoRotaInput) && prev !== inicio
          ? haversineKm(
              {
                latitude: (prev as PontoRotaInput).latitude!,
                longitude: (prev as PontoRotaInput).longitude!,
              },
              dest
            )
          : haversineKm(prev as Coordenada, dest);
      distTotal += distanciaAnteriorKm;
    }

    paradas.push({
      ...p,
      ordem: i + 1,
      temCoordenadas,
      distanciaAnteriorKm:
        distanciaAnteriorKm != null ? Math.round(distanciaAnteriorKm * 100) / 100 : null,
    });

    if (temCoordenadas) prev = p;
  }

  return {
    paradas,
    distanciaTotalKm: Math.round(distTotal * 100) / 100,
  };
}

export function statusRotaLabel(status: string): string {
  switch (status) {
    case "em_andamento":
      return "Em andamento";
    case "concluida":
      return "Concluída";
    default:
      return "Pendente";
  }
}

export function statusParadaLabel(status: string): string {
  switch (status) {
    case "concluida":
      return "Concluída";
    case "pulada":
      return "Pulada";
    default:
      return "Pendente";
  }
}

export function progressoRota(rota: RotaSalva) {
  const concluidas = rota.paradas.filter(
    (p) => p.status === "concluida" || p.status === "pulada"
  ).length;
  const total = rota.total_paradas || rota.paradas.length;
  return {
    concluidas,
    total,
    pendentes: total - concluidas,
    percentual: total > 0 ? Math.round((concluidas / total) * 100) : 0,
  };
}

export function proximaParadaRota(rota: RotaSalva): RotaSalvaParada | null {
  return (
    rota.paradas
      .slice()
      .sort((a, b) => a.ordem - b.ordem)
      .find((p) => p.status === "pendente") ?? null
  );
}

export function rotasDoOperador(rotas: RotaSalva[], userId: string): RotaSalva[] {
  return rotas.filter((r) => r.operador_id === userId);
}

import { EQUIPAMENTO_NICHO } from "@/lib/assinatura";
import type { EquipamentoTipo } from "@/lib/equipamentos";
import type { Nicho } from "@/lib/types/database";

export const PAGINA_CAMPO_OFFLINE = "/campo-offline";

export type FormularioCampo = {
  rota: string;
  rotulo: string;
};

const FORMULARIO_POR_NICHO: Partial<Record<Nicho, FormularioCampo>> = {
  maquinas_cassino: { rota: "/coletas/nova/cassino", rotulo: "Cassino" },
  ursinho: { rota: "/coletas/nova/ursinho", rotulo: "Ursinho" },
  vending_ursinho: { rota: "/coletas/nova/ursinho", rotulo: "Ursinho" },
  fura_fura: { rota: "/coletas/nova/fura-fura", rotulo: "Fura fura" },
  diversao: { rota: "/coletas/nova/diversao", rotulo: "Diversão" },
  bolinha: { rota: "/coletas/nova/bolinha", rotulo: "Bolinha" },
  consignado: { rota: "/coletas/nova/consignado", rotulo: "Consignado" },
};

/** Formulários de coleta dos nichos ativos, sem repetir (ursinho e vending usam o mesmo). */
export function formulariosDosNichos(nichos: readonly string[]): FormularioCampo[] {
  const vistos = new Set<string>();
  const saida: FormularioCampo[] = [];
  for (const nicho of nichos) {
    const f = FORMULARIO_POR_NICHO[nicho as Nicho];
    if (!f || vistos.has(f.rota)) continue;
    vistos.add(f.rota);
    saida.push(f);
  }
  return saida;
}

/** Telas guardadas no celular a cada preparo (além das que a pessoa abrir com internet). */
export function paginasDoCampo(nichos: readonly string[]): string[] {
  return [
    PAGINA_CAMPO_OFFLINE,
    "/pontos",
    ...formulariosDosNichos(nichos).map((f) => f.rota),
  ];
}

export function nichoDoEquipamento(tipo: unknown): Nicho | null {
  if (typeof tipo !== "string") return null;
  return EQUIPAMENTO_NICHO[tipo as EquipamentoTipo] ?? null;
}

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

/** Descobre de qual ponto a pessoa tentou abrir a tela (ex.: /pontos/<id> ou ?ponto=<id>). */
export function pontoDoDestino(destino: string | null | undefined): string | null {
  if (!destino) return null;
  try {
    const url = new URL(destino, "https://x.invalid");
    const doParametro = url.searchParams.get("ponto");
    if (doParametro && UUID.test(doParametro)) return doParametro.match(UUID)![0].toLowerCase();
    const m = /^\/pontos\/([^/]+)/.exec(url.pathname);
    if (m && UUID.test(m[1])) return m[1].match(UUID)![0].toLowerCase();
  } catch {
    /* ignore */
  }
  return null;
}

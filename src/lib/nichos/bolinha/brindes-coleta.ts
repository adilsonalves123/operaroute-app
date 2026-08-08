import {
  quantidadeRestanteBrindeNoPonto,
  type BrindeEntreguePonto,
  type EstoqueBrindePonto,
} from "@/lib/estoque/brindes-ponto";

export type BrindeMaquinaLinha = {
  id: string;
  item_id?: string;
  nome: string;
  quantidade: number | string;
  custo_unitario: number;
};

export type MaquinaBrindesLinha = {
  equipamentoId: string;
  brindes: BrindeMaquinaLinha[];
};

function brindeKey(item: { item_id?: string; nome: string }): string {
  return item.item_id ?? item.nome;
}

export function flattenBrindesMaquinas(
  maquinas: MaquinaBrindesLinha[],
  exclude?: { equipamentoId: string; brindeId: string }
): BrindeEntreguePonto[] {
  return maquinas.flatMap((maquina) =>
    maquina.brindes
      .filter(
        (brinde) =>
          !(
            exclude &&
            maquina.equipamentoId === exclude.equipamentoId &&
            brinde.id === exclude.brindeId
          )
      )
      .map((brinde) => ({
        item_id: brinde.item_id,
        nome: brinde.nome,
        quantidade: Math.max(0, Math.floor(Number(brinde.quantidade) || 0)),
        custo_unitario: Math.max(0, Number(brinde.custo_unitario) || 0),
      }))
      .filter((brinde) => brinde.nome && brinde.quantidade > 0)
  );
}

export function quantidadeRestanteBrindeColeta(
  estoque: EstoqueBrindePonto[],
  maquinas: MaquinaBrindesLinha[],
  item: { item_id?: string; nome: string },
  exclude?: { equipamentoId: string; brindeId: string }
): number {
  return quantidadeRestanteBrindeNoPonto(
    estoque,
    flattenBrindesMaquinas(maquinas, exclude),
    item
  );
}

export function maxQuantidadeBrindeMaquina(
  estoque: EstoqueBrindePonto[],
  maquinas: MaquinaBrindesLinha[],
  equipamentoId: string,
  brindeId: string
): number {
  const maquina = maquinas.find((item) => item.equipamentoId === equipamentoId);
  const brinde = maquina?.brindes.find((item) => item.id === brindeId);
  if (!brinde) return 0;
  return quantidadeRestanteBrindeColeta(estoque, maquinas, brinde, {
    equipamentoId,
    brindeId,
  });
}

export function maquinaJaTemBrinde(
  maquina: MaquinaBrindesLinha,
  item: EstoqueBrindePonto
): boolean {
  const key = brindeKey(item);
  return maquina.brindes.some((brinde) => brindeKey(brinde) === key);
}

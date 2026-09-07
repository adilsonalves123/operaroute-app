export function filtrarPontosClientes<T extends { id: string }>(
  pontos: T[],
  visaoRestrita: boolean,
  pontoIds: string[]
): T[] {
  if (!visaoRestrita) return pontos;
  if (pontoIds.length === 0) return [];
  const set = new Set(pontoIds);
  return pontos.filter((p) => set.has(p.id));
}

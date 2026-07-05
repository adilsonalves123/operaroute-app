/**
 * Contadores de máquina (centésimos) vs valores financeiros (reais).
 * Fronteira: persistência divide centésimos por 100 para reais.
 */

export function reaisToCentesimos(reais: number): number {
  return Math.round(reais * 100);
}

export function centesimosToReais(centesimos: number): number {
  return centesimos / 100;
}

/** Ex: 18578885 → "185.788,85" */
export function formatContador(centesimos: number): string {
  const reais = centesimosToReais(centesimos);
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(reais);
}

/** Remove máscara e retorna centésimos inteiros */
export function parseContadorInput(raw: string): number {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return 0;
  return parseInt(digits, 10);
}

/** Máscara enquanto digita: últimos 2 dígitos = decimais */
export function formatContadorInput(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  const padded = digits.padStart(3, "0");
  const dec = padded.slice(-2);
  const intPart = padded.slice(0, -2).replace(/^0+(?=\d)/, "") || "0";
  const withThousands = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${withThousands},${dec}`;
}

export function validarLeitura(
  anterior: number,
  atual: number,
  label: string
): string | null {
  if (atual < anterior) {
    return `${label} atual (${formatContador(atual)}) não pode ser menor que a anterior (${formatContador(anterior)})`;
  }
  return null;
}

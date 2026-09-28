/** Código único do envio (gerado no celular) — mesmo código = mesma coleta. */
export const HEADER_ENVIO_ID = "x-envio-id";

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Coleta guardada no celular aceita data de até 7 dias atrás. */
const MAX_ATRASO_MS = 7 * 24 * 60 * 60 * 1000;
/** Menos que isso é praticamente "agora": usa o relógio do servidor. */
const MIN_ATRASO_MS = 2 * 60 * 1000;

/**
 * Valores que o operador viu na tela e que dependem do banco (podem ter mudado
 * até o envio): dívida do ponto, haver, negativo, contadores anteriores…
 * Chave → valor. Contadores usam `contador:<equipamentoId>:<campo>`.
 */
export type ValoresLidos = Record<string, number>;

/** Anexado ao corpo da coleta quando ela sai da fila offline. */
export type EnvioOffline = {
  coletado_em: string;
  ponto_nome?: string | null;
  previsto?: ValoresLidos;
};

export function lerEnvioOffline(body: unknown): EnvioOffline | null {
  const raw = (body as { envio_offline?: unknown } | null)?.envio_offline;
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.coletado_em !== "string") return null;
  const previsto: ValoresLidos = {};
  if (r.previsto && typeof r.previsto === "object") {
    for (const [k, v] of Object.entries(r.previsto as Record<string, unknown>)) {
      const n = Number(v);
      if (Number.isFinite(n)) previsto[k] = n;
    }
  }
  return {
    coletado_em: r.coletado_em,
    ponto_nome: typeof r.ponto_nome === "string" ? r.ponto_nome : null,
    previsto,
  };
}

/**
 * Quando a coleta foi feita de verdade (fila offline). Null = usar agora.
 * Ignora datas no futuro ou muito antigas (relógio do celular errado).
 */
export function coletadoEmDoEnvio(body: unknown, agora = new Date()): Date | null {
  const envio = lerEnvioOffline(body);
  if (!envio) return null;
  const d = new Date(envio.coletado_em);
  if (!Number.isFinite(d.getTime())) return null;
  const atraso = agora.getTime() - d.getTime();
  if (atraso < MIN_ATRASO_MS || atraso > MAX_ATRASO_MS) return null;
  return d;
}

/**
 * O que o operador viu de dívida/haver ao cobrar — mesmas condições em que a
 * rota lê esses valores (`lido_no_envio`).
 */
export function previstoCobranca(opts: {
  cobrandoAgora: boolean;
  dividaPonto: number;
  descontarHaver: boolean;
  haverSaldo: number;
}): ValoresLidos {
  if (!opts.cobrandoAgora) return {};
  return {
    divida_ponto: opts.dividaPonto,
    ...(opts.descontarHaver ? { haver: opts.haverSaldo } : {}),
  };
}

const ROTULOS: Record<string, string> = {
  divida_ponto: "Dívida do ponto",
  haver: "Haver",
  negativo: "Negativo anterior",
  pendencia_operacao: "Pendência da operação",
};

function rotulo(chave: string): string {
  if (chave.startsWith("contador:")) {
    const campo = chave.split(":")[2];
    return campo === "saida" ? "Contador de saída anterior" : "Contador anterior";
  }
  return ROTULOS[chave] ?? chave;
}

function formatarValor(chave: string, v: number): string {
  if (chave.startsWith("contador:")) return String(Math.round(v));
  return `R$ ${v.toFixed(2).replace(".", ",")}`;
}

/** Diferenças entre o que o operador viu e o que o servidor leu no envio. */
export function diferencasLidas(
  previsto: ValoresLidos | undefined,
  lido: ValoresLidos | undefined
): string[] {
  if (!previsto || !lido) return [];
  const motivos: string[] = [];
  for (const [chave, visto] of Object.entries(previsto)) {
    const noEnvio = lido[chave];
    if (noEnvio == null || !Number.isFinite(noEnvio)) continue;
    // 1 centavo de arredondamento entre somas feitas em ordem diferente não conta.
    const tolerancia = chave.startsWith("contador:") ? 0.5 : 0.015;
    if (Math.abs(noEnvio - visto) > tolerancia) {
      motivos.push(
        `${rotulo(chave)}: ${formatarValor(chave, visto)} na coleta, ${formatarValor(chave, noEnvio)} no envio`
      );
    }
  }
  return motivos;
}

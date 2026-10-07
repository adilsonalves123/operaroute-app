import { createClient } from "@/lib/supabase/client";
import { HEADER_ENVIO_ID, type ValoresLidos } from "@/lib/coletas/envio-offline";
import {
  arquivoParaUpload,
  caminhoFotoMaquina,
  enviarFotoColeta,
  mimeTypeFoto,
  urlPublicaFotoColeta,
} from "@/lib/storage/coleta-fotos";
import {
  atualizarEnvio,
  filaDisponivel,
  guardarNaFila,
  lerFoto,
  listarFila,
  removerEnvio,
  type EnvioFila,
  type FotoFila,
} from "@/lib/offline/fila-db";

const TIMEOUT_FOTO_MS = 30_000;
const TIMEOUT_ENVIO_MS = 45_000;
const MAX_TENTATIVAS_5XX = 5;
/** Gateway fora do ar / sem resposta: o app pode nem ter recebido — tenta de novo depois. */
const STATUS_SEM_RESPOSTA = new Set([502, 503, 504]);

class SemSinalError extends Error {
  constructor() {
    super("Sem sinal");
    this.name = "SemSinalError";
  }
}

export function semSinalAgora(): boolean {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

export function ehFalhaDeRede(err: unknown): boolean {
  if (semSinalAgora() || err instanceof SemSinalError) return true;
  const msg = err instanceof Error ? `${err.name} ${err.message}` : String(err);
  return /failed to fetch|networkerror|network request failed|load failed|fetch failed|timeout|aborterror|aborted|ERR_INTERNET|ERR_NETWORK/i.test(
    msg
  );
}

function comTempo<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new SemSinalError()), ms);
    promise.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      }
    );
  });
}

async function postarComChave(url: string, body: unknown, envioId: string): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_ENVIO_MS);
  try {
    return await fetch(url, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json", [HEADER_ENVIO_ID]: envioId },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
  } finally {
    clearTimeout(t);
  }
}

export type FotoGuardada = Omit<FotoFila, "envio_id">;

export type FotoParaSubir = { chave: string; path: string; file: File };

/**
 * Sobe as fotos; se faltar sinal, devolve a URL final mesmo assim e guarda a foto
 * no celular para subir junto com a coleta quando o sinal voltar.
 */
export async function subirFotosOuGuardar(
  itens: FotoParaSubir[]
): Promise<{ urls: Map<string, string>; pendentes: FotoGuardada[] }> {
  const supabase = createClient();
  const urls = new Map<string, string>();
  const pendentes: FotoGuardada[] = [];
  const podeGuardar = filaDisponivel();

  await Promise.all(
    itens.map(async ({ chave, path, file }) => {
      const contentType = mimeTypeFoto(file);
      try {
        if (podeGuardar && semSinalAgora()) throw new SemSinalError();
        await comTempo(enviarFotoColeta(supabase, path, file, contentType), TIMEOUT_FOTO_MS);
      } catch {
        // Foto que falha não cancela a leitura. O corpo já leva a URL.
        if (podeGuardar) pendentes.push({ path, blob: file, content_type: contentType });
      }
      urls.set(chave, urlPublicaFotoColeta(supabase, path));
    })
  );

  return { urls, pendentes };
}

/** Atalho para as fotos de máquina (uma por equipamento). */
export function subirFotosMaquinasOuGuardar(
  empresaId: string,
  visitaFolder: string,
  fotos: { equipamentoId: string; file: File }[]
) {
  return subirFotosOuGuardar(
    fotos.map(({ equipamentoId, file }) => ({
      chave: equipamentoId,
      path: caminhoFotoMaquina(empresaId, equipamentoId, file, visitaFolder),
      file,
    }))
  );
}

export type ResultadoEnvioColeta =
  | { tipo: "enviado"; res: Response; data: Record<string, unknown> }
  | { tipo: "guardado" };

export type PedidoDepois = { url: string; body: Record<string, unknown>; titulo: string };

/**
 * Envia a coleta com código único. Sem sinal (ou com coletas mais antigas
 * esperando), guarda no celular e manda sozinho quando o sinal voltar.
 */
export async function enviarColeta(opts: {
  envioId: string;
  url: string;
  body: Record<string, unknown>;
  titulo: string;
  pontoNome?: string | null;
  /** Valores que o operador viu (dívida, haver, contadores) — conferidos no envio. */
  previsto?: ValoresLidos;
  fotosPendentes?: FotoGuardada[];
  /** Pedido que só deve sair depois desta coleta (ex.: finalizar a visita). */
  depois?: PedidoDepois | null;
  /** Edição de coleta precisa de internet (são dois pedidos em sequência). */
  permitirFila?: boolean;
}): Promise<ResultadoEnvioColeta> {
  const coletadoEm = new Date().toISOString();
  const fotosPendentes = opts.fotosPendentes ?? [];
  const podeGuardar = filaDisponivel() && opts.permitirFila !== false;

  if (!podeGuardar && fotosPendentes.length > 0) {
    throw new Error("Sem sinal para subir as fotos. Tente de novo quando a internet voltar.");
  }

  const guardar = async (): Promise<ResultadoEnvioColeta> => {
    await guardarNaFila(
      {
        id: opts.envioId,
        url: opts.url,
        body: {
          ...opts.body,
          envio_offline: {
            coletado_em: coletadoEm,
            ponto_nome: opts.pontoNome ?? null,
            previsto: opts.previsto ?? {},
          },
        },
        fotos: [],
        titulo: opts.titulo,
        ponto_nome: opts.pontoNome ?? null,
        criado_em: coletadoEm,
        depende_de: null,
      },
      fotosPendentes
    );
    if (opts.depois) {
      await guardarNaFila(
        {
          id: crypto.randomUUID(),
          url: opts.depois.url,
          body: opts.depois.body,
          fotos: [],
          titulo: opts.depois.titulo,
          ponto_nome: opts.pontoNome ?? null,
          criado_em: coletadoEm,
          depende_de: opts.envioId,
        },
        []
      );
    }
    void sincronizarFila();
    return { tipo: "guardado" };
  };

  if (podeGuardar) {
    if (semSinalAgora() || (await temEnviosAguardando())) {
      return guardar();
    }
  }

  let res: Response;
  try {
    res = await postarComChave(opts.url, opts.body, opts.envioId);
  } catch (err) {
    if (podeGuardar && ehFalhaDeRede(err)) return guardar();
    if (ehFalhaDeRede(err)) {
      throw new Error("Sem sinal. Tente de novo quando a internet voltar.");
    }
    throw err;
  }
  if (podeGuardar && STATUS_SEM_RESPOSTA.has(res.status)) return guardar();

  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (
    fotosPendentes.length > 0 &&
    (res.ok || (res.status === 409 && data.already_done === true))
  ) {
    await tentarFotosSoltas(createClient(), fotosPendentes);
  }
  return { tipo: "enviado", res, data };
}

export function erroDaResposta(data: Record<string, unknown>, padrao: string): string {
  return typeof data.error === "string" && data.error.trim() ? data.error : padrao;
}

async function temEnviosAguardando(): Promise<boolean> {
  try {
    const itens = await listarFila();
    return itens.some((i) => i.status !== "erro");
  } catch {
    return false;
  }
}

export type ResumoSincronizacao = {
  enviados: number;
  revisar: string[];
  precisaLogin: boolean;
};

const RESUMO_VAZIO: ResumoSincronizacao = { enviados: 0, revisar: [], precisaLogin: false };

let emAndamento: Promise<ResumoSincronizacao> | null = null;

/** Manda o que está guardado, na ordem em que as coletas foram feitas. */
export function sincronizarFila(opts?: {
  /** Botão Enviar agora: tenta de novo o que já tinha sido recusado. */
  incluirErros?: boolean;
}): Promise<ResumoSincronizacao> {
  if (emAndamento) return emAndamento;
  const incluirErros = opts?.incluirErros === true;
  emAndamento = (async () => {
    try {
      if (!filaDisponivel() || semSinalAgora()) return RESUMO_VAZIO;
      const locks = typeof navigator !== "undefined" ? navigator.locks : undefined;
      if (!locks) return await rodarSincronizacao(incluirErros);
      // Duas abas abertas não mandam a mesma fila ao mesmo tempo.
      const r = await locks.request(
        "operaroute-fila-coletas",
        { ifAvailable: true },
        async (lock) => (lock ? rodarSincronizacao(incluirErros) : RESUMO_VAZIO)
      );
      return r ?? RESUMO_VAZIO;
    } catch {
      return RESUMO_VAZIO;
    } finally {
      emAndamento = null;
    }
  })();
  return emAndamento;
}

function mensagemErro(data: Record<string, unknown>, status: number): string {
  return typeof data.error === "string" && data.error.trim()
    ? data.error
    : `O servidor recusou (erro ${status}).`;
}

async function rodarSincronizacao(incluirErros = false): Promise<ResumoSincronizacao> {
  const itens = await listarFila();
  const naFila = new Set(itens.map((i) => i.id));
  const resumo: ResumoSincronizacao = { enviados: 0, revisar: [], precisaLogin: false };
  const supabase = createClient();

  for (const item of itens) {
    if (item.status === "erro" && !incluirErros) continue;
    if (item.depende_de && naFila.has(item.depende_de)) continue;

    let res: Response;
    try {
      res = await postarComChave(item.url, item.body, item.id);
    } catch (err) {
      if (ehFalhaDeRede(err)) return resumo;
      await atualizarEnvio(item.id, {
        status: "erro",
        erro: err instanceof Error ? err.message : "Erro ao enviar.",
        tentativas: item.tentativas + 1,
      });
      continue;
    }
    if (STATUS_SEM_RESPOSTA.has(res.status)) return resumo;

    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;

    if (res.ok || (res.status === 409 && data.already_done === true)) {
      await tentarFotosDepois(supabase, item);
      await removerEnvio(item.id);
      naFila.delete(item.id);
      resumo.enviados += 1;
      if (Array.isArray(data.revisar)) {
        const nome = item.ponto_nome ? `${item.ponto_nome}: ` : "";
        for (const m of data.revisar) if (typeof m === "string") resumo.revisar.push(nome + m);
      }
      continue;
    }

    if (res.status === 409 && data.code === "envio_processando") return resumo;

    const semSessao =
      res.status === 401 ||
      (res.status === 404 && /empresa n[aã]o encontrada/i.test(String(data.error ?? "")));
    if (semSessao) {
      await atualizarEnvio(item.id, {
        status: "login",
        erro: "Entre de novo no app para enviar.",
      });
      resumo.precisaLogin = true;
      return resumo;
    }

    const tentativas = item.tentativas + 1;
    if (res.status >= 500 && tentativas < MAX_TENTATIVAS_5XX) {
      await atualizarEnvio(item.id, { status: "pendente", tentativas, erro: mensagemErro(data, res.status) });
      return resumo;
    }
    await atualizarEnvio(item.id, { status: "erro", tentativas, erro: mensagemErro(data, res.status) });
  }

  return resumo;
}

/** Uma tentativa depois que a leitura já entrou. Falha não segura a fila. */
async function tentarFotosDepois(
  supabase: ReturnType<typeof createClient>,
  item: EnvioFila
): Promise<void> {
  for (const path of item.fotos) {
    const foto = await lerFoto(path);
    if (!foto || !arquivoParaUpload(path, foto.blob, foto.content_type)) continue;
    try {
      await comTempo(
        enviarFotoColeta(supabase, path, foto.blob, foto.content_type),
        TIMEOUT_FOTO_MS
      );
    } catch {
      return;
    }
  }
}

async function tentarFotosSoltas(
  supabase: ReturnType<typeof createClient>,
  fotos: FotoGuardada[]
): Promise<void> {
  for (const foto of fotos) {
    if (!arquivoParaUpload(foto.path, foto.blob, foto.content_type)) continue;
    try {
      await comTempo(
        enviarFotoColeta(supabase, foto.path, foto.blob, foto.content_type),
        TIMEOUT_FOTO_MS
      );
    } catch {
      return;
    }
  }
}

export async function tentarEnvioDeNovo(id: string): Promise<void> {
  await atualizarEnvio(id, { status: "pendente", erro: null, tentativas: 0 });
  void sincronizarFila();
}

/** Descarta o envio e o que dependia dele (ex.: finalizar a visita daquela coleta). */
export async function descartarEnvio(id: string): Promise<void> {
  const itens = await listarFila();
  const remover = new Set([id]);
  let mudou = true;
  while (mudou) {
    mudou = false;
    for (const i of itens) {
      if (i.depende_de && remover.has(i.depende_de) && !remover.has(i.id)) {
        remover.add(i.id);
        mudou = true;
      }
    }
  }
  for (const r of remover) await removerEnvio(r);
}

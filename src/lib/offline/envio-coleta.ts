import { createClient } from "@/lib/supabase/client";
import { HEADER_ENVIO_ID, type ValoresLidos } from "@/lib/coletas/envio-offline";
import { comprimirImagemParaJpeg } from "@/lib/storage/comprimir-foto-cliente";
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
 * Monta a URL da foto na hora. A leitura não espera o arquivo.
 * `subirAgora` só na edição, que precisa da imagem no storage antes de gravar.
 */
export async function subirFotosOuGuardar(
  itens: FotoParaSubir[],
  opts?: { subirAgora?: boolean }
): Promise<{ urls: Map<string, string>; pendentes: FotoGuardada[] }> {
  const supabase = createClient();
  const urls = new Map<string, string>();
  const pendentes: FotoGuardada[] = [];
  const podeGuardar = filaDisponivel();
  const subirAgora = !opts || opts.subirAgora !== false;

  await Promise.all(
    itens.map(async ({ chave, path, file }) => {
      const leve = await deixarFotoLeve(file);
      const pathFinal = leve.contentType === "image/jpeg" ? caminhoJpeg(path) : path;
      urls.set(chave, urlPublicaFotoColeta(supabase, pathFinal));
      const guardada: FotoGuardada = {
        path: pathFinal,
        blob: leve.blob,
        content_type: leve.contentType,
      };
      if (!subirAgora && podeGuardar) {
        pendentes.push(guardada);
        return;
      }
      try {
        if (podeGuardar && semSinalAgora()) throw new SemSinalError();
        await comTempo(
          enviarFotoColeta(supabase, pathFinal, leve.blob, leve.contentType),
          TIMEOUT_FOTO_MS
        );
      } catch {
        if (podeGuardar) pendentes.push(guardada);
      }
    })
  );

  return { urls, pendentes };
}

/** Atalho para as fotos de máquina (uma por equipamento). */
export function subirFotosMaquinasOuGuardar(
  empresaId: string,
  visitaFolder: string,
  fotos: { equipamentoId: string; file: File }[],
  opts?: { subirAgora?: boolean }
) {
  return subirFotosOuGuardar(
    fotos.map(({ equipamentoId, file }) => ({
      chave: equipamentoId,
      path: caminhoFotoMaquina(empresaId, equipamentoId, file, visitaFolder),
      file,
    })),
    opts
  );
}

export type ResultadoEnvioColeta =
  | { tipo: "enviado"; res: Response; data: Record<string, unknown> }
  | { tipo: "guardado" };

export type PedidoDepois = { url: string; body: Record<string, unknown>; titulo: string };

/**
 * Envia a coleta com código único. Sem sinal, guarda no celular.
 * Com internet, a leitura sobe na hora — uma foto ou um envio antigo não segura.
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

  if (podeGuardar && semSinalAgora()) return guardar();

  if (podeGuardar && (await temEnviosAguardando())) {
    await sincronizarFila();
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
    lembrarFotos(fotosPendentes, opts.pontoNome ?? null);
  }
  return { tipo: "enviado", res, data };
}

export function erroDaResposta(data: Record<string, unknown>, padrao: string): string {
  return typeof data.error === "string" && data.error.trim() ? data.error : padrao;
}

async function temEnviosAguardando(): Promise<boolean> {
  try {
    const itens = await listarFila();
    return itens.some((i) => i.status === "pendente" || i.status === "login");
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

  for (const item of itens) {
    if (item.status === "erro" && !incluirErros) continue;
    if (item.depende_de && naFila.has(item.depende_de)) continue;

    if (item.status === "fotos" || !item.url) {
      const fotos = await copiarFotos(item);
      await removerEnvio(item.id);
      naFila.delete(item.id);
      lembrarFotos(fotos, item.ponto_nome);
      continue;
    }

    let res: Response;
    try {
      res = await postarComChave(item.url, item.body, item.id);
    } catch (err) {
      if (ehFalhaDeRede(err)) {
        await atualizarEnvio(item.id, {
          status: "pendente",
          erro: "A internet não respondeu agora.",
          tentativas: item.tentativas + 1,
        });
        return resumo;
      }
      await atualizarEnvio(item.id, {
        status: "erro",
        erro: err instanceof Error ? err.message : "Erro ao enviar.",
        tentativas: item.tentativas + 1,
      });
      continue;
    }
    if (STATUS_SEM_RESPOSTA.has(res.status)) {
      const tentativas = item.tentativas + 1;
      await atualizarEnvio(item.id, {
        status: tentativas < MAX_TENTATIVAS_5XX ? "pendente" : "erro",
        tentativas,
        erro: `O servidor não respondeu (erro ${res.status}).`,
      });
      continue;
    }

    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;

    if (res.ok || (res.status === 409 && data.already_done === true)) {
      const fotos = await copiarFotos(item);
      await removerEnvio(item.id);
      naFila.delete(item.id);
      resumo.enviados += 1;
      if (Array.isArray(data.revisar)) {
        const nome = item.ponto_nome ? `${item.ponto_nome}: ` : "";
        for (const m of data.revisar) if (typeof m === "string") resumo.revisar.push(nome + m);
      }
      lembrarFotos(fotos, item.ponto_nome);
      continue;
    }

    if (res.status === 409 && data.code === "envio_processando") {
      await atualizarEnvio(item.id, {
        status: "pendente",
        erro: "O servidor ainda está gravando esta coleta.",
      });
      continue;
    }

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
      continue;
    }
    await atualizarEnvio(item.id, { status: "erro", tentativas, erro: mensagemErro(data, res.status) });
  }

  return resumo;
}

/** Copia os bytes antes de apagar a fila. Se a foto não abrir, a leitura segue sem ela. */
async function copiarFotos(item: EnvioFila): Promise<FotoGuardada[]> {
  const saida: FotoGuardada[] = [];
  for (const path of item.fotos) {
    try {
      const foto = await comTempo(lerFoto(path), 8_000);
      if (!foto?.blob || foto.blob.size <= 0) continue;
      saida.push({
        path,
        blob: foto.blob,
        content_type: foto.content_type || "image/jpeg",
      });
    } catch {
      continue;
    }
  }
  return saida;
}

/** Sobe o que der. O que falhar volta só como foto — a leitura não fica presa. */
function lembrarFotos(fotos: FotoGuardada[], pontoNome: string | null) {
  if (!fotos.length || !filaDisponivel()) return;
  void (async () => {
    try {
      const falhas = await enviarListaDeFotos(createClient(), fotos);
      if (!falhas.length) return;
      await guardarNaFila(
        {
          id: crypto.randomUUID(),
          url: "",
          body: {},
          fotos: [],
          titulo: "Fotos da coleta",
          ponto_nome: pontoNome,
          criado_em: new Date().toISOString(),
          depende_de: null,
        },
        falhas,
        "fotos"
      );
    } catch {
      /* a leitura já entrou */
    }
  })();
}

async function enviarListaDeFotos(
  supabase: ReturnType<typeof createClient>,
  fotos: FotoGuardada[]
): Promise<FotoGuardada[]> {
  const resultados = await Promise.all(
    fotos.map(async (foto) => {
      const leve = await deixarFotoLeve(foto.blob);
      const pronta: FotoGuardada = {
        path: foto.path,
        blob: leve.blob,
        content_type: leve.contentType,
      };
      try {
        if (!arquivoParaUpload(pronta.path, pronta.blob, pronta.content_type)) return null;
        await comTempo(
          enviarFotoColeta(supabase, pronta.path, pronta.blob, pronta.content_type),
          TIMEOUT_FOTO_MS
        );
        return null;
      } catch {
        return pronta;
      }
    })
  );
  return resultados.filter((foto): foto is FotoGuardada => foto !== null);
}

/** Foto de celular vira JPEG menor. O contador continua legível e o envio cabe no sinal. */
async function deixarFotoLeve(file: Blob): Promise<{ blob: Blob; contentType: string }> {
  const originalType = mimeTypeFoto(file);
  try {
    const jpeg = await comprimirImagemParaJpeg(file, { maxSide: 1600, maxBytes: 700_000 });
    if (jpeg.size > 0 && jpeg.size < file.size) {
      return { blob: jpeg, contentType: "image/jpeg" };
    }
  } catch {
    /* segue com o arquivo original */
  }
  return { blob: file, contentType: originalType };
}

function caminhoJpeg(path: string): string {
  if (/\.jpe?g$/i.test(path)) return path;
  return `${path.replace(/\.[a-z0-9]+$/i, "")}.jpg`;
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

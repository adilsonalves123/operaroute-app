const DB_NOME = "operaroute-offline";
const DB_VERSAO = 1;
const STORE_ENVIOS = "envios";
const STORE_FOTOS = "fotos";

export const EVENTO_FILA_MUDOU = "operaroute:fila-coletas";

export type StatusEnvioFila = "pendente" | "erro" | "login";

/** Uma requisição guardada no celular esperando sinal. */
export type EnvioFila = {
  /** Mesmo código vai no header `x-envio-id` — o servidor não lança duas vezes. */
  id: string;
  ordem: number;
  url: string;
  body: Record<string, unknown>;
  /** Fotos ainda no celular. A leitura sobe sem elas; a imagem tenta depois. */
  fotos: string[];
  titulo: string;
  ponto_nome: string | null;
  criado_em: string;
  /** Só envia depois que este outro envio saiu da fila (ex.: finalizar visita). */
  depende_de: string | null;
  status: StatusEnvioFila;
  tentativas: number;
  erro: string | null;
};

export type FotoFila = {
  path: string;
  envio_id: string;
  blob: Blob;
  content_type: string;
};

let dbPromise: Promise<IDBDatabase> | null = null;

export function filaDisponivel(): boolean {
  return typeof window !== "undefined" && typeof indexedDB !== "undefined";
}

function abrir(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NOME, DB_VERSAO);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_ENVIOS)) {
        db.createObjectStore(STORE_ENVIOS, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(STORE_FOTOS)) {
        const fotos = db.createObjectStore(STORE_FOTOS, { keyPath: "path" });
        fotos.createIndex("envio_id", "envio_id", { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      dbPromise = null;
      reject(req.error ?? new Error("Não foi possível abrir o armazenamento do celular."));
    };
  });
  return dbPromise;
}

function concluir(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("Erro ao gravar no celular."));
    tx.onabort = () => reject(tx.error ?? new Error("Gravação no celular cancelada."));
  });
}

function pedido<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function avisarMudanca() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(EVENTO_FILA_MUDOU));
  }
}

let ultimaOrdem = 0;
function proximaOrdem(): number {
  ultimaOrdem = Math.max(Date.now(), ultimaOrdem + 1);
  return ultimaOrdem;
}

export async function guardarNaFila(
  envio: Omit<EnvioFila, "ordem" | "status" | "tentativas" | "erro">,
  fotos: Omit<FotoFila, "envio_id">[]
): Promise<void> {
  const db = await abrir();
  const tx = db.transaction([STORE_ENVIOS, STORE_FOTOS], "readwrite");
  const registro: EnvioFila = {
    ...envio,
    fotos: fotos.map((f) => f.path),
    ordem: proximaOrdem(),
    status: "pendente",
    tentativas: 0,
    erro: null,
  };
  tx.objectStore(STORE_ENVIOS).put(registro);
  for (const f of fotos) {
    tx.objectStore(STORE_FOTOS).put({ ...f, envio_id: envio.id });
  }
  await concluir(tx);
  avisarMudanca();
}

export async function listarFila(): Promise<EnvioFila[]> {
  if (!filaDisponivel()) return [];
  const db = await abrir();
  const tx = db.transaction(STORE_ENVIOS, "readonly");
  const itens = await pedido(tx.objectStore(STORE_ENVIOS).getAll() as IDBRequest<EnvioFila[]>);
  return itens.sort((a, b) => a.ordem - b.ordem);
}

export async function lerFoto(path: string): Promise<FotoFila | null> {
  const db = await abrir();
  const tx = db.transaction(STORE_FOTOS, "readonly");
  const foto = await pedido(tx.objectStore(STORE_FOTOS).get(path) as IDBRequest<FotoFila | undefined>);
  return foto ?? null;
}

export async function removerFotoDaFila(envioId: string, path: string): Promise<void> {
  const db = await abrir();
  const tx = db.transaction([STORE_ENVIOS, STORE_FOTOS], "readwrite");
  tx.objectStore(STORE_FOTOS).delete(path);
  const envios = tx.objectStore(STORE_ENVIOS);
  const atual = await pedido(envios.get(envioId) as IDBRequest<EnvioFila | undefined>);
  if (atual) envios.put({ ...atual, fotos: atual.fotos.filter((p) => p !== path) });
  await concluir(tx);
}

export async function atualizarEnvio(
  id: string,
  patch: Partial<Pick<EnvioFila, "status" | "tentativas" | "erro">>
): Promise<void> {
  const db = await abrir();
  const tx = db.transaction(STORE_ENVIOS, "readwrite");
  const store = tx.objectStore(STORE_ENVIOS);
  const atual = await pedido(store.get(id) as IDBRequest<EnvioFila | undefined>);
  if (atual) store.put({ ...atual, ...patch });
  await concluir(tx);
  avisarMudanca();
}

export async function removerEnvio(id: string): Promise<void> {
  const db = await abrir();
  const tx = db.transaction([STORE_ENVIOS, STORE_FOTOS], "readwrite");
  tx.objectStore(STORE_ENVIOS).delete(id);
  const fotos = tx.objectStore(STORE_FOTOS);
  const paths = await pedido(fotos.index("envio_id").getAllKeys(id));
  for (const p of paths) fotos.delete(p);
  await concluir(tx);
  avisarMudanca();
}

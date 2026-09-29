/** Dados da rota guardados no celular para abrir as telas de campo sem internet.
 *  Nomes de banco/cache precisam bater com public/sw-offline.js. */

import { CHAVE_EMPRESA_LEMBRADA } from "@/lib/supabase/empresa";

const DB_NOME = "operaroute-campo";
const DB_VERSAO = 1;
const STORE_TABELAS = "tabelas";
const STORE_META = "meta";
const CHAVE_META = "estado";

export const PREFIXO_CACHE_CAMPO = "or-campo-";
export const CACHE_PAGINAS = "or-campo-paginas-v1";
export const CACHE_ESTATICOS = "or-campo-estaticos-v1";
export const CACHE_DADOS = "or-campo-dados-v1";
export const HEADER_SALVO_EM = "x-or-salvo-em";

export const EVENTO_CAMPO_MUDOU = "operaroute:campo-offline";

export type EscopoRetrato = {
  /** Filtros usados no download (ex.: pendências só "aberta"). */
  obrigatorios?: Record<string, string>;
  /** A consulta precisa filtrar por uma destas colunas. */
  chaves?: string[];
};

export type LinhaRetrato = Record<string, unknown>;

export type RetratoTabela = {
  nome: string;
  linhas: LinhaRetrato[];
  escopo: EscopoRetrato | null;
  salvo_em: number;
};

export type MetaCampo = {
  chave: typeof CHAVE_META;
  dono: string | null;
  empresa_id: string | null;
  nome_operacao: string | null;
  nichos: string[];
  preparado_em: number | null;
};

let dbPromise: Promise<IDBDatabase> | null = null;

export function campoDisponivel(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof indexedDB !== "undefined" &&
    typeof caches !== "undefined"
  );
}

function abrir(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NOME, DB_VERSAO);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_TABELAS)) {
        db.createObjectStore(STORE_TABELAS, { keyPath: "nome" });
      }
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META, { keyPath: "chave" });
      }
    };
    req.onsuccess = () => {
      const db = req.result;
      db.onversionchange = () => {
        db.close();
        dbPromise = null;
      };
      resolve(db);
    };
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

function ler<T>(store: string, chave: string): Promise<T | null> {
  return abrir().then(
    (db) =>
      new Promise<T | null>((resolve, reject) => {
        const r = db.transaction(store, "readonly").objectStore(store).get(chave);
        r.onsuccess = () => resolve((r.result as T | undefined) ?? null);
        r.onerror = () => reject(r.error);
      })
  );
}

export async function salvarTabelas(retratos: RetratoTabela[]): Promise<void> {
  if (retratos.length === 0) return;
  const db = await abrir();
  const tx = db.transaction(STORE_TABELAS, "readwrite");
  const store = tx.objectStore(STORE_TABELAS);
  for (const r of retratos) store.put(r);
  await concluir(tx);
}

export function lerTabela(nome: string): Promise<RetratoTabela | null> {
  return ler<RetratoTabela>(STORE_TABELAS, nome);
}

export function lerMeta(): Promise<MetaCampo | null> {
  return ler<MetaCampo>(STORE_META, CHAVE_META);
}

export async function salvarMeta(parcial: Partial<Omit<MetaCampo, "chave">>): Promise<MetaCampo> {
  const atual = await lerMeta();
  const meta: MetaCampo = {
    chave: CHAVE_META,
    dono: null,
    empresa_id: null,
    nome_operacao: null,
    nichos: [],
    preparado_em: null,
    ...(atual ?? {}),
    ...parcial,
  };
  const db = await abrir();
  const tx = db.transaction(STORE_META, "readwrite");
  tx.objectStore(STORE_META).put(meta);
  await concluir(tx);
  return meta;
}

/** Apaga tudo que o modo campo guardou (não mexe na fila de coletas). */
export async function limparCampo(): Promise<void> {
  try {
    localStorage.removeItem(CHAVE_EMPRESA_LEMBRADA);
  } catch {
    /* ignore */
  }
  const nomes = await caches.keys().catch(() => [] as string[]);
  await Promise.all(
    nomes.filter((n) => n.startsWith(PREFIXO_CACHE_CAMPO)).map((n) => caches.delete(n))
  );
  const db = await abrir();
  const tx = db.transaction([STORE_TABELAS, STORE_META], "readwrite");
  tx.objectStore(STORE_TABELAS).clear();
  tx.objectStore(STORE_META).clear();
  await concluir(tx);
}

/** Se outra pessoa entrou neste aparelho, apaga os dados da anterior antes de qualquer coisa. */
export async function garantirDonoCampo(userId: string): Promise<void> {
  const meta = await lerMeta();
  if (meta?.dono && meta.dono !== userId) {
    await limparCampo();
  }
  if (!meta?.dono || meta.dono !== userId) {
    await salvarMeta({ dono: userId });
  }
}

export function avisarCampoMudou(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(EVENTO_CAMPO_MUDOU));
}

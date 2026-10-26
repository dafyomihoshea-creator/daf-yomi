// One small database interface for the site's data code (catalog, transcripts, YouTube sync,
// AI). The same modules run in the visitor's browser (Firebase web SDK, security rules decide
// what is allowed) and in the nightly worker (Admin SDK). Each side plugs in its own Store.
//
// Binary fields (gzip data) are always Uint8Array here; each Store converts to its SDK's type.

export type Op =
  | { type: "set"; path: string; data: Record<string, any>; merge?: boolean }
  | { type: "delete"; path: string };

export interface Store {
  get(path: string): Promise<Record<string, any> | null>;
  getMany(paths: string[]): Promise<Array<Record<string, any> | null>>;
  /** Every document of a small collection, with its id. */
  list(collection: string): Promise<Array<{ id: string; data: Record<string, any> }>>;
  set(path: string, data: Record<string, any>, merge?: boolean): Promise<void>;
  add(collection: string, data: Record<string, any>): Promise<string>;
  delete(path: string): Promise<void>;
  /** Write many changes; split into batches of up to 400. */
  commit(ops: Op[]): Promise<void>;
  /** A new random document id for this collection (no write). */
  newId(collection: string): string;
}

let current: Store | null = null;

export function setStore(s: Store) { current = s; }

export function store(): Store {
  if (!current) throw new Error("Database is not set up (setStore was not called)");
  return current;
}

/** Keys and addresses, filled in by the browser (build-time values) or the worker (env vars). */
export const config = {
  geminiKey: "",
  youtubeKey: "",
  siteUrl: "https://daf-yomi-hoshea.web.app",
  adminEmails: ["eytan@luz-law.org.il"] as string[],
};

// gzip with the built-in streams (browsers and Node 18+), so no zlib/Buffer is needed.
async function pipe(data: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Response(new Blob([data]).stream().pipeThrough(stream));
  return new Uint8Array(await out.arrayBuffer());
}

export function gzip(text: string): Promise<Uint8Array> {
  return pipe(new TextEncoder().encode(text), new CompressionStream("gzip"));
}

export async function gunzip(data: Uint8Array): Promise<string> {
  return new TextDecoder().decode(await pipe(data, new DecompressionStream("gzip")));
}

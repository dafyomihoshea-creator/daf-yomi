// Article files (PDFs) kept inside the database, split into pieces of up to 700 KB
// (/article_files/{articleId}_{n}), because free Firebase projects have no file storage.
// Article details live in /articles/{id} (file_chunks, file_mime).
import { store, type Op } from "./store";

const PIECE = 700_000;

export async function saveArticleFile(articleId: string, data: Uint8Array): Promise<number> {
  const ops: Op[] = [];
  for (let i = 0, n = 0; i < data.length; i += PIECE, n++) {
    ops.push({ type: "set", path: `article_files/${articleId}_${n}`, data: { data: data.slice(i, i + PIECE) } });
  }
  await store().commit(ops);
  return ops.length;
}

export async function loadArticleFile(articleId: string, chunks: number): Promise<Uint8Array> {
  const docs = await store().getMany(Array.from({ length: chunks }, (_, n) => `article_files/${articleId}_${n}`));
  const parts = docs.map(d => (d?.data as Uint8Array) || new Uint8Array());
  const out = new Uint8Array(parts.reduce((s, p) => s + p.length, 0));
  let at = 0;
  for (const p of parts) { out.set(p, at); at += p.length; }
  return out;
}

export async function deleteArticleFile(articleId: string, chunks: number) {
  await store().commit(Array.from({ length: chunks }, (_, n) => ({ type: "delete" as const, path: `article_files/${articleId}_${n}` })));
}

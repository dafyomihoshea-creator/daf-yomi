// Article files (PDFs) kept inside the database, split into pieces of up to 700 KB
// (/article_files/{articleId}_{n}), because free Firebase projects have no file storage.
// Article details live in /articles/{id} (file_chunks, file_mime).
//
// Word files: the managers may upload .doc/.docx. Such an article is saved with
// status "converting" and its id is added to app_meta/articles_pending; the nightly worker
// (worker/convert-articles.ts) turns it into a PDF with LibreOffice and publishes it.
// The public list hides articles that are not ready.
import { store, type Op } from "./store";

const PIECE = 700_000;
export const PENDING_DOC = "app_meta/articles_pending";

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

export function isWordFile(fileName: string) {
  return /\.(docx?|rtf|odt)$/i.test(fileName);
}

/** Ask the worker to convert these articles to PDF on its next run. */
export async function markPending(ids: string[]) {
  const prev: string[] = (await store().get(PENDING_DOC))?.ids || [];
  await store().set(PENDING_DOC, { ids: Array.from(new Set([...prev, ...ids])), updated_at: new Date().toISOString() });
}

export type Converter = (data: Uint8Array, fileName: string) => Promise<Uint8Array>;

/**
 * Convert every pending Word article to PDF. Reads one document when nothing waits.
 * An article that fails stays visible to the managers with status "convert_failed".
 */
export async function convertPendingArticles(convert: Converter) {
  const pending: string[] = (await store().get(PENDING_DOC))?.ids || [];
  const done: string[] = [];
  const failed: string[] = [];
  for (const id of pending) {
    const path = `articles/${id}`;
    const a = await store().get(path);
    if (!a || !a.file_chunks || a.file_type === "pdf") { done.push(id); continue; }
    try {
      const word = await loadArticleFile(id, a.file_chunks);
      const pdf = await convert(word, String(a.file_name || "article.docx"));
      if (!pdf.length || new TextDecoder().decode(pdf.slice(0, 5)) !== "%PDF-") throw new Error("not a PDF");
      // New file under new piece names first, then switch the article to it, then remove the old pieces.
      const oldChunks = a.file_chunks as number;
      const pdfId = `${id}_pdf`;
      const chunks = await saveArticleFile(pdfId, pdf);
      await store().set(path, {
        file_key: pdfId, file_chunks: chunks, file_mime: "application/pdf", file_type: "pdf",
        file_name: String(a.file_name || "article").replace(/\.[^.]+$/, "") + ".pdf",
        original_name: a.file_name || null, status: null, convert_error: null, converted_at: new Date().toISOString(),
      }, true);
      await deleteArticleFile(a.file_key || id, oldChunks);
      done.push(id);
    } catch (err: any) {
      await store().set(path, { status: "convert_failed", convert_error: String(err?.message || err).slice(0, 300) }, true);
      failed.push(id);
      done.push(id);
    }
  }
  if (pending.length) {
    // Keep ids added while this run was working.
    const now: string[] = (await store().get(PENDING_DOC))?.ids || [];
    await store().set(PENDING_DOC, { ids: now.filter(x => !done.includes(x)), updated_at: new Date().toISOString() });
  }
  return { pending: pending.length, converted: done.length - failed.length, failed: failed.length };
}

/** Where an article's file pieces are stored (converted files get their own key). */
export function fileKey(a: { id: string; file_key?: string | null }) {
  return a.file_key || a.id;
}

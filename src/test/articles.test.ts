import { describe, it, expect, beforeEach } from "vitest";
import { setStore, type Store } from "../../server/store";
import { convertPendingArticles, saveArticleFile, loadArticleFile, markPending, isWordFile, fileKey, PENDING_DOC } from "../../server/articles";

// A database in memory, enough for the article code.
function memoryStore(): Store & { docs: Map<string, any> } {
  const docs = new Map<string, any>();
  let n = 0;
  return {
    docs,
    async get(p) { return docs.has(p) ? { ...docs.get(p) } : null; },
    async getMany(ps) { return ps.map(p => (docs.has(p) ? { ...docs.get(p) } : null)); },
    async list(c) { return [...docs].filter(([k]) => k.startsWith(c + "/")).map(([k, v]) => ({ id: k.split("/")[1], data: v })); },
    async set(p, d, merge) { docs.set(p, merge ? { ...(docs.get(p) || {}), ...d } : { ...d }); },
    async add(c, d) { const id = `id${n++}`; docs.set(`${c}/${id}`, d); return id; },
    async delete(p) { docs.delete(p); },
    async commit(ops) { for (const o of ops) o.type === "set" ? docs.set(o.path, o.merge ? { ...(docs.get(o.path) || {}), ...o.data } : o.data) : docs.delete(o.path); },
    newId() { return `id${n++}`; },
  };
}

const bytes = (s: string) => new TextEncoder().encode(s);
let db: ReturnType<typeof memoryStore>;

async function addWordArticle(id: string, size = 10) {
  const chunks = await saveArticleFile(id, bytes("W".repeat(size)));
  await db.set(`articles/${id}`, { id, title: "t", file_chunks: chunks, file_type: "docx", file_name: "מאמר.docx", status: "converting" });
  await markPending([id]);
}

describe("Word articles become PDFs", () => {
  beforeEach(() => { db = memoryStore(); setStore(db); });

  it("recognizes Word files", () => {
    expect(isWordFile("a.docx")).toBe(true);
    expect(isWordFile("a.DOC")).toBe(true);
    expect(isWordFile("a.pdf")).toBe(false);
  });

  it("converts, publishes and removes the Word pieces", async () => {
    await addWordArticle("a1", 1_500_000); // three pieces
    const result = await convertPendingArticles(async () => bytes("%PDF-1.7 fake"));
    expect(result).toEqual({ pending: 1, converted: 1, failed: 0 });
    const a = (await db.get("articles/a1"))!;
    expect(a.status).toBeNull();
    expect(a.file_type).toBe("pdf");
    expect(a.file_name).toBe("מאמר.pdf");
    expect(new TextDecoder().decode(await loadArticleFile(fileKey(a as any), a.file_chunks))).toBe("%PDF-1.7 fake");
    expect(db.docs.has("article_files/a1_0")).toBe(false);
    expect(db.docs.has("article_files/a1_2")).toBe(false);
    expect((await db.get(PENDING_DOC))!.ids).toEqual([]);
  });

  it("marks a failed conversion and keeps the original file", async () => {
    await addWordArticle("a2");
    const result = await convertPendingArticles(async () => bytes("not a pdf"));
    expect(result.failed).toBe(1);
    const a = (await db.get("articles/a2"))!;
    expect(a.status).toBe("convert_failed");
    expect(db.docs.has("article_files/a2_0")).toBe(true);
    expect((await db.get(PENDING_DOC))!.ids).toEqual([]);
  });

  it("does nothing when no article waits", async () => {
    expect(await convertPendingArticles(async () => { throw new Error("should not run"); })).toEqual({ pending: 0, converted: 0, failed: 0 });
  });
});

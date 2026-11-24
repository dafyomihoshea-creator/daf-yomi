import { describe, it, expect, beforeEach } from "vitest";
import { setStore, type Store } from "../../server/store";
import { saveIndex, loadIndex, rankLessons, INDEX_META, type SearchIndex } from "../../server/search-index";
import { hasGarbledText } from "../../server/youtube";

function memoryStore(): Store & { docs: Map<string, any> } {
  const docs = new Map<string, any>();
  return {
    docs,
    async get(p) { return docs.has(p) ? { ...docs.get(p) } : null; },
    async getMany(ps) { return ps.map(p => (docs.has(p) ? { ...docs.get(p) } : null)); },
    async list() { return []; },
    async set(p, d, merge) { docs.set(p, merge ? { ...(docs.get(p) || {}), ...d } : { ...d }); },
    async add() { return "x"; },
    async delete(p) { docs.delete(p); },
    async commit(ops) { for (const o of ops) o.type === "set" ? docs.set(o.path, o.data) : docs.delete(o.path); },
    newId() { return "x"; },
  };
}

// Big enough to need several pieces.
function bigIndex(tag: string): SearchIndex {
  const rare: Record<string, string> = {};
  for (let i = 0; i < 200_000; i++) rare[`${tag}${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`] = "0";
  rare["בארות"] = "0";
  return { lessons: [{ id: "L1", m: "ברכות", d: 2, w: "בארות" }], rare, common: "" };
}

describe("chatbot index kept in the database", () => {
  let db: ReturnType<typeof memoryStore>;
  beforeEach(() => { db = memoryStore(); setStore(db); });

  it("saves in pieces, skips an unchanged index, removes old pieces, and loads back", async () => {
    const idx = bigIndex("a");
    const first = await saveIndex(idx);
    expect(first.changed).toBe(true);
    expect(first.pieces).toBeGreaterThan(1);
    const v1 = (await db.get(INDEX_META))!.version;

    expect((await saveIndex(idx)).changed).toBe(false);

    await new Promise(r => setTimeout(r, 5));
    await saveIndex(bigIndex("b"));
    const meta = (await db.get(INDEX_META))!;
    expect(meta.version).not.toBe(v1);
    expect([...db.docs.keys()].some(k => k.startsWith(`search_index/${v1}_`))).toBe(false);

    const found = await rankLessons("בארות", null, 5);
    expect(found.lessons.map(l => l.id)).toEqual(["L1"]);
    expect((await loadIndex()).lessons.length).toBe(1);
  });
});

describe("garbled summaries", () => {
  it("spots foreign letters inside Hebrew text", () => {
    expect(hasGarbledText("מונים אותם אחד-אواحد")).toBe(true);
    expect(hasGarbledText("מוze מונים")).toBe(true);
    expect(hasGarbledText("הגמרא דורשת את הפסוק \"כל חרם לא יפדה\".")).toBe(false);
    expect(hasGarbledText("רבי חנינא בן עקביא (Arachin)")).toBe(false);
  });
});

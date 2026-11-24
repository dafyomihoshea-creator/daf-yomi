// A keyword index of all lesson transcripts, so the chatbot can find which lessons talk
// about a question (in a whole tractate or the whole Shas) without reading every transcript.
// The nightly worker builds it (worker/build-static.ts → the database, see saveIndex); the
// browser reads it only when a signed-in visitor asks a tractate-wide or Shas-wide question.
//
// Two parts:
//  - lessons[].w: each lesson's most distinctive words (the topics of the lesson);
//  - rare: every word that appears in at most RARE_SHARE of the lessons (names, places, rare
//    terms) with ALL the lessons it appears in, so "where does the Rabbi mention X" finds the
//    lessons that say X even when X is only a passing remark. These words are kept exactly as
//    said (with prefix letters), so "בארות" is not confused with "הארות"; the question's word
//    is looked up with the usual prefixes added (בבארות, ובארות, ...). Words said in a
//    single lesson are kept too.
import type { Block } from "./transcript-format";
import { store, gzip, gunzip, type Op } from "./store";

export interface IndexEntry { id: string; m: string | null; d: number | null; w: string }
export interface SearchIndex { lessons: IndexEntry[]; rare: Record<string, string>; common: string }

const KEYWORDS_PER_LESSON = 120;
const RARE_SHARE = 0.15;
const PREFIX = /^[והבלמשכ]/;
const PREFIX_COMBOS = ["", "ו", "ה", "ב", "ל", "מ", "ש", "כ", "וה", "וב", "ול", "ומ", "וש", "וכ", "שה", "שב", "של", "שמ", "מה", "בה", "לה", "כש", "וכש", "שבה", "ובה", "ולה", "ומה", "ושה", "ושב"];
const STOP = new Set(["הושע", "רבינוביץ", "הרב", "מזכיר", "מזכירה", "הזכיר", "מספר", "סיפר", "מדבר", "מדובר", "שיעור", "שיעורים", "אילו", "איזה", "איזו", "אני", "אתה", "הוא", "היא", "אנחנו", "הם", "זה", "זאת", "זו", "את", "של", "על", "עם", "אם", "כי", "לא", "כן", "מה", "מי", "גם", "רק", "אבל", "או", "יש", "אין", "היה", "הייתה", "היו", "להיות", "כל", "כמו", "עוד", "אז", "פה", "שם", "אחד", "אחת", "שני", "הזה", "הזאת", "אותו", "אותה", "אלא", "כאן", "עכשיו", "בסדר", "טוב", "נכון", "אומר", "אומרת", "אמר", "רוצה", "צריך", "יכול", "בעצם", "פשוט", "כאילו", "דבר", "דברים", "ככה", "איך", "למה", "מתי", "איפה"]);

/**
 * Plain word form for matching: no vowel marks or punctuation, and the leading prefix letters
 * (ו ה ב ל מ ש כ) taken off long words, so "בארות", "בבארות" and "ובבארות" all match.
 */
export function normalizeWord(w: string): string {
  let s = cleanWord(w);
  for (let i = 0; i < 3 && s.length >= 5 && PREFIX.test(s); i++) s = s.slice(1);
  return s;
}

/** The word as said: only vowel marks and punctuation removed. */
function cleanWord(w: string): string {
  return w.replace(/[֑-ׇ]/g, "").replace(/[^א-תa-zA-Z0-9]/g, "");
}

export function words(text: string): string[] {
  return text.split(/\s+/).map(normalizeWord).filter(w => w.length >= 3 && !STOP.has(w));
}

function rawWords(text: string): string[] {
  return text.split(/\s+/).map(cleanWord).filter(w => w.length >= 3 && !STOP.has(w) && !STOP.has(normalizeWord(w)));
}

/** The forms a question word can take in the lessons: as written, with any prefix letters added. */
function forms(q: string): string[] {
  return PREFIX_COMBOS.map(p => p + q);
}

// Lesson numbers in `rare` are stored as gaps in base 36 ("0.5.1b" = lessons 0, 5, 52).
function encodeList(list: number[]): string {
  let prev = 0;
  return list.map(i => { const d = i - prev; prev = i; return d.toString(36); }).join(".");
}
function decodeList(s: string): number[] {
  let prev = 0;
  return s.split(".").map(p => (prev += parseInt(p, 36)));
}

export function buildIndex(lessons: Array<{ id: string; m: string | null; d: number | null; blocks: Block[] }>): SearchIndex {
  const tfs = lessons.map(l => {
    const tf = new Map<string, number>();
    for (const b of l.blocks) for (const w of words(b[1])) tf.set(w, (tf.get(w) || 0) + 1);
    return tf;
  });
  const df = new Map<string, number>();
  for (const tf of tfs) for (const w of tf.keys()) df.set(w, (df.get(w) || 0) + 1);
  const n = lessons.length;

  const raw = lessons.map(l => {
    const s = new Set<string>();
    for (const b of l.blocks) for (const w of rawWords(b[1])) s.add(w);
    return s;
  });
  const rawDf = new Map<string, number>();
  for (const s of raw) for (const w of s) rawDf.set(w, (rawDf.get(w) || 0) + 1);
  const rareLists = new Map<string, number[]>();
  raw.forEach((s, i) => {
    for (const w of s) {
      const c = rawDf.get(w) || 0;
      // Words in a single lesson stay too: a name the Rabbi mentioned once is just what people ask about.
      if (c > n * RARE_SHARE) continue;
      let list = rareLists.get(w);
      if (!list) rareLists.set(w, (list = []));
      list.push(i);
    }
  });
  const rare: Record<string, string> = {};
  for (const [w, list] of rareLists) rare[w] = encodeList(list);
  // Words said in many lessons: a question word among them is not looked up with prefixes
  // (else "שבת" would be found as the rare "כשבת").
  const common = Array.from(rawDf.entries()).filter(([, c]) => c > n * RARE_SHARE).map(([w]) => w).join(" ");

  const entries = lessons.map((l, i) => {
    const scored = Array.from(tfs[i].entries())
      .filter(([w]) => (df.get(w) || 0) < n * 0.5)
      .map(([w, c]) => [w, c * Math.log(n / (df.get(w) || 1))] as [string, number])
      .sort((a, b) => b[1] - a[1])
      .slice(0, KEYWORDS_PER_LESSON);
    return { id: l.id, m: l.m, d: l.d, w: scored.map(s => s[0]).join(" ") };
  });
  return { lessons: entries, rare, common };
}

interface Loaded { lessons: IndexEntry[]; words: Set<string>[]; rare: Record<string, string>; common: Set<string> }
let loaded: Promise<Loaded> | null = null;

function prepare(raw: any): Loaded {
  // Older index files were a plain list of lessons, without the rare words.
  const idx: SearchIndex = Array.isArray(raw) ? { lessons: raw, rare: {}, common: "" } : { lessons: raw?.lessons || [], rare: raw?.rare || {}, common: raw?.common || "" };
  return { lessons: idx.lessons, words: idx.lessons.map(e => new Set(e.w.split(" "))), rare: idx.rare, common: new Set(idx.common.split(" ")) };
}

// The index is kept in the database, gzip-compressed and split into pieces
// (search_index/{version}_{n}), readable by signed-in visitors only (the chatbot is for them),
// so web robots cannot download it. app_meta/search_index names the current version.
// The browser keeps a copy (IndexedDB) and reads the pieces again only when the version changes.
export const INDEX_META = "app_meta/search_index";
const INDEX_PIECE = 900_000;

/** Save a new index (nightly worker). Writes nothing when it did not change. */
export async function saveIndex(index: SearchIndex): Promise<{ changed: boolean; bytes: number; pieces: number }> {
  const json = JSON.stringify(index);
  const hash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(json)))).slice(0, 12).map(b => b.toString(16).padStart(2, "0")).join("");
  const prev = await store().get(INDEX_META);
  if (prev?.hash === hash) return { changed: false, bytes: prev.bytes || 0, pieces: prev.pieces || 0 };
  const data = await gzip(json);
  const version = String(Date.now());
  const ops: Op[] = [];
  for (let i = 0, n = 0; i < data.length; i += INDEX_PIECE, n++) {
    ops.push({ type: "set", path: `search_index/${version}_${n}`, data: { data: data.slice(i, i + INDEX_PIECE) } });
  }
  // New pieces first, then point to them, then remove the old ones.
  for (const op of ops) await store().commit([op]);
  await store().set(INDEX_META, { version, pieces: ops.length, hash, bytes: data.length, updated_at: new Date().toISOString() });
  if (prev?.version) await store().commit(Array.from({ length: prev.pieces || 0 }, (_, n) => ({ type: "delete" as const, path: `search_index/${prev.version}_${n}` })));
  return { changed: true, bytes: data.length, pieces: ops.length };
}

const CACHE_DB = "daf-search-index";
function cacheGet(): Promise<{ version: string; json: string } | null> {
  return new Promise(resolve => {
    try {
      if (typeof indexedDB === "undefined") return resolve(null);
      const req = indexedDB.open(CACHE_DB, 1);
      req.onupgradeneeded = () => req.result.createObjectStore("index");
      req.onerror = () => resolve(null);
      req.onsuccess = () => {
        try {
          const get = req.result.transaction("index").objectStore("index").get("current");
          get.onsuccess = () => resolve(get.result || null);
          get.onerror = () => resolve(null);
        } catch { resolve(null); }
      };
    } catch { resolve(null); }
  });
}
function cachePut(value: { version: string; json: string }) {
  try {
    if (typeof indexedDB === "undefined") return;
    const req = indexedDB.open(CACHE_DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore("index");
    req.onsuccess = () => { try { req.result.transaction("index", "readwrite").objectStore("index").put(value, "current"); } catch { /* no cache */ } };
  } catch { /* no cache */ }
}

async function fetchIndex(): Promise<any> {
  const meta = await store().get(INDEX_META);
  if (!meta?.version) return [];
  const cached = await cacheGet();
  if (cached?.version === meta.version) return JSON.parse(cached.json);
  const docs = await store().getMany(Array.from({ length: meta.pieces }, (_, n) => `search_index/${meta.version}_${n}`));
  const parts = docs.map(d => (d?.data as Uint8Array) || new Uint8Array());
  const all = new Uint8Array(parts.reduce((s, p) => s + p.length, 0));
  let at = 0;
  for (const p of parts) { all.set(p, at); at += p.length; }
  const json = await gunzip(all);
  cachePut({ version: String(meta.version), json });
  return JSON.parse(json);
}

export function loadIndex(): Promise<Loaded> {
  loaded ??= fetchIndex().then(prepare).catch(() => { loaded = null; return prepare([]); });
  return loaded;
}

/** Use an index that is already in memory (tests and scripts). */
export function useIndex(index: SearchIndex) { loaded = Promise.resolve(prepare(index)); }

export interface RankResult {
  lessons: IndexEntry[];
  /** For each returned lesson id: the rare search words it contains (to find the passage). */
  focus: Record<string, string[]>;
  /** The key rare word of the visitor's own question and how many lessons in scope contain it. */
  rareWord: { word: string; count: number } | null;
  /** Every rare word of the visitor's own question: how many lessons in scope contain it. */
  wordCounts: Record<string, number>;
}

/**
 * Lessons that best match the search words (optionally inside one tractate). A rare word counts
 * much more than a common one, so a name or a place decides; the lesson's distinctive words and
 * its title and summary (extraText) add to that. `question` is the visitor's own wording
 * (searchText may add related words), used for rareWord.
 */
export async function rankLessons(searchText: string, masechet: string | null, limit: number, extraText: (id: string) => string = () => "", question = searchText): Promise<RankResult> {
  const q = Array.from(new Set(words(searchText)));
  if (!q.length) return { lessons: [], focus: {}, rareWord: null, wordCounts: {} };
  const own = new Set(rawWords(question));
  const idx = await loadIndex();
  const n = idx.lessons.length || 1;
  const inScope = (i: number) => !masechet || idx.lessons[i].m === masechet;

  const score = new Map<number, number>();
  const focus = new Map<number, string[]>();
  const counts = new Map<string, { lessons: Set<number>; full: number }>();
  const matched = new Set<string>(); // question words found in `rare` (normalized form)
  for (const w of new Set(rawWords(searchText))) {
    if (idx.common.has(w)) continue;
    // Each lesson that contains the word in some prefix form, and that form.
    const found = new Map<number, string>();
    for (const form of forms(w)) {
      const enc = idx.rare[form];
      if (enc) for (const i of decodeList(enc)) if (!found.has(i)) found.set(i, form);
    }
    if (!found.size) continue;
    matched.add(normalizeWord(w));
    const weight = 2 * Math.log(n / found.size);
    const here = Array.from(found.keys()).filter(inScope);
    if (own.has(w) && here.length) counts.set(w, { lessons: new Set(here), full: here.length });
    for (const i of here) {
      score.set(i, (score.get(i) || 0) + weight);
      let f = focus.get(i);
      if (!f) focus.set(i, (f = []));
      f.push(found.get(i)!);
    }
  }
  // The lessons' distinctive words, title and summary. Words already found exactly above are
  // left out here (their shortened form could be another word: "בארות" → "ארות" ← "הארות").
  const topical = q.filter(w => !matched.has(w));
  idx.lessons.forEach((e, i) => {
    if (!inScope(i)) return;
    const extra = new Set(words(extraText(e.id)));
    const s = topical.reduce((t, w) => t + (idx.words[i].has(w) ? 1 : 0) + (extra.has(w) ? 2 : 0), 0);
    if (s) score.set(i, (score.get(i) || 0) + s);
  });

  const top = Array.from(score.entries()).sort((a, b) => b[1] - a[1]).slice(0, limit);
  // The question's key word: the one most of the found lessons share (then the rarer one).
  let rareWord: RankResult["rareWord"] = null, bestShare = 0;
  for (const [word, c] of counts) {
    const share = top.filter(([i]) => c.lessons.has(i)).length;
    if (share > bestShare || (share === bestShare && rareWord && c.full < rareWord.count)) { bestShare = share; rareWord = { word, count: c.full }; }
  }
  return {
    lessons: top.map(([i]) => idx.lessons[i]),
    focus: Object.fromEntries(top.map(([i]) => [idx.lessons[i].id, focus.get(i) || []])),
    rareWord,
    wordCounts: Object.fromEntries(Array.from(counts, ([w, c]) => [w, c.full])),
  };
}

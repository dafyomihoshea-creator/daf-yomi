// A small keyword index of all lesson transcripts, so the chatbot can find which lessons talk
// about a question (in a whole tractate or the whole Shas) without reading every transcript.
// The nightly worker builds it (worker/build-static.ts → dist/search-index.json); the browser
// downloads it only when a signed-in visitor asks a tractate-wide or Shas-wide question.
import type { Block } from "./transcript-format";

export interface IndexEntry { id: string; m: string | null; d: number | null; w: string }

const KEYWORDS_PER_LESSON = 120;
const PREFIXES = /^[והבלמשכ]/;
const STOP = new Set(["אני", "אתה", "הוא", "היא", "אנחנו", "הם", "זה", "זאת", "זו", "את", "של", "על", "עם", "אם", "כי", "לא", "כן", "מה", "מי", "גם", "רק", "אבל", "או", "יש", "אין", "היה", "הייתה", "היו", "להיות", "כל", "כמו", "עוד", "אז", "פה", "שם", "אחד", "אחת", "שני", "הזה", "הזאת", "אותו", "אותה", "אלא", "כאן", "עכשיו", "בסדר", "טוב", "נכון", "אומר", "אומרת", "אמר", "רוצה", "צריך", "יכול", "בעצם", "פשוט", "כאילו", "דבר", "דברים", "ככה", "איך", "למה", "מתי", "איפה"]);

/** Plain word form for matching: no vowel marks or punctuation, one leading prefix letter off long words. */
export function normalizeWord(w: string): string {
  let s = w.replace(/[֑-ׇ]/g, "").replace(/[^א-תa-zA-Z0-9]/g, "");
  if (s.length >= 5 && PREFIXES.test(s)) s = s.slice(1);
  return s;
}

export function words(text: string): string[] {
  return text.split(/\s+/).map(normalizeWord).filter(w => w.length >= 3 && !STOP.has(w));
}

/** The most distinctive words of each lesson (term frequency × rarity across lessons). */
export function buildIndex(lessons: Array<{ id: string; m: string | null; d: number | null; blocks: Block[] }>): IndexEntry[] {
  const tfs = lessons.map(l => {
    const tf = new Map<string, number>();
    for (const b of l.blocks) for (const w of words(b[1])) tf.set(w, (tf.get(w) || 0) + 1);
    return tf;
  });
  const df = new Map<string, number>();
  for (const tf of tfs) for (const w of tf.keys()) df.set(w, (df.get(w) || 0) + 1);
  const n = lessons.length;
  return lessons.map((l, i) => {
    const scored = Array.from(tfs[i].entries())
      .filter(([w]) => (df.get(w) || 0) < n * 0.5)
      .map(([w, c]) => [w, c * Math.log(n / (df.get(w) || 1))] as [string, number])
      .sort((a, b) => b[1] - a[1])
      .slice(0, KEYWORDS_PER_LESSON);
    return { id: l.id, m: l.m, d: l.d, w: scored.map(s => s[0]).join(" ") };
  });
}

let loaded: Promise<IndexEntry[]> | null = null;

export function loadIndex(): Promise<IndexEntry[]> {
  loaded ??= fetch("/search-index.json").then(r => (r.ok ? r.json() : [])).catch(() => { loaded = null; return []; });
  return loaded;
}

/**
 * Lessons that best match the question (optionally inside one tractate): keywords of the
 * transcript, plus the lesson's title and summary (extraText, weighted double).
 */
export async function rankLessons(question: string, masechet: string | null, limit: number, extraText: (id: string) => string = () => ""): Promise<IndexEntry[]> {
  const q = Array.from(new Set(words(question)));
  if (!q.length) return [];
  const scored: Array<[IndexEntry, number]> = [];
  for (const e of await loadIndex()) {
    if (masechet && e.m !== masechet) continue;
    const have = new Set(e.w.split(" "));
    const extra = new Set(words(extraText(e.id)));
    const score = q.reduce((s, w) => s + (have.has(w) ? 1 : 0) + (extra.has(w) ? 2 : 0), 0);
    if (score) scored.push([e, score]);
  }
  return scored.sort((a, b) => b[1] - a[1]).slice(0, limit).map(s => s[0]);
}

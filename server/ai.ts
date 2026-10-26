// "Chavruta AI": answers questions from the Rabbi's own words in the lesson transcripts, with
// links to the exact minute in the lesson. The visitor first chooses where to look: this lesson,
// the whole tractate, or the whole Shas (tractate/Shas questions use the keyword index of all
// transcripts, server/search-index.ts). Only when the transcripts don't answer the question
// does it answer from the Steinsaltz commentary — and says so. Only the passages relevant to
// the question are sent to Gemini, to stay within the free tier.
import { catalog, baseYoutubeId } from "./catalog";
import { getTranscriptBlocks, selectRelevantBlocks } from "./transcripts";
import { askGemini, geminiAvailable } from "./gemini";
import { getDafText, getSteinsaltz, parseMasechetAndDaf } from "./sefaria";
import { rankLessons } from "./search-index";
import type { Block } from "./transcript-format";

export type ChatScope = "lesson" | "masechet" | "shas";

/** A lesson quoted in an answer: the answer cites it as [[L1@12:30]]. */
export interface ChatSource { youtubeId: string; title: string; masechet: string | null; daf: number | null }

function ts(sec: number) {
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = Math.floor(sec % 60);
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
}

function clip(lines: string[] | null, max: number) {
  if (!lines) return "";
  let out = "";
  for (const l of lines) { if (out.length + l.length > max) break; out += l + "\n"; }
  return out;
}

const NO_ANSWER = "NO_ANSWER_IN_LESSONS";
const PASSAGE_BUDGET = 14000;

/**
 * Words the Rabbi would likely say when answering the question (the question's own wording
 * often differs from the lesson's), for finding the right lessons and passages.
 */
async function searchTerms(message: string): Promise<string> {
  const raw = await askGemini({
    json: true,
    temperature: 0.1,
    prompt: `שאלה על שיעור גמרא: "${message}"
החזר JSON בלבד: {"terms": ["10-15 מילים או צירופים קצרים בעברית/ארמית שסביר שיופיעו בדברי מגיד שיעור שעונה על השאלה, כולל מונחי הסוגיה ושמות התנאים/אמוראים הרלוונטיים"]}`,
  });
  try { return [message, ...(JSON.parse(raw || "{}").terms || [])].join(" "); } catch { return message; }
}

/** The lessons to search, by scope: this lesson, or the best keyword matches in the tractate / Shas. */
async function lessonsToSearch(scope: ChatScope, message: string, current: any, terms: string): Promise<any[]> {
  const all = await catalog.getAll();
  const byBase = new Map<string, any>();
  for (const v of all) if (!byBase.has(baseYoutubeId(v.youtube_id))) byBase.set(baseYoutubeId(v.youtube_id), v);
  const asked = parseMasechetAndDaf(message);

  if (scope === "lesson") {
    const v = current?.youtubeId ? all.find(x => x.youtube_id === current.youtubeId) : null;
    return v ? [v] : [];
  }
  const masechet = scope === "masechet" ? (asked.masechet || current?.masechet || null) : null;
  // A question that names a daf goes straight to that daf's lesson(s).
  if (asked.masechet && asked.daf) {
    const exact = all.filter(v => v.masechet === asked.masechet && v.daf === asked.daf && v.has_transcript);
    if (exact.length) return exact.slice(0, 2);
  }
  const ranked = await rankLessons(terms, masechet, scope === "shas" ? 8 : 6, id => {
    const v = byBase.get(id);
    return v ? `${v.title || ""} ${v.summary || ""}` : "";
  });
  return ranked.map(e => byBase.get(e.id)).filter(Boolean);
}

export async function answerQuestion(body: any) {
  const message = String(body?.message || "").slice(0, 1000);
  const history: any[] = Array.isArray(body?.history) ? body.history.slice(-6) : [];
  const current = body?.currentLesson || {};
  const scope: ChatScope = ["lesson", "masechet", "shas"].includes(body?.scope) ? body.scope : (current.youtubeId ? "lesson" : "shas");
  const conversation = history.map(h => `${h.role === "user" ? "שואל" : "עוזר"}: ${String(h.content || "").slice(0, 800)}`).join("\n");

  // 1. Passages from the transcripts of the lessons in scope, labelled L1, L2, ...
  const terms = scope === "lesson" ? message : await searchTerms(message);
  const lessons = await lessonsToSearch(scope, message, current, terms);
  const sources: Record<string, ChatSource> = {};
  const parts: string[] = [];
  let budget = PASSAGE_BUDGET;
  for (const v of lessons) {
    if (budget < 1500) break;
    const blocks: Block[] | null = await getTranscriptBlocks(v.youtube_id);
    if (!blocks?.length) continue;
    const share = Math.max(1500, Math.floor(PASSAGE_BUDGET / Math.max(1, lessons.length)));
    const picked = selectRelevantBlocks(blocks, terms, Math.min(share, budget));
    if (!picked.length) continue;
    const label = `L${Object.keys(sources).length + 1}`;
    sources[label] = { youtubeId: v.youtube_id, title: v.title, masechet: v.masechet ?? null, daf: v.daf ?? null };
    const text = picked.map(b => `[${ts(b[0])}] ${b[1]}`).join("\n");
    budget -= text.length;
    parts.push(`=== ${label}: ${v.title} (מסכת ${v.masechet ?? "?"} דף ${v.daf ?? "?"}) ===\n${text}`);
  }

  const where = scope === "lesson" ? "בשיעור הזה" : scope === "masechet" ? "בשיעורי המסכת" : "בשיעורי הש\"ס";
  let answer: string | null = null;
  let fromSteinsaltz = false;
  if (!geminiAvailable()) return { answer: "מערכת ה-AI אינה זמינה כרגע. אפשר לנסות שוב מאוחר יותר.", sources: {}, scope };

  if (parts.length) {
    answer = await askGemini({
      system: `אתה "חברותא AI" באתר שיעורי הדף היומי של הרב הושע רבינוביץ. ענה בעברית, בקצרה ובדיוק, אך ורק על סמך קטעי התמלול שלמטה מתוך שיעורי הרב.
- כל טענה שמבוססת על השיעור חייבת להסתיים בהפניה בפורמט המדויק [[L1@12:30]] — מזהה השיעור והזמן מתוך הקטע (זמן שמופיע בסוגריים בתחילת הקטע). אל תמציא זמנים או ציטוטים.
- התמלול אוטומטי ועשוי להכיל שגיאות כתיב; הבן את הכוונה.
- אל תוסיף ידע חיצוני ואל תסתמך על פירושים אחרים.
- אם הקטעים לא עונים על השאלה, השב רק: ${NO_ANSWER}

קטעי תמלול מהשיעורים:
${parts.join("\n\n")}`,
      prompt: `${conversation}\nשואל: ${message}`,
    });
    if (answer?.includes(NO_ANSWER)) answer = null;
  }

  // 2. Not in the lessons: the Steinsaltz commentary on the daf, clearly marked as such.
  if (!answer) {
    // Only for a known daf: the one the question names, or this lesson's daf.
    const asked = parseMasechetAndDaf(message);
    const named = !!(asked.masechet && asked.daf);
    const masechet = named ? asked.masechet : scope === "lesson" ? current.masechet || null : null;
    const daf = named ? asked.daf : scope === "lesson" && current.daf ? parseInt(String(current.daf), 10) : null;
    if (masechet && daf) {
      const [gA, gB, sA, sB] = await Promise.all([getDafText(masechet, daf, "a"), getDafText(masechet, daf, "b"), getSteinsaltz(masechet, daf, "a"), getSteinsaltz(masechet, daf, "b")]);
      if (sA || sB) {
        const s = await askGemini({
          system: `ענה בעברית, בקצרה, על סמך ביאור שטיינזלץ והגמרא שלמטה בלבד (מסכת ${masechet} דף ${daf}). אם גם שם אין תשובה, השב רק: ${NO_ANSWER}
הגמרא:\n${clip(gA, 2500)}${clip(gB, 2500)}\nביאור שטיינזלץ:\n${clip(sA, 3000)}${clip(sB, 3000)}`,
          prompt: `${conversation}\nשואל: ${message}`,
        });
        if (s && !s.includes(NO_ANSWER)) { answer = `לא מצאתי תשובה לשאלה ${where}. לפי ביאור שטיינזלץ על מסכת ${masechet} דף ${daf}:\n\n${s}`; fromSteinsaltz = true; }
      }
    }
  }
  if (!answer) answer = `לא מצאתי תשובה לשאלה ${where}${parts.length ? "" : " (לא נמצאו שיעורים עם תמלול שעוסקים בזה)"}. אפשר לנסות לנסח אחרת או להרחיב את היקף החיפוש.`;

  // Keep only the lessons the answer actually cites.
  const cited = fromSteinsaltz ? {} : Object.fromEntries(Object.entries(sources).filter(([k]) => answer!.includes(`[[${k}@`)));
  const main = Object.values(cited)[0] || (scope === "lesson" ? Object.values(sources)[0] : undefined);
  return {
    answer, sources: cited, scope, fromSteinsaltz,
    masechet: main?.masechet ?? current.masechet ?? null, daf: main?.daf ?? null, youtubeId: main?.youtubeId ?? null, videoTitle: main?.title ?? "",
  };
}

export async function smartSearch(query: string) {
  const all = await catalog.getAll();
  const masechtot = Array.from(new Set(all.map(v => v.masechet).filter(Boolean)));
  let masechet: string | null = null, dafim: number[] = [], keywords: string[] = [query], interpretation: string | null = null;

  const raw = await askGemini({
    json: true,
    temperature: 0.1,
    prompt: `אתה עוזר חיפוש לאתר שיעורי גמרא. מסכתות זמינות: ${masechtot.join(", ")}.
השאילתה: "${query}"
החזר JSON בלבד: {"masechet": "שם מסכת או null", "dafim": [מספרי דפים או ריק], "keywords": ["3-8 מילות מפתח בעברית/ארמית"], "interpretation": "הסבר קצר בעברית"}`,
  });
  if (raw) {
    try {
      const p = JSON.parse(raw);
      masechet = p.masechet && masechtot.includes(p.masechet) ? p.masechet : null;
      dafim = Array.isArray(p.dafim) ? p.dafim.map(Number).filter(Boolean) : [];
      keywords = Array.isArray(p.keywords) && p.keywords.length ? p.keywords : [query];
      interpretation = p.interpretation || null;
    } catch { /* fall back to plain search */ }
  } else {
    keywords = [query, ...query.split(/\s+/).filter(w => w.length > 2)];
  }

  let results = all.filter(v => !masechet || v.masechet === masechet);
  if (dafim.length) results = results.filter(v => dafim.includes(v.daf));
  else results = results.filter(v => keywords.some(k => String(v.title || "").includes(k) || String(v.summary || "").includes(k)));
  results.sort((a, b) => String(b.published_at || "").localeCompare(String(a.published_at || "")));
  return { results: results.slice(0, 20), interpretation };
}

export { baseYoutubeId };

// Chatbot and smart search. The chatbot answers from the real transcript of the lesson
// (only the passages relevant to the question are sent to Gemini, to stay within the free
// tier), plus the Gemara text and Steinsaltz commentary from Sefaria.
import { catalog, baseYoutubeId } from "./catalog";
import { getTranscriptBlocks, selectRelevantBlocks } from "./transcripts";
import { askGemini, geminiAvailable } from "./gemini";
import { getDafText, getSteinsaltz, parseMasechetAndDaf } from "./sefaria";

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

// Simple per-visitor limit so one person can't use up the free daily AI quota.
const usage = new Map<string, { count: number; reset: number }>();
export function allowAiRequest(ip: string, perHour = 20): boolean {
  const now = Date.now();
  const u = usage.get(ip);
  if (!u || now > u.reset) { usage.set(ip, { count: 1, reset: now + 3600_000 }); return true; }
  if (u.count >= perHour) return false;
  u.count++;
  return true;
}

export async function answerQuestion(body: any) {
  const message = String(body?.message || "").slice(0, 1000);
  const history: any[] = Array.isArray(body?.history) ? body.history.slice(-6) : [];
  const current = body?.currentLesson || {};

  let masechet: string | null = current.masechet || null;
  let daf: number | null = current.daf ? parseInt(String(current.daf), 10) || null : null;
  let youtubeId: string | null = current.youtubeId || null;
  const asked = parseMasechetAndDaf(message);
  // Switch lessons only when the question names a specific other daf (not just the tractate).
  if (asked.masechet && asked.daf && !(asked.masechet === masechet && asked.daf === daf)) {
    masechet = asked.masechet; daf = asked.daf; youtubeId = null;
  } else if (asked.masechet && !youtubeId && !masechet) {
    masechet = asked.masechet;
  }

  const all = await catalog.getAll();
  let lesson = youtubeId ? all.find(v => v.youtube_id === youtubeId) : null;
  if (!lesson && masechet && daf) lesson = all.find(v => v.masechet === masechet && v.daf === daf) || null;
  if (lesson) { youtubeId = lesson.youtube_id; masechet ||= lesson.masechet; daf ||= lesson.daf; }

  const blocks = youtubeId ? await getTranscriptBlocks(youtubeId) : null;
  const relevant = blocks ? selectRelevantBlocks(blocks, message) : [];
  const [gA, gB, sA, sB] = masechet && daf
    ? await Promise.all([getDafText(masechet, daf, "a"), getDafText(masechet, daf, "b"), getSteinsaltz(masechet, daf, "a"), getSteinsaltz(masechet, daf, "b")])
    : [null, null, null, null];

  const context = [
    lesson ? `שיעור: ${lesson.title}\nמסכת ${lesson.masechet ?? ""} דף ${lesson.daf ?? ""}\nתקציר: ${lesson.summary || ""}` : "",
    relevant.length
      ? `קטעים מתמלול השיעור (תמלול אוטומטי של יוטיוב, עשוי להכיל שגיאות; המספר בסוגריים הוא הזמן בשיעור):\n${relevant.map(b => `[${ts(b[0])}] ${b[1]}`).join("\n")}`
      : "אין תמלול זמין לשיעור זה.",
    gA || gB ? `הגמרא (${masechet} דף ${daf}):\nעמוד א:\n${clip(gA, 2500)}עמוד ב:\n${clip(gB, 2500)}` : "",
    sA || sB ? `ביאור שטיינזלץ:\n${clip(sA, 2500)}${clip(sB, 2500)}` : "",
  ].filter(Boolean).join("\n\n");

  const system = `אתה עוזר לימוד באתר שיעורי הדף היומי של הרב הושע רבינוביץ. ענה בעברית, בקצרה ובדיוק.
- כשאתה מסתמך על דברי הרב בשיעור, ציין את הזמן מתוך קטעי התמלול בלבד (למשל: "בדקה 12:30 בשיעור"). אל תמציא זמנים או ציטוטים.
- התמלול אוטומטי ועשוי להכיל שגיאות כתיב; הבן את הכוונה.
- אם התשובה לא נמצאת בחומר שסופק, אמור זאת, ואפשר להוסיף הסבר כללי תוך ציון שזה לא מתוך השיעור.

${context}`;

  const prompt = `${history.map(h => `${h.role === "user" ? "שואל" : "עוזר"}: ${String(h.content || "").slice(0, 800)}`).join("\n")}\nשואל: ${message}`;
  let answer = geminiAvailable() ? await askGemini({ system, prompt }) : null;

  if (!answer) {
    // AI unavailable (e.g. daily free limit reached): show the most relevant passages instead.
    answer = relevant.length
      ? `מערכת ה-AI אינה זמינה כרגע. אלה הקטעים מהשיעור שנראים הכי קשורים לשאלה:\n\n${relevant.slice(0, 4).map(b => `[${ts(b[0])}] ${b[1].slice(0, 300)}`).join("\n\n")}`
      : "מערכת ה-AI אינה זמינה כרגע. אפשר לנסות שוב מאוחר יותר.";
  }
  return { answer, masechet, daf, youtubeId, videoTitle: lesson?.title || "" };
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

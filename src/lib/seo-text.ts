// Titles, descriptions and addresses for search engines. Shared by the nightly prerender
// (server/seo.ts) and the browser (SEOHead), so Google sees the same text either way.
import { numberToHebrewDaf } from "./masechet-list";
import { parseTitleForMasechetDafs } from "./daf-parse";

/** The site's one main address. Every canonical link points here, never to the old domain. */
export const SITE_ORIGIN = "https://daf-yomi-hoshea.web.app";

export const SITE_NAME = "בית המדרש הדיגיטלי";
export const RABBI = "הרב הושע רבינוביץ׳";
export const DEFAULT_TITLE = `דף יומי – שיעורי ${RABBI} | ${SITE_NAME}`;
export const DEFAULT_DESC = `שיעורי הדף היומי מפי ${RABBI} ב${SITE_NAME}: כל שיעורי הגמרא לפי מסכת ודף, עם תמלול השיעור, ביאור שטיינזלץ, סיכומים ועוזר חכם לשאלות על השיעור.`;

/** A lesson saved once per daf has ids like "<11-char YouTube id>_<daf>"; the original is the main page. */
export function baseLessonId(id: string): string {
  return String(id || "").substring(0, 11);
}

export function lessonPath(id: string): string {
  return `/lesson/${encodeURIComponent(baseLessonId(id))}`;
}

/** "מסכת נדרים דף פט" or "מסכת נדרים דפים פט–צ"; empty when the lesson has no tractate. */
export function lessonWhere(v: { title?: string; masechet?: string | null; daf?: number | null }): string {
  if (!v.masechet) return "";
  const parsed = parseTitleForMasechetDafs(String(v.title || ""));
  const dafs = parsed.masechet === v.masechet ? parsed.dafs.filter(d => d >= 2) : [];
  if (dafs.length > 1) return `מסכת ${v.masechet} דפים ${numberToHebrewDaf(dafs[0])}–${numberToHebrewDaf(dafs[dafs.length - 1])}`;
  const daf = dafs[0] ?? v.daf;
  return `מסכת ${v.masechet}${daf ? ` דף ${numberToHebrewDaf(daf)}` : ""}`;
}

export function lessonTitle(v: { title?: string; masechet?: string | null; daf?: number | null }): string {
  const where = lessonWhere(v);
  return where ? `${where} – שיעור דף יומי | ${RABBI}` : `${String(v.title || "שיעור דף יומי")} | ${RABBI}`;
}

export function lessonDescription(v: { title?: string; summary?: string | null }): string {
  return String(v.summary || `${v.title}. שיעור הדף היומי מפי ${RABBI}, עם תמלול, ביאור שטיינזלץ ועוזר חכם לשאלות.`).slice(0, 300);
}

export function masechetTitle(name: string): string {
  return `מסכת ${name} – שיעורי דף יומי | ${RABBI}`;
}

export function masechetDescription(name: string, count: number): string {
  return `כל שיעורי הדף היומי במסכת ${name} מפי ${RABBI}, דף אחר דף, עם תמלול, ביאור שטיינזלץ וסיכומים. ${count} שיעורים.`;
}

/** Fixed pages: [title, description]. */
export const PAGE_TEXT: Record<string, [string, string]> = {
  "/": [DEFAULT_TITLE, DEFAULT_DESC],
  "/browse": [`עיון בשיעורים – כל שיעורי הדף היומי | ${RABBI}`, `חיפוש ועיון בכל שיעורי הדף היומי של ${RABBI}, לפי מסכת ודף.`],
  "/calendar": [`לוח שיעורי הדף היומי | ${RABBI}`, `לוח השיעורים של הדף היומי לפי תאריכים – ${SITE_NAME}.`],
  "/articles": [`מאמרים | ${SITE_NAME}`, `מאמרים ומקורות מאת ${RABBI}.`],
};

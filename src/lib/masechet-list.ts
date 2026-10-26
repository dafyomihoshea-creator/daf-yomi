import { parseTitleForMasechetDafs } from "./daf-parse";
export const MASECHET_LIST = [
  { hebrew: "ברכות", english: "Brachot" },
  { hebrew: "שבת", english: "Shabbat" },
  { hebrew: "עירובין", english: "Eruvin" },
  { hebrew: "פסחים", english: "Pesachim" },
  { hebrew: "שקלים", english: "Shekalim" },
  { hebrew: "יומא", english: "Yoma" },
  { hebrew: "סוכה", english: "Sukkah" },
  { hebrew: "ביצה", english: "Beitzah" },
  { hebrew: "ראש השנה", english: "Rosh Hashanah" },
  { hebrew: "תענית", english: "Taanit" },
  { hebrew: "מגילה", english: "Megillah" },
  { hebrew: "מועד קטן", english: "Moed Katan" },
  { hebrew: "חגיגה", english: "Chagigah" },
  { hebrew: "יבמות", english: "Yevamot" },
  { hebrew: "כתובות", english: "Ketubot" },
  { hebrew: "נדרים", english: "Nedarim" },
  { hebrew: "נזיר", english: "Nazir" },
  { hebrew: "סוטה", english: "Sotah" },
  { hebrew: "גיטין", english: "Gittin" },
  { hebrew: "קידושין", english: "Kiddushin" },
  { hebrew: "בבא קמא", english: "Bava Kamma" },
  { hebrew: "בבא מציעא", english: "Bava Metzia" },
  { hebrew: "בבא בתרא", english: "Bava Batra" },
  { hebrew: "סנהדרין", english: "Sanhedrin" },
  { hebrew: "מכות", english: "Makkot" },
  { hebrew: "שבועות", english: "Shevuot" },
  { hebrew: "עבודה זרה", english: "Avodah Zarah" },
  { hebrew: "הוריות", english: "Horayot" },
  { hebrew: "זבחים", english: "Zevachim" },
  { hebrew: "מנחות", english: "Menachot" },
  { hebrew: "חולין", english: "Chullin" },
  { hebrew: "בכורות", english: "Bechorot" },
  { hebrew: "ערכין", english: "Arachin" },
  { hebrew: "תמורה", english: "Temurah" },
  { hebrew: "כריתות", english: "Keritot" },
  { hebrew: "מעילה", english: "Meilah" },
  { hebrew: "תמיד", english: "Tamid" },
  { hebrew: "נידה", english: "Niddah" },
] as const;

export type MasechetHebrew = typeof MASECHET_LIST[number]["hebrew"];

export const DEFAULT_MASECHET_COUNTS: Record<string, number> = {
  "ברכות": 63,
  "שבת": 156,
  "עירובין": 104,
  "פסחים": 120,
  "שקלים": 21,
  "יומא": 87,
  "סוכה": 55,
  "ביצה": 39,
  "ראש השנה": 34,
  "תענית": 30,
  "מגילה": 31,
  "מועד קטן": 28,
  "חגיגה": 26,
  "יבמות": 121,
  "כתובות": 111,
  "נדרים": 90,
  "נזיר": 65,
  "סוטה": 48,
  "גיטין": 89,
  "קידושין": 81,
  "בבא קמא": 118,
  "בבא מציעא": 118,
  "בבא בתרא": 175,
  "סנהדרין": 112,
  "מכות": 23,
  "שבועות": 48,
  "עבודה זרה": 75,
  "הוריות": 13,
  "זבחים": 119,
  "מנחות": 109,
  "חולין": 141,
  "בכורות": 60,
  "ערכין": 33,
  "תמורה": 33,
  "כריתות": 27,
  "מעילה": 21,
  "תמיד": 9,
  "נידה": 72,
};

export { parseTitleForMasechetDafs } from "./daf-parse";

export function getMasechetEnglish(hebrew: string): string {
  const found = MASECHET_LIST.find(m => m.hebrew === hebrew);
  return found?.english ?? hebrew;
}

export function numberToHebrewDaf(num: number): string {
  if (num <= 0) return String(num);
  const ones = ['', 'א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט'];
  const tens = ['', 'י', 'כ', 'ל', 'מ', 'נ', 'ס', 'ע', 'פ', 'צ'];
  const hundreds = ['', 'ק', 'ר', 'ש', 'ת'];

  if (num === 15) return 'טו';
  if (num === 16) return 'טז';

  let result = '';
  if (num >= 100) {
    result += hundreds[Math.floor(num / 100)];
    num %= 100;
  }
  if (num >= 10) {
    result += tens[Math.floor(num / 10)];
    num %= 10;
  }
  result += ones[num];
  return result;
}

export function formatDafLabel(title: string, fallbackDaf: number | null, lang: string = "he", short: boolean = false): string {
  const { dafs } = parseTitleForMasechetDafs(title);
  const displayDafs = dafs.length > 0 ? dafs : fallbackDaf ? [fallbackDaf] : [];
  if (displayDafs.length === 0) return "";
  
  if (lang === "en") {
    return short ? displayDafs.join(',') : `Page ${displayDafs.join(', ')}`;
  }
  
  return short 
    ? displayDafs.map(numberToHebrewDaf).join(',')
    : displayDafs.length > 1 
      ? `דפים ${displayDafs.map(numberToHebrewDaf).join(',')}`
      : `דף ${numberToHebrewDaf(displayDafs[0])}`;
}

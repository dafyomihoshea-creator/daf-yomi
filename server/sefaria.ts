// Gemara text and Steinsaltz commentary from Sefaria (free public API), cached in memory.
const MASECHTOT: Array<[string, string]> = [
  ["ברכות", "Berakhot"], ["שבת", "Shabbat"], ["עירובין", "Eruvin"], ["פסחים", "Pesachim"],
  ["שקלים", "Shekalim"], ["יומא", "Yoma"], ["סוכה", "Sukkah"], ["ביצה", "Beitzah"],
  ["ראש השנה", "Rosh_Hashanah"], ["תענית", "Taanit"], ["מגילה", "Megillah"], ["מועד קטן", "Moed_Katan"],
  ["חגיגה", "Chagigah"], ["יבמות", "Yevamot"], ["כתובות", "Ketubot"], ["נדרים", "Nedarim"],
  ["נזיר", "Nazir"], ["סוטה", "Sotah"], ["גיטין", "Gittin"], ["קידושין", "Kiddushin"],
  ["בבא קמא", "Bava_Kamma"], ["בבא מציעא", "Bava_Metzia"], ["בבא בתרא", "Bava_Batra"], ["סנהדרין", "Sanhedrin"],
  ["מכות", "Makkot"], ["שבועות", "Shevuot"], ["עבודה זרה", "Avodah_Zarah"], ["הוריות", "Horayot"],
  ["זבחים", "Zevachim"], ["מנחות", "Menachot"], ["חולין", "Chullin"], ["בכורות", "Bekhorot"],
  ["ערכין", "Arakhin"], ["תמורה", "Temurah"], ["כריתות", "Keritot"], ["מעילה", "Meilah"],
  ["תמיד", "Tamid"], ["נידה", "Niddah"],
];
const ENGLISH_ALIASES: Record<string, string> = { brachot: "ברכות", bechorot: "בכורות", arachin: "ערכין" };

const cache = new Map<string, string[] | null>();

async function fetchRef(ref: string): Promise<string[] | null> {
  if (cache.has(ref)) return cache.get(ref)!;
  let result: string[] | null = null;
  try {
    const res = await fetch(`https://www.sefaria.org.il/api/v3/texts/${ref}?version=source`, { signal: AbortSignal.timeout(8000) });
    if (res.ok) {
      const data: any = await res.json();
      const he = (data.versions || []).find((v: any) => v.language === "he")?.text;
      const flat = (Array.isArray(he) ? he.flat(3) : he ? [he] : []).map((l: any) => String(l).replace(/<[^>]*>/g, "").trim()).filter(Boolean);
      result = flat.length ? flat : null;
    }
  } catch { /* network problem — answer without the text */ }
  if (cache.size > 300) cache.delete(cache.keys().next().value as string);
  cache.set(ref, result);
  return result;
}

function sefariaName(masechet: string) {
  return MASECHTOT.find(([he]) => he === masechet)?.[1] || masechet.replace(/ /g, "_");
}

export function getDafText(masechet: string, daf: number, amud: "a" | "b") {
  return fetchRef(`${sefariaName(masechet)}.${daf}${amud}`);
}

export function getSteinsaltz(masechet: string, daf: number, amud: "a" | "b") {
  return fetchRef(`Steinsaltz_on_${sefariaName(masechet)}.${daf}${amud}`);
}

export function hebrewToNumber(str: string): number | null {
  const values: Record<string, number> = {
    "א": 1, "ב": 2, "ג": 3, "ד": 4, "ה": 5, "ו": 6, "ז": 7, "ח": 8, "ט": 9, "י": 10, "כ": 20, "ל": 30,
    "מ": 40, "נ": 50, "ס": 60, "ע": 70, "פ": 80, "צ": 90, "ק": 100, "ר": 200, "ש": 300, "ת": 400,
  };
  let total = 0;
  for (const ch of str) { if (!values[ch]) return null; total += values[ch]; }
  return total || null;
}

/** Find "מסכת X דף Y" in free text (Hebrew or English tractate names). */
export function parseMasechetAndDaf(text: string): { masechet: string | null; daf: number | null } {
  const lower = text.toLowerCase();
  let masechet: string | null = null;
  for (const [he, en] of MASECHTOT) {
    if (text.includes(he) || lower.includes(en.toLowerCase().replace(/_/g, " "))) { masechet = he; break; }
  }
  if (!masechet) for (const [alias, he] of Object.entries(ENGLISH_ALIASES)) if (lower.includes(alias)) { masechet = he; break; }
  if (!masechet) return { masechet: null, daf: null };
  const clean = text.replace(/["'״׳]/g, "");
  const digits = clean.match(/(?:דף\s+)?(\d+)/);
  if (digits) return { masechet, daf: parseInt(digits[1], 10) };
  const after = clean.substring(clean.indexOf(masechet) + masechet.length, clean.indexOf(masechet) + masechet.length + 30);
  for (const w of after.split(/\s+/)) {
    if (!/^[א-ת]{1,3}$/.test(w) || w === "דף") continue;
    const n = hebrewToNumber(w);
    if (n && n > 1) return { masechet, daf: n };
  }
  return { masechet, daf: null };
}

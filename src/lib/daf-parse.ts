// Which tractate and dafim a lesson covers, from its YouTube title. Shared by the server
// (YouTube sync, re-cataloging) and the site (labels, daf filters).
//
// A daf has two sides (amud א and amud ב). Rule agreed with the site owner:
//   - start in amud א  -> the starting daf counts;  start in amud ב -> it does not.
//   - end in amud ב    -> the ending daf counts;    end in amud א   -> it does not.
//   - same daf at both ends ("דף לא עמ א עד דף לא עמ ב") -> that daf.
//   - from amud ב of one daf to amud א of the next (no whole daf) -> the second daf.
//   - no amudim in the title ("צד עד צו", "עט פ") -> every daf in the range.

const MASECHTOT: Array<[string, string[]]> = [
  ["ברכות", []], ["שבת", []], ["עירובין", ["ערובין"]], ["פסחים", []], ["שקלים", []], ["יומא", []],
  ["סוכה", []], ["ביצה", []], ["ראש השנה", []], ["תענית", []], ["מגילה", []], ["מועד קטן", []],
  ["חגיגה", []], ["יבמות", []], ["כתובות", []], ["נדרים", []], ["נזיר", []], ["סוטה", []],
  ["גיטין", []], ["קידושין", ["קדושין"]], ["בבא קמא", ["ב\"ק"]], ["בבא מציעא", ["ב\"מ"]], ["בבא בתרא", ["ב\"ב"]],
  ["סנהדרין", []], ["מכות", []], ["שבועות", []], ["עבודה זרה", []], ["הוריות", []],
  ["זבחים", []], ["מנחות", []], ["חולין", []], ["בכורות", []], ["ערכין", []], ["תמורה", []],
  ["כריתות", []], ["מעילה", []], ["תמיד", []], ["נידה", ["נדה"]],
];

const MAX_DAFIM = 10;

export function hebrewToNumber(str: string): number | null {
  const values: Record<string, number> = {
    "א": 1, "ב": 2, "ג": 3, "ד": 4, "ה": 5, "ו": 6, "ז": 7, "ח": 8, "ט": 9,
    "י": 10, "כ": 20, "ל": 30, "מ": 40, "נ": 50, "ס": 60, "ע": 70, "פ": 80, "צ": 90,
    "ק": 100, "ר": 200, "ש": 300, "ת": 400,
  };
  let total = 0;
  for (const ch of str) {
    if (!values[ch]) return null;
    total += values[ch];
  }
  return total > 0 ? total : null;
}

function toNumber(s: string): number | null {
  const clean = s.replace(/["'״׳]/g, "");
  return /^\d+$/.test(clean) ? parseInt(clean, 10) : hebrewToNumber(clean);
}

function range(from: number, to: number): number[] {
  if (to < from || to - from >= MAX_DAFIM) return [];
  return Array.from({ length: to - from + 1 }, (_, i) => from + i);
}

/** Find the tractate named in the title (also common spelling variants). */
function findMasechet(title: string): { name: string; index: number; length: number } | null {
  let best: { name: string; index: number; length: number } | null = null;
  for (const [name, aliases] of MASECHTOT) {
    for (const form of [name, ...aliases]) {
      const i = title.indexOf(form);
      // Whole word only (e.g. "שבת" inside "שבתות" doesn't count).
      const after = title[i + form.length];
      if (i >= 0 && (!after || !/[א-ת]/.test(after)) && (!best || i < best.index)) best = { name, index: i, length: form.length };
    }
  }
  return best;
}

// A daf number is a whole word (so "הרב" is not read as daf "הר" amud "ב").
const NUM = `(?<![א-ת\\d])(\\d+|[א-ת]{1,3}(?:["'״׳]{1,2}[א-ת])?)(?![א-ת])`;
// "עמ א", "עמוד ב", "ע''א", "ע"ב", "עמא", or a bare "א"/"ב" right after the daf number.
const AMUD = `(?:\\s*(?:עמ(?:וד)?\\.?\\s*|ע["'״׳]{1,2})?\\s*["'״׳]?([אב])["'״׳]?(?![א-ת]))`;
// "מדף", "דף", or nothing; "עד", "עדף" (typo), "ועד".
const FROM = `(?:מ?דף\\s+)?`;
const TO = `\\s+(?:ו?עד\\s+(?:דף\\s+)?|עדף\\s+)`;

const RANGE_WITH_AMUD = new RegExp(`${FROM}${NUM}${AMUD}(.*?)${TO}${NUM}${AMUD}`, "u");
const RANGE_NO_AMUD = new RegExp(`${FROM}${NUM}${TO}${NUM}(?![א-ת])`, "u");
const TWO_DAFIM = new RegExp(`^\\s*(?:דפים\\s+)?${NUM}\\s*(?:,|-|\\s+ו?)\\s*${NUM}(?![א-ת])`, "u");
const ONE_DAF = new RegExp(`^\\s*(?:מ?דף\\s+)?${NUM}(?![א-ת])`, "u");

export function parseTitleForMasechetDafs(title: string): { masechet: string | null; dafs: number[] } {
  const found = findMasechet(title);
  if (!found) return { masechet: null, dafs: [] };
  const masechet = found.name;
  // "מתחילת המסכת" = from the first daf (daf ב, amud א).
  // Common typing slips: "מזע מ ב" = "מז עמ ב".
  const rest = title.slice(found.index + found.length)
    .replace(/מתחילת\s+ה?מסכת[א]?/, "מדף ב עמ א")
    .replace(/([א-ת])ע מ\s/g, "$1 עמ ");

  const r = rest.match(RANGE_WITH_AMUD);
  if (r) {
    const start = toNumber(r[1]), startAmud = r[2], end = toNumber(r[4]), endAmud = r[5];
    if (start && end && end >= start) {
      if (start === end) return { masechet, dafs: [start] };
      const from = startAmud === "א" ? start : start + 1;
      const to = endAmud === "ב" ? end : end - 1;
      if (from > to) return { masechet, dafs: [end] }; // amud ב of one daf to amud א of the next
      const dafs = range(from, to);
      if (dafs.length) return { masechet, dafs };
    }
  }

  const n = rest.match(RANGE_NO_AMUD);
  if (n) {
    const start = toNumber(n[1]), end = toNumber(n[2]);
    if (start && end) {
      const dafs = range(start, end);
      if (dafs.length) return { masechet, dafs };
    }
  }

  const two = rest.match(TWO_DAFIM);
  if (two) {
    const a = toNumber(two[1]), b = toNumber(two[2]);
    if (a && b && b > a && b - a < MAX_DAFIM) return { masechet, dafs: range(a, b) };
  }

  const one = rest.match(ONE_DAF);
  if (one) {
    const d = toNumber(one[1]);
    if (d && d > 1 && d < 200) return { masechet, dafs: [d] };
  }
  return { masechet, dafs: [] };
}

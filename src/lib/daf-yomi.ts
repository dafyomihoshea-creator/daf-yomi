// Daf Yomi cycle calculation
// Cycle 14 started on January 5, 2020

export interface MasechetCycleInfo {
  name: string;
  dafim: number;
  startDaf: number;
}

export const DAF_YOMI_MASECHTOT: MasechetCycleInfo[] = [
  { name: "ברכות", dafim: 63, startDaf: 2 },
  { name: "שבת", dafim: 156, startDaf: 2 },
  { name: "עירובין", dafim: 104, startDaf: 2 },
  { name: "פסחים", dafim: 120, startDaf: 2 },
  { name: "שקלים", dafim: 21, startDaf: 2 },
  { name: "יומא", dafim: 87, startDaf: 2 },
  { name: "סוכה", dafim: 55, startDaf: 2 },
  { name: "ביצה", dafim: 39, startDaf: 2 },
  { name: "ראש השנה", dafim: 34, startDaf: 2 },
  { name: "תענית", dafim: 30, startDaf: 2 },
  { name: "מגילה", dafim: 31, startDaf: 2 },
  { name: "מועד קטן", dafim: 28, startDaf: 2 },
  { name: "חגיגה", dafim: 26, startDaf: 2 },
  { name: "יבמות", dafim: 121, startDaf: 2 },
  { name: "כתובות", dafim: 111, startDaf: 2 },
  { name: "נדרים", dafim: 90, startDaf: 2 },
  { name: "נזיר", dafim: 65, startDaf: 2 },
  { name: "סוטה", dafim: 48, startDaf: 2 },
  { name: "גיטין", dafim: 89, startDaf: 2 },
  { name: "קידושין", dafim: 81, startDaf: 2 },
  { name: "בבא קמא", dafim: 118, startDaf: 2 },
  { name: "בבא מציעא", dafim: 118, startDaf: 2 },
  { name: "בבא בתרא", dafim: 175, startDaf: 2 },
  { name: "סנהדרין", dafim: 112, startDaf: 2 },
  { name: "מכות", dafim: 23, startDaf: 2 },
  { name: "שבועות", dafim: 48, startDaf: 2 },
  { name: "עבודה זרה", dafim: 75, startDaf: 2 },
  { name: "הוריות", dafim: 13, startDaf: 2 },
  { name: "זבחים", dafim: 119, startDaf: 2 },
  { name: "מנחות", dafim: 109, startDaf: 2 },
  { name: "חולין", dafim: 141, startDaf: 2 },
  { name: "בכורות", dafim: 60, startDaf: 2 },
  { name: "ערכין", dafim: 33, startDaf: 2 },
  { name: "תמורה", dafim: 33, startDaf: 2 },
  { name: "כריתות", dafim: 27, startDaf: 2 },
  { name: "מעילה", dafim: 21, startDaf: 2 },
  { name: "קנים", dafim: 3, startDaf: 2 },
  { name: "מידות", dafim: 4, startDaf: 2 },
  { name: "תמיד", dafim: 9, startDaf: 25 },
  { name: "נידה", dafim: 72, startDaf: 2 },
];

export const TOTAL_DAFIM = DAF_YOMI_MASECHTOT.reduce((sum, m) => sum + m.dafim, 0);

// Cycle 14 start date: January 5, 2020
export const CYCLE_14_START = new Date(2020, 0, 5, 12, 0, 0); // Month is 0-indexed, set to noon to avoid timezone shift issues

export interface DafYomiInfo {
  masechet: string;
  daf: number; // 1-indexed relative page within masechet
  actualDaf: number; // The actual page number in the Talmud (e.g. 2 for standard, 25 for Tamid)
}

export function getTodaysDafYomi(date: Date = new Date()): DafYomiInfo {
  const startDate = new Date(CYCLE_14_START);
  const targetDate = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0);
  const diffTime = targetDate.getTime() - startDate.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  // Position within the cycle
  const posInCycle = ((diffDays % TOTAL_DAFIM) + TOTAL_DAFIM) % TOTAL_DAFIM;
  
  let remaining = posInCycle;
  for (const masechet of DAF_YOMI_MASECHTOT) {
    if (remaining < masechet.dafim) {
      return {
        masechet: masechet.name,
        daf: remaining + 1,
        actualDaf: remaining + masechet.startDaf,
      };
    }
    remaining -= masechet.dafim;
  }
  
  // Fallback (shouldn't reach here)
  return { masechet: "ברכות", daf: 1, actualDaf: 2 };
}

/**
 * Calculates the official scheduled Gregorian Date for a given masechet and daf in Cycle 14.
 */
export function getGregorianDateForDaf(masechetName: string, dafNumber: number): Date | null {
  // Normalize spelling of masechet name
  const nameMap: Record<string, string> = {
    "פסחים": "פסחים",
    "ראש השנה": "ראש השנה",
    "מועד קטן": "מועד קטן",
    "בבא קמא": "בבא קמא",
    "בבא מציעא": "בבא מציעא",
    "בבא בתרא": "בבא בתרא",
    "עבודה זרה": "עבודה זרה",
  };
  
  const normalizedName = nameMap[masechetName] || masechetName;
  
  let masechetOffset = 0;
  let foundMasechet: MasechetCycleInfo | null = null;
  
  for (const m of DAF_YOMI_MASECHTOT) {
    if (m.name === normalizedName) {
      foundMasechet = m;
      break;
    }
    masechetOffset += m.dafim;
  }
  
  if (!foundMasechet) return null;
  
  // Calculate relative offset within masechet
  const relativeOffset = dafNumber - foundMasechet.startDaf;
  
  // Guard against invalid daf numbers
  if (relativeOffset < 0 || relativeOffset >= foundMasechet.dafim) {
    return null;
  }
  
  const totalOffset = masechetOffset + relativeOffset;
  const targetDate = new Date(CYCLE_14_START);
  targetDate.setDate(CYCLE_14_START.getDate() + totalOffset);
  return targetDate;
}

import { toJewishDate, toHebrewJewishDate } from "jewish-date";

/**
 * Returns the Hebrew day string (e.g. "י״ז אייר") for a given Gregorian date.
 */
export function getHebrewDateString(year: number, month: number, day: number): string {
  const jewishDate = toJewishDate(new Date(year, month, day));
  const hebrewDate = toHebrewJewishDate(jewishDate);
  return `${hebrewDate.day} ${hebrewDate.monthName}`;
}

/**
 * Returns just the Hebrew day number string (e.g. "י״ז") for compact display.
 */
export function getHebrewDay(year: number, month: number, day: number): string {
  const jewishDate = toJewishDate(new Date(year, month, day));
  const hebrewDate = toHebrewJewishDate(jewishDate);
  return hebrewDate.day;
}

/**
 * Returns the Hebrew month name(s) that span a given Gregorian month.
 * E.g. "אייר" or "ניסן–אייר" if two Hebrew months overlap.
 */
export function getHebrewMonthsForGregorian(year: number, month: number): string {
  const first = toHebrewJewishDate(toJewishDate(new Date(year, month, 1)));
  const lastDay = new Date(year, month + 1, 0).getDate();
  const last = toHebrewJewishDate(toJewishDate(new Date(year, month, lastDay)));
  if (first.monthName === last.monthName) {
    return `${first.monthName} ${first.year}`;
  }
  return `${first.monthName}–${last.monthName} ${last.year}`;
}

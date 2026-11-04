import { describe, it, expect } from "vitest";
import { parseTitleForMasechetDafs as p } from "@/lib/daf-parse";

describe("parseTitleForMasechetDafs", () => {
  it("reads 'בדף ב עמ א' as daf ב, not daf א", () => {
    expect(p("הדף היומי בכורות מהמשנה בדף ב עמ א עד דף ג עמ ב במשנה")).toEqual({ masechet: "בכורות", dafs: [2, 3] });
  });
  it("keeps the amud rules", () => {
    expect(p("הדף היומי בכורות מדף מח עמ א במשנה למעלה עד דף מט עמ ב במשנה למטה").dafs).toEqual([48, 49]);
    expect(p("הדף היומי בכורות מדף מב עמ ב עד דף מד עמ א").dafs).toEqual([43]);
  });
  it("never returns daf 1", () => {
    expect(p("ברכות דף א").dafs).toEqual([]);
  });
});

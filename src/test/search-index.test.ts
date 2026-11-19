import { describe, it, expect } from "vitest";
import { buildIndex, useIndex, rankLessons } from "../../server/search-index";
import { phrases } from "../../server/ai";

// 20 lessons about ordinary topics; a few mention the kibbutz in passing, one says "הארות".
const filler = "הגמרא אומרת שהמשנה מדברת על הלכה של שבת ויום טוב והתוספות שואלים";
const lessons = Array.from({ length: 20 }, (_, i) => ({
  id: `v${i}`, m: i < 10 ? "ביצה" : "סוכה", d: i + 2,
  blocks: [[0, filler], [30, `${filler} נושא${i} מיוחד${i}`]] as [number, string][],
}));
lessons[3].blocks.push([60, "כשהייתי רב בקיבוץ בארות יצחק היה מקרה"]);
lessons[12].blocks.push([90, "שאלו אותי בבארות יצחק על הסוכה"]);
lessons[15].blocks.push([45, "אני זוכר שבבארות יצחק עשינו כך"]);
lessons[7].blocks.push([10, "כמה הארות על הסוגיה"]);
lessons[8].blocks.push([10, "עוד הארות חשובות"]);

describe("search index", () => {
  useIndex(JSON.parse(JSON.stringify(buildIndex(lessons))));

  it("finds every lesson that mentions a place in passing, in any prefix form", async () => {
    const r = await rankLessons("איפה הרב מזכיר את בארות יצחק", null, 8);
    expect(r.lessons.slice(0, 3).map(e => e.id).sort()).toEqual(["v12", "v15", "v3"]);
    expect(r.rareWord).toEqual({ word: "בארות", count: 3 });
  });

  it("does not confuse בארות with הארות", async () => {
    const r = await rankLessons("בארות", null, 8);
    expect(r.lessons.map(e => e.id)).not.toContain("v7");
  });

  it("keeps a tractate question inside the tractate", async () => {
    const r = await rankLessons("בארות יצחק", "סוכה", 8);
    expect(r.lessons.map(e => e.id).sort()).toEqual(["v12", "v15"]);
  });

  it("reads old index files (plain list of lessons)", async () => {
    useIndex(buildIndex(lessons).lessons as any);
    const r = await rankLessons("נושא4 מיוחד4", null, 3);
    expect(r.lessons[0].id).toBe("v4");
    useIndex(JSON.parse(JSON.stringify(buildIndex(lessons))));
  });
});

describe("question phrases", () => {
  it("pairs the question's words, also without a leading prefix letter", () => {
    expect(phrases("איפה הרב מזכיר את בבארות יצחק")).toEqual(["בבארות יצחק", "בארות יצחק"]);
  });
});

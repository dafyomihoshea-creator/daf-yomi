// Find lesson summaries with stray letters from another script and write them again.
//   npx tsx scripts/fix-garbled-summaries.ts [--dry-run]   (GOOGLE_APPLICATION_CREDENTIALS = the worker's key,
//   GEMINI_API_KEY = a free Gemini key)
export {};
await import("../server/db");
const { store } = await import("../server/store");
const { catalog, baseYoutubeId } = await import("../server/catalog");
const { summarizeLesson, hasGarbledText } = await import("../server/youtube");
catalog.manualSave = true;

const dry = process.argv.includes("--dry-run");
const all = await catalog.getAll();
const bad = all.filter(v => v.summary && !v.summary_edited && hasGarbledText(String(v.summary)));
const bases = Array.from(new Set(bad.map(v => baseYoutubeId(v.youtube_id))));
console.log(`${bases.length} lessons with a garbled summary${dry ? " (dry run)" : ""}: ${bases.join(", ")}`);

let fixed = 0;
for (const id of bases) {
  if (dry) continue;
  const original = all.find(v => v.youtube_id === id) || bad.find(v => baseYoutubeId(v.youtube_id) === id)!;
  const summary = await summarizeLesson(id, original.title);
  if (!summary) { console.log(`  ${id}: no new summary (AI unavailable)`); continue; }
  const copies = all.filter(v => baseYoutubeId(v.youtube_id) === id);
  await store().commit(copies.map(v => ({ type: "set" as const, path: `videos/${v.youtube_id}`, data: { summary }, merge: true })));
  catalog.upsert(copies.map(v => ({ id: v.youtube_id, data: { summary } })));
  console.log(`  ${id}: fixed${hasGarbledText(summary) ? " (still has a stray sign)" : ""}`);
  fixed++;
}
if (fixed) await catalog.flush();
console.log(`fixed ${fixed}`);
process.exit(0);

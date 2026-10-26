// Remove lessons that should not be on the site (the same lesson uploaded twice, short clips):
// their lesson documents (all per-daf copies) go, and the YouTube sync is told to skip them.
//   npx tsx scripts/remove-videos.ts <videoId>[,<videoId>...] [--dry-run]   (GOOGLE_APPLICATION_CREDENTIALS = the worker's key)
export {};
await import("../server/db");
const { store } = await import("../server/store");
const { catalog, baseYoutubeId } = await import("../server/catalog");
catalog.manualSave = true;

const ids = (process.argv[2] || "").split(",").filter(Boolean);
const dry = process.argv.includes("--dry-run");
if (!ids.length) { console.error("Usage: npx tsx scripts/remove-videos.ts <videoId>,<videoId> [--dry-run]"); process.exit(1); }

const all = await catalog.getAll();
const entries = all.filter(v => ids.includes(baseYoutubeId(v.youtube_id))).map(v => v.youtube_id as string);
console.log(`${dry ? "[dry run] " : ""}removing ${entries.length} entries:`, entries.join(", "));
if (!dry) {
  await store().commit(entries.map(id => ({ type: "delete" as const, path: `videos/${id}` })));
  catalog.remove(entries);
  await catalog.flush();
  const prev = (await store().get("app_meta/ignored_videos"))?.ids || [];
  await store().set("app_meta/ignored_videos", { ids: Array.from(new Set([...prev, ...ids])), updated_at: new Date().toISOString() });
}
process.exit(0);

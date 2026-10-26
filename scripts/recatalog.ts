export {};
// One-time (or any-time) re-assignment of all lessons to dafim by the title rule.
//   npx tsx scripts/recatalog.ts [--dry-run]      (GOOGLE_APPLICATION_CREDENTIALS = the worker's key)
await import("../server/db");
const { catalog } = await import("../server/catalog");
catalog.manualSave = true;
const { recatalogAll } = await import("../server/recatalog");
const r = await recatalogAll(process.argv.includes("--dry-run"));
console.log(process.argv.includes("--dry-run") ? "[dry run]" : "[done]", r);
process.exit(0);

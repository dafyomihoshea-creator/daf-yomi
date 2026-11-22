// Upload a folder of article PDFs with their list (articles.json: n, title, summary, date, file).
// Articles already on the site (same series and number) are skipped, so it is safe to run again.
//   npx tsx scripts/upload-articles.ts <folder> --series="בארות" [--dry-run] [--convert=<articleId>,...]
// --convert also asks the worker to turn already-uploaded Word articles into PDFs.
// (GOOGLE_APPLICATION_CREDENTIALS = the worker's key)
import fs from "fs";
import path from "path";
export {};
await import("../server/db");
const { store } = await import("../server/store");
const { saveArticleFile, markPending } = await import("../server/articles");

const arg = (name: string) => process.argv.find(a => a.startsWith(`--${name}=`))?.split("=").slice(1).join("=");
const folder = process.argv[2];
const series = arg("series") || "";
const dry = process.argv.includes("--dry-run");
const convert = (arg("convert") || "").split(",").filter(Boolean);
if (!folder || folder.startsWith("--")) {
  console.error('Usage: npx tsx scripts/upload-articles.ts <folder> --series="..." [--dry-run] [--convert=id,...]');
  process.exit(1);
}

type Entry = { n: number; title: string; summary?: string; date?: string; file: string };
const list: Entry[] = JSON.parse(fs.readFileSync(path.join(folder, "articles.json"), "utf-8"));

// Check the whole list before writing anything.
const problems: string[] = [];
for (const e of list) {
  if (!e.title?.trim()) problems.push(`#${e.n}: no title`);
  const file = path.join(folder, e.file || "");
  if (!e.file || !fs.existsSync(file)) { problems.push(`#${e.n}: file missing (${e.file})`); continue; }
  const head = fs.readFileSync(file).subarray(0, 5).toString("latin1");
  if (head !== "%PDF-") problems.push(`#${e.n}: ${e.file} is not a PDF`);
}
if (new Set(list.map(e => e.n)).size !== list.length) problems.push("the same number appears twice");
if (problems.length) { console.error("Not uploading:\n" + problems.join("\n")); process.exit(1); }

const existing = await store().list("articles");
const have = new Set(existing.filter(a => a.data.series === series).map(a => Number(a.data.number)));
const todo = list.filter(e => !have.has(e.n)).sort((a, b) => a.n - b.n);
console.log(`${list.length} in the list, ${list.length - todo.length} already on the site, ${todo.length} to upload${dry ? " (dry run)" : ""}`);

// One upload time for the whole series, so it shows together in its own order.
const createdAt = new Date().toISOString();
let bytes = 0;
for (const e of todo) {
  const data = new Uint8Array(fs.readFileSync(path.join(folder, e.file)));
  bytes += data.length;
  if (dry) { console.log(`  #${e.n} ${e.file} (${Math.round(data.length / 1024)} KB)`); continue; }
  const id = store().newId("articles");
  const chunks = await saveArticleFile(id, data);
  await store().set(`articles/${id}`, {
    id, title: e.title.trim(), description: null, summary: e.summary?.trim() || null,
    series: series || null, number: e.n, hebrew_date: e.date?.trim() || null,
    file_chunks: chunks, file_mime: "application/pdf", file_name: e.file, file_type: "pdf",
    status: null, created_at: createdAt,
  });
  console.log(`  uploaded #${e.n}`);
}
console.log(`total ${Math.round(bytes / 1024)} KB`);

if (convert.length) {
  if (dry) console.log(`would ask the worker to convert: ${convert.join(", ")}`);
  else {
    for (const id of convert) await store().set(`articles/${id}`, { status: "converting" }, true);
    await markPending(convert);
    console.log(`the worker will convert to PDF: ${convert.join(", ")}`);
  }
}
process.exit(0);

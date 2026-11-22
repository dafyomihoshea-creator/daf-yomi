// Word articles uploaded by the managers become PDFs (free LibreOffice on GitHub Actions).
//   npx tsx worker/convert-articles.ts --check   prints "pending=N" (one database read)
//   npx tsx worker/convert-articles.ts           converts them (needs LibreOffice: soffice)
// (GOOGLE_APPLICATION_CREDENTIALS = the worker's key)
import fs from "fs";
import os from "os";
import path from "path";
import { execFileSync } from "child_process";
import "../server/db";
import { store } from "../server/store";
import { convertPendingArticles, PENDING_DOC } from "../server/articles";

if (process.argv.includes("--check")) {
  const n = ((await store().get(PENDING_DOC))?.ids || []).length;
  console.log(`pending=${n}`);
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `pending=${n}\n`);
  process.exit(0);
}

const soffice = process.env.SOFFICE || "soffice";

async function toPdf(data: Uint8Array, fileName: string): Promise<Uint8Array> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "article-"));
  try {
    const ext = (path.extname(fileName) || ".docx").toLowerCase();
    const input = path.join(dir, `article${ext}`);
    fs.writeFileSync(input, data);
    execFileSync(soffice, ["--headless", "--norestore", "--convert-to", "pdf", "--outdir", dir, input], { stdio: "inherit", timeout: 180_000 });
    return new Uint8Array(fs.readFileSync(path.join(dir, "article.pdf")));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

const result = await convertPendingArticles(toPdf);
console.log("[Word articles to PDF]", JSON.stringify(result));
process.exit(result.failed ? 1 : 0);

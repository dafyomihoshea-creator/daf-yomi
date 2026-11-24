// After `vite build`: write one HTML file per page (home, lists, every tractate and lesson)
// with its own title, description and structured data, plus sitemap.xml, robots.txt and
// rss.xml — what the old server produced on every request. Firebase Hosting then serves them
// as plain files (firebase.json: cleanUrls; other addresses fall back to app.html).
//   npx tsx worker/build-static.ts        (GOOGLE_APPLICATION_CREDENTIALS = the worker's key)
import fs from "fs";
import path from "path";
import "../server/db";
import { catalog, baseYoutubeId } from "../server/catalog";
import { renderPage, SITE_URL } from "../server/seo";
import { getTranscriptBlocks } from "../server/transcripts";
import { buildIndex, saveIndex } from "../server/search-index";

const DIST = path.resolve("dist");
const template = fs.readFileSync(path.join(DIST, "index.html"), "utf-8");
const esc = (s: string) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function write(rel: string, content: string) {
  const file = path.join(DIST, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

const all = await catalog.getAll();
const masechtot = Array.from(new Set(all.map(v => v.masechet).filter(Boolean))) as string[];

// Addresses without their own file (login, admin, my lessons, ...) get the plain app page.
write("app.html", await renderPage(template, "/app"));
write("index.html", await renderPage(template, "/"));
// Any other address: Firebase answers "404 not found" with this page (the app then shows its not-found screen).
write("404.html", await renderPage(template, "/404"));
for (const p of ["/browse", "/calendar", "/articles"]) write(`${p}.html`, await renderPage(template, p));
for (const m of masechtot) write(`masechet/${m}.html`, await renderPage(template, `/masechet/${encodeURIComponent(m)}`));
for (const v of all) write(`lesson/${v.youtube_id}.html`, await renderPage(template, `/lesson/${encodeURIComponent(v.youtube_id)}`));

const urls = ["/", "/browse", "/calendar", "/articles"].map(p => `<url><loc>${SITE_URL}${p}</loc></url>`);
for (const m of masechtot) urls.push(`<url><loc>${SITE_URL}/masechet/${encodeURIComponent(m)}</loc></url>`);
// Only the original lesson pages: a per-daf copy points Google at its original.
for (const v of all) if (v.youtube_id === baseYoutubeId(v.youtube_id)) urls.push(`<url><loc>${SITE_URL}/lesson/${encodeURIComponent(v.youtube_id)}</loc>${v.published_at ? `<lastmod>${String(v.published_at).slice(0, 10)}</lastmod>` : ""}</url>`);
write("sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.join("")}</urlset>`);
// Search engines are welcome. Robots that only copy sites in bulk (SEO-tool crawlers, data
// scrapers) use up the free monthly hosting traffic and bring no readers, so they are asked
// to stay away.
const BULK_BOTS = ["AhrefsBot", "SemrushBot", "MJ12bot", "DotBot", "BLEXBot", "DataForSeoBot", "PetalBot", "Bytespider", "CCBot", "meta-externalagent", "Amazonbot", "ImagesiftBot", "Barkrowler", "SeekportBot", "serpstatbot"];
write("robots.txt", [
  "User-agent: *", "Allow: /", "Disallow: /admin", "Disallow: /login", "Disallow: /search-index.json", "",
  ...BULK_BOTS.flatMap(b => [`User-agent: ${b}`, "Disallow: /", ""]),
  `Sitemap: ${SITE_URL}/sitemap.xml`, "",
].join("\n"));

const latest = [...all].sort((a, b) => String(b.published_at || "").localeCompare(String(a.published_at || ""))).slice(0, 50);
const items = latest.map(v => `<item><title>${esc(v.title)}</title><link>${SITE_URL}/lesson/${encodeURIComponent(v.youtube_id)}</link><guid isPermaLink="false">${esc(v.youtube_id)}</guid><pubDate>${new Date(v.published_at || Date.now()).toUTCString()}</pubDate><description>${esc(v.summary || v.title)}</description></item>`).join("");
write("rss.xml", `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>שיעורי הרב הושע רבינוביץ׳</title><link>${SITE_URL}</link><description>שיעורי הדף היומי</description><language>he</language>${items}</channel></rss>`);

// Keyword index of all transcripts, for tractate-wide and Shas-wide chatbot questions.
const withText = new Map<string, any>();
for (const v of all) if (v.has_transcript && !withText.has(baseYoutubeId(v.youtube_id))) withText.set(baseYoutubeId(v.youtube_id), v);
const lessons = [];
for (const [id, v] of withText) {
  const blocks = await getTranscriptBlocks(id).catch(() => null);
  if (blocks?.length) lessons.push({ id, m: v.masechet ?? null, d: v.daf ?? null, blocks });
}
// Kept in the database for signed-in visitors, not as a public file: robots downloaded the
// 10 MB file over and over and used up the free monthly hosting traffic.
const saved = await saveIndex(buildIndex(lessons));

console.log(`[Static] ${lessons.length} transcripts indexed (${saved.changed ? `saved, ${Math.round(saved.bytes / 1024)} KB in ${saved.pieces} pieces` : "unchanged"}), ${all.length} lessons, ${masechtot.length} tractates written to dist/.`);
process.exit(0);

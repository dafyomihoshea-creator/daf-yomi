// The site has no server: the free Firebase plan only hosts files. The pages still call the
// old "/api/..." addresses; this file answers those calls inside the browser, with the same
// data code the server used (server/*.ts) talking to Firestore directly. Manager-only actions
// are protected by the security rules (firestore.rules), not only by the checks here.
import "@/lib/store-web";
import { auth } from "@/lib/firebase";
import { config, store } from "../../server/store";
import { catalog, baseYoutubeId, type Meta } from "../../server/catalog";
import { getTranscriptSegments, saveTranscript, deleteTranscript } from "../../server/transcripts";
import { parseLegacyTranscript } from "../../server/transcript-format";
import { runYouTubeSync, fillMissingSummaries } from "../../server/youtube";
import { recatalogAll } from "../../server/recatalog";
import { answerQuestion, smartSearch } from "../../server/ai";
import { askGemini } from "../../server/gemini";
import { saveArticleFile, deleteArticleFile } from "../../server/articles";

// Keep the catalog between visits; a visit then costs one read (the version check).
const CATALOG_KEY = "dafyomi_catalog_v3";
catalog.cache = {
  load() {
    try { const c = JSON.parse(localStorage.getItem(CATALOG_KEY) || "null"); return c?.meta && Array.isArray(c.videos) ? c : null; } catch { return null; }
  },
  save(meta: Meta, videos: any[]) {
    try { localStorage.setItem(CATALOG_KEY, JSON.stringify({ meta, videos })); } catch { /* storage full — memory is enough */ }
  },
};

class HttpError extends Error { constructor(public status: number, message: string) { super(message); } }

function isAdmin() {
  const u = auth.currentUser;
  return !!u?.email && u.emailVerified && config.adminEmails.includes(u.email.toLowerCase());
}
function requireAdmin() {
  if (!isAdmin()) throw new HttpError(auth.currentUser ? 403 : 401, "Admin access required");
}

// Simple per-visitor limit so one person can't use up the free daily AI quota.
function allowAi(kind: string, perHour: number) {
  const key = `dafyomi_ai_${kind}`;
  const now = Date.now();
  let u: { count: number; reset: number };
  try { u = JSON.parse(localStorage.getItem(key) || "null") || { count: 0, reset: 0 }; } catch { u = { count: 0, reset: 0 }; }
  if (now > u.reset) u = { count: 0, reset: now + 3600_000 };
  if (u.count >= perHour) return false;
  u.count++;
  try { localStorage.setItem(key, JSON.stringify(u)); } catch { /* ignore */ }
  return true;
}

type Req = { method: string; path: string; query: URLSearchParams; body: any; raw: BodyInit | null | undefined; contentType: string };
type Handler = (req: Req, m: RegExpMatchArray) => Promise<any>;
const routes: Array<[string, RegExp, Handler]> = [];
const on = (method: string, pattern: RegExp, h: Handler) => routes.push([method, pattern, h]);

on("GET", /^\/api\/admin\/whoami$/, async () => {
  const u = auth.currentUser;
  return { signedIn: !!u, email: u?.email ?? null, isAdmin: isAdmin() };
});

on("GET", /^\/api\/site-settings$/, async () => {
  const data: Record<string, string> = {};
  (await store().list("site_settings")).forEach(d => { if (d.data.key) data[d.data.key] = d.data.value; });
  return data;
});

on("POST", /^\/api\/catalog\/refresh$/, async req => {
  requireAdmin();
  const ids = Array.isArray(req.body?.ids) ? req.body.ids.filter((x: any) => typeof x === "string") : [];
  await catalog.refresh(ids);
  await catalog.flush();
  return { success: true, version: catalog.version };
});

on("POST", /^\/api\/admin\/catalog\/rebuild$/, async () => { requireAdmin(); return { success: true, count: await catalog.rebuild() }; });

// New lessons are picked up by the nightly worker; visitors no longer trigger syncs.
on("ANY", /^\/api\/auto-sync-check$/, async () => ({ success: true, skipped: true, reason: "nightly" }));

on("POST", /^\/api\/sync-youtube$/, async () => { requireAdmin(); return { message: "Sync job completed", ...(await runYouTubeSync()) }; });

on("POST", /^\/api\/generate-summaries$/, async req => {
  requireAdmin();
  const processed = await fillMissingSummaries(Math.min(Number(req.body?.limit) || 10, 30));
  return { processed, skipped: 0, total: processed };
});
on("POST", /^\/api\/start-auto-summaries$/, async () => {
  requireAdmin();
  fillMissingSummaries(30).catch(err => console.warn("[Summaries]", err?.message || err));
  return { message: "Background task started" };
});
on("GET", /^\/api\/ai-job-status$/, async () => { requireAdmin(); return { isRunning: false, lastLog: null }; });

on("POST", /^\/api\/re-catalog-videos$/, async () => {
  requireAdmin();
  const r = await recatalogAll();
  return { message: "Re-cataloging completed", updated: r.updated, inserted: r.created, removed: r.removed };
});

on("GET", /^\/api\/video-transcript\/([^/]+)$/, async (_req, m) => {
  const segments = await getTranscriptSegments(decodeURIComponent(m[1]));
  if (!segments) throw new HttpError(404, "אין עדיין תמלול לשיעור זה.");
  return { segments, source: "database" };
});
on("POST", /^\/api\/video-transcript\/([^/]+)$/, async (req, m) => {
  requireAdmin();
  const id = baseYoutubeId(decodeURIComponent(m[1]));
  if (req.body?.fromYoutube) throw new HttpError(404, "הבאת כתוביות מיוטיוב נעשית בעדכון הלילי האוטומטי. אפשר לנסות שוב מחר.");
  const segments = parseLegacyTranscript(req.body?.segments);
  if (!segments.length) throw new HttpError(400, "Invalid segments");
  await saveTranscript(id, segments.map(s => [Math.floor(s.start), s.text] as [number, string]), "manual");
  await catalog.flush();
  return { success: true };
});
on("DELETE", /^\/api\/video-transcript\/([^/]+)$/, async (_req, m) => {
  requireAdmin();
  await deleteTranscript(decodeURIComponent(m[1]));
  await catalog.flush();
  return { success: true };
});

on("POST", /^\/api\/chatbot\/query$/, async req => {
  if (!auth.currentUser) throw new HttpError(401, "חברותא AI זמין למשתמשים רשומים בלבד. יש להתחבר כדי להשתמש בו.");
  if (!req.body?.message) throw new HttpError(400, "Missing message");
  if (!allowAi("chat", 20)) throw new HttpError(429, "הגעת למגבלת השאלות לשעה. נסה שוב מאוחר יותר.");
  return answerQuestion(req.body);
});
on("POST", /^\/api\/ai-search$/, async req => {
  const query = String(req.body?.query || "").trim().slice(0, 200);
  if (!query) throw new HttpError(400, "Missing query");
  if (!allowAi("search", 30)) throw new HttpError(429, "יותר מדי חיפושים. נסה שוב מאוחר יותר.");
  return smartSearch(query);
});

on("POST", /^\/api\/admin\/articles$/, async req => {
  requireAdmin();
  const title = String(req.query.get("title") || "").trim();
  const fileName = String(req.query.get("fileName") || "article.pdf");
  const data = req.raw instanceof Blob ? new Uint8Array(await req.raw.arrayBuffer()) : null;
  if (!title || !data?.length) throw new HttpError(400, "Missing title or file");
  const id = store().newId("articles");
  const chunks = await saveArticleFile(id, data);
  await store().set(`articles/${id}`, {
    id, title, description: String(req.query.get("description") || "") || null, summary: null,
    file_chunks: chunks, file_mime: req.contentType || "application/pdf", file_name: fileName,
    file_type: fileName.split(".").pop() || "pdf", created_at: new Date().toISOString(),
  });
  return { success: true, id };
});
on("DELETE", /^\/api\/admin\/articles\/([^/]+)$/, async (_req, m) => {
  requireAdmin();
  const id = decodeURIComponent(m[1]);
  const a = await store().get(`articles/${id}`);
  if (a?.file_chunks) await deleteArticleFile(id, a.file_chunks);
  await store().delete(`articles/${id}`);
  return { success: true };
});
on("POST", /^\/api\/generate-article-summary$/, async req => {
  requireAdmin();
  const path = `articles/${String(req.body?.article_id || "")}`;
  const a = await store().get(path);
  if (!a) throw new HttpError(404, "Article not found");
  const summary = await askGemini({
    system: "כתוב תקציר קצר בעברית (3-4 משפטים, עד 300 תווים) למאמר או ספר תורני.",
    prompt: `כותרת: ${a.title}\n${a.description ? `תיאור: ${a.description}\n` : ""}כתוב תקציר:`,
  });
  if (!summary) throw new HttpError(503, "מערכת ה-AI אינה זמינה כרגע");
  await store().set(path, { summary }, true);
  return { summary };
});

async function handle(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = new URL(input instanceof Request ? input.url : String(input), window.location.origin);
  const method = (init?.method || (input instanceof Request ? input.method : "GET")).toUpperCase();
  const headers = new Headers(init?.headers);
  const contentType = headers.get("Content-Type") || "";
  let body: any = null;
  if (typeof init?.body === "string" && contentType.includes("json")) { try { body = JSON.parse(init.body); } catch { /* not JSON */ } }
  const req: Req = { method, path: url.pathname, query: url.searchParams, body, raw: init?.body, contentType };
  for (const [m, pattern, h] of routes) {
    const match = url.pathname.match(pattern);
    if (!match || (m !== "ANY" && m !== method)) continue;
    try {
      return Response.json(await h(req, match));
    } catch (err: any) {
      const status = err instanceof HttpError ? err.status : 500;
      if (status >= 500) console.error(`[${method} ${url.pathname}]`, err?.message || err);
      return Response.json({ error: err?.message || "Error" }, { status });
    }
  }
  return Response.json({ error: "Not found" }, { status: 404 });
}

/** Answer same-site "/api/..." calls in the browser; everything else goes to the network. */
export function installLocalApi() {
  const realFetch = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const raw = input instanceof Request ? input.url : String(input);
    const url = new URL(raw, window.location.origin);
    if (url.origin === window.location.origin && url.pathname.startsWith("/api/")) return handle(input, init);
    return realFetch(input, init);
  };
}

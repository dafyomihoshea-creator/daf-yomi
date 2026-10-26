// Create transcripts with Gemini (free key) for lessons whose YouTube video has no captions,
// and save them to the site. Gemini listens to the whole YouTube lesson and writes down the
// Rabbi's words with timestamps.
//
// Free and resumable: progress is kept in the database (app_meta/transcribe_state) and each
// Gemini answer in scripts/.gemini-out/, so a stop (quota, error) loses nothing — just run it
// again. It also stays under the database's free daily write budget.
//
//   npx tsx scripts/transcribe-gemini.ts run [--max-units=20000] [--limit=N] [--save-every=10]
//   npx tsx scripts/transcribe-gemini.ts --test=<videoId>,<videoId> [--minutes=10]   (no database, writes .gemini-out/test-*.txt)
//
// In the nightly worker (WORKER=1, GitHub Actions) it saves and exits when Gemini's free daily
// limit is used up or after --max-hours (default 5); on a computer it waits for the next day.
import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";

const WORKER = !!process.env.WORKER;
const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OUT = WORKER ? path.join(os.tmpdir(), "gemini-out") : path.join(ROOT, "scripts", ".gemini-out");
const STATE_FILE = path.join(OUT, "state.json");
const STATE_DOC = "app_meta/transcribe_state";
fs.mkdirSync(OUT, { recursive: true });

const argStr = (name: string) => process.argv.find(a => a.startsWith(`--${name}=`))?.split("=").slice(1).join("=");
const argNum = (name: string, def: number) => Number(argStr(name) ?? def);
const TEST = argStr("test")?.split(",").filter(Boolean);
if (!TEST && process.argv[2] !== "run") { console.error("Usage: npx tsx scripts/transcribe-gemini.ts run  |  --test=<videoId>"); process.exit(1); }
const MAX_UNITS = argNum("max-units", 20000);
const LIMIT = argNum("limit", 100000);
const SAVE_EVERY = argNum("save-every", WORKER ? 5 : 10);
const CHUNK_SEC = 600;
const MODELS = (argStr("models") || "gemini-3.8-flash,gemini-3.7-flash,gemini-3.6-flash,gemini-3.5-flash,gemini-3-flash-preview").split(",");
const KEY = (process.env.GEMINI_TRANSCRIBE_KEY || process.env.GEMINI_API_KEY || fs.readFileSync(path.join(ROOT, ".local-gemini-key"), "utf-8")).trim();

type Block = [number, string];
interface State {
  done: Record<string, { blocks: number; model: string; at: string }>;
  failed: Record<string, { tries: number; error: string }>;
  day: { date: string; units: number };
}
const EMPTY_STATE: State = { done: {}, failed: {}, day: { date: "", units: 0 } };
let state: State;
let store: (() => import("../server/store").Store) | null = null;
if (TEST) {
  state = fs.existsSync(STATE_FILE) ? JSON.parse(fs.readFileSync(STATE_FILE, "utf-8")) : EMPTY_STATE;
} else {
  await import("../server/db");
  store = (await import("../server/store")).store;
  const doc = await store().get(STATE_DOC);
  state = doc?.json ? JSON.parse(doc.json) : EMPTY_STATE;
}
// Saves to the database go out one at a time, in order; flushState() waits for the last one.
let stateWrite: Promise<void> = Promise.resolve();
const saveState = () => {
  const json = JSON.stringify(state);
  if (!store) return fs.writeFileSync(STATE_FILE, json);
  stateWrite = stateWrite.then(() => store!().set(STATE_DOC, { json, updated_at: new Date().toISOString() }))
    .catch((e: any) => console.error("State save failed:", e?.message || e));
};
const flushState = async () => { saveState(); await stateWrite; };
const log = (...a: any[]) => {
  const line = [new Date().toLocaleString("he-IL", { timeZone: "Asia/Jerusalem" }), ...a].join(" ");
  console.log(line);
  if (!WORKER) fs.appendFileSync(path.join(OUT, "run.log"), line + "\n");
};
// A worker run stops by itself before the 6-hour GitHub limit, so nothing finished is lost.
const STARTED = Date.now();
const MAX_HOURS = argNum("max-hours", WORKER ? 5 : 1e6);
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

// Google's free quotas (Gemini and Firestore) reset at midnight Pacific time.
const pacificDate = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });
function msUntilPacificMidnight() {
  const now = new Date();
  const p = new Date(now.toLocaleString("en-US", { timeZone: "America/Los_Angeles" }));
  const next = new Date(p); next.setHours(24, 15, 0, 0); // 00:15 Pacific, a little margin
  return next.getTime() - p.getTime();
}

const PROMPT = (from: string, to: string) => `תמלל מילה במילה, בעברית, את הדברים הנאמרים בקטע זה (מ-${from} עד ${to}) של שיעור הדף היומי של הרב הושע רבינוביץ.
כללים:
- כתוב רק מה שנאמר בפועל, במילים של הדובר. אל תסכם, אל תשכתב, אל תוסיף הסברים ואל תמציא.
- אם קטע לא ברור, כתוב [לא ברור].
- פצל לשורות של משפט או שניים. בתחילת כל שורה חותמת זמן מתחילת הסרטון בפורמט [שש:דד:שש] (שעות:דקות:שניות).
- אם אין דיבור, אל תכתוב כלום.`;

const hms = (s: number) => [Math.floor(s / 3600), Math.floor(s / 60) % 60, s % 60].map(n => String(n).padStart(2, "0")).join(":");

class QuotaError extends Error {}
const exhausted = new Map<string, string>(); // model -> Pacific date it ran out

async function geminiChunk(id: string, start: number, end: number): Promise<{ text: string; model: string }> {
  let lastErr = "";
  for (const model of MODELS) {
    if (exhausted.get(model) === pacificDate()) continue;
    for (let attempt = 1; attempt <= 2; attempt++) {
      const body = {
        contents: [{ role: "user", parts: [
          { fileData: { fileUri: `https://www.youtube.com/watch?v=${id}`, mimeType: "video/*" }, videoMetadata: { startOffset: `${start}s`, endOffset: `${end}s`, fps: 0.05 } },
          { text: PROMPT(hms(start), hms(end)) },
        ] }],
        generationConfig: { temperature: 0, mediaResolution: "MEDIA_RESOLUTION_LOW", maxOutputTokens: 65000, thinkingConfig: { thinkingLevel: "low" } },
      };
      let r: Response, j: any;
      try {
        r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${KEY}`, {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(600_000),
        });
        j = await r.json();
      } catch (e: any) { lastErr = String(e?.message || e); await sleep(30_000); continue; }
      if (r.status === 429) {
        const msg = JSON.stringify(j?.error || {});
        if (/PerDay|per day|daily/i.test(msg)) { log(`${model}: free daily limit reached.`); exhausted.set(model, pacificDate()); break; }
        lastErr = msg.slice(0, 300); await sleep(65_000); continue; // per-minute limit: wait and retry
      }
      if (r.status === 404) { exhausted.set(model, "9999"); break; }
      if (!r.ok) { lastErr = `${r.status} ${JSON.stringify(j?.error || j).slice(0, 300)}`; await sleep(20_000); continue; }
      const cand = j.candidates?.[0];
      const text = (cand?.content?.parts || []).map((p: any) => p.text || "").join("");
      if (cand?.finishReason && !["STOP", "MAX_TOKENS"].includes(cand.finishReason)) { lastErr = `finish ${cand.finishReason}`; continue; }
      if (looksLooped(text)) { lastErr = "repetition loop"; continue; }
      return { text, model };
    }
  }
  if (MODELS.every(m => exhausted.get(m) === pacificDate() || exhausted.get(m) === "9999")) throw new QuotaError("all models over daily limit");
  throw new Error(lastErr || "gemini failed");
}

/** A model stuck repeating itself produces many identical lines — reject that output. */
function looksLooped(text: string) {
  const lines = text.split("\n").map(l => l.replace(/^\s*\[[\d:]+\]\s*/, "").trim()).filter(l => l.length > 8);
  if (lines.length < 20) return false;
  const counts = new Map<string, number>();
  for (const l of lines) counts.set(l, (counts.get(l) || 0) + 1);
  return Math.max(...counts.values()) > Math.max(6, lines.length * 0.15);
}

/** "[hh:mm:ss] text" lines → [seconds, text]. Timestamps relative to the piece are shifted. */
function parseLines(text: string, start: number, end: number): Array<[number, string]> {
  const out: Array<[number, string]> = [];
  const re = /^\s*\[(?:(\d+):)?(\d{1,2}):(\d{2})(?:\.\d+)?\]\s*(.*)$/;
  // Gemini sometimes writes several timestamps on one line: start a new line at each one.
  const flat = text.replace(/\s*(\[(?:\d+:)?\d{1,2}:\d{2}(?:\.\d+)?\])/g, "\n$1");
  for (const raw of flat.split("\n")) {
    const m = re.exec(raw.replace(/\*\*/g, ""));
    const said = m?.[4].replace(/\s*(-{2,}|—|…)\s*$/, "").trim(); // pieces end mid-word with "---"
    if (!m || !said) continue;
    out.push([(m[1] ? +m[1] * 3600 : 0) + +m[2] * 60 + +m[3], said]);
  }
  // Gemini sometimes switches to times counted from the start of the piece, even mid-piece.
  for (const l of out) if (start > 0 && l[0] < start - 30 && l[0] <= end - start + 30) l[0] += start;
  return out.map(([t, s]) => [Math.min(Math.max(t, start), end), s] as [number, string]);
}

function toBlocks(lines: Array<[number, string]>): Block[] {
  const blocks: Block[] = [];
  let start = -1, buf: string[] = [];
  for (const [t, s] of lines) {
    if (start < 0) start = t;
    if (t - start >= 30 && buf.length) { blocks.push([start, buf.join(" ")]); start = t; buf = []; }
    buf.push(s);
  }
  if (buf.length) blocks.push([Math.max(0, start), buf.join(" ")]);
  return blocks;
}

async function videoSeconds(id: string): Promise<number> {
  try {
    const html = await (await fetch(`https://www.youtube.com/watch?v=${id}`, { headers: { "Accept-Language": "he" } })).text();
    const n = Number(/"lengthSeconds":"(\d+)"/.exec(html)?.[1]);
    if (n > 0) return n;
  } catch { /* fall through */ }
  // YouTube sometimes hides the page from servers; the official API knows the length too.
  const key = process.env.YOUTUBE_API_KEY;
  if (key) try {
    const j: any = await (await fetch(`https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${id}&key=${key}`)).json();
    const m = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/.exec(j?.items?.[0]?.contentDetails?.duration || "");
    const n = m ? +(m[1] || 0) * 3600 + +(m[2] || 0) * 60 + +(m[3] || 0) : 0;
    if (n > 0) return n;
  } catch { /* fall through */ }
  return 0;
}

/** Gemini's text for one request, cached on disk so a restart never pays for it twice. */
async function piece(file: string, id: string, s: number, e: number): Promise<{ text: string; model: string }> {
  if (fs.existsSync(file)) {
    const text = fs.readFileSync(file, "utf-8");
    return { text, model: /^#model (\S+)/.exec(text)?.[1] || "" };
  }
  const res = await geminiChunk(id, s, e);
  fs.writeFileSync(file, `#model ${res.model}\n${res.text}`);
  return res;
}

/**
 * Transcribe a whole video. The free tier allows only 20 requests a day per model, so the
 * whole lesson goes in one request; if the answer stops early, continue from its last line.
 */
async function transcribe(id: string, maxSec = Infinity): Promise<{ blocks: Block[]; model: string } | null> {
  let total = await videoSeconds(id);
  if (!total) throw new Error("could not read video length (private/removed?)");
  if (total < 120) return null; // a few-second clip, not a lesson
  total = Math.min(total, maxSec);
  let lines: Array<[number, string]> = [];
  let model = "";
  const oldPieces = Array.from({ length: Math.ceil(total / CHUNK_SEC) }, (_, i) => path.join(OUT, `${id}.${i * CHUNK_SEC}.txt`));
  if (oldPieces.every(f => fs.existsSync(f))) {
    // Finished earlier in 10-minute pieces (first trial).
    for (const [i, f] of oldPieces.entries()) {
      const res = await piece(f, id, i * CHUNK_SEC, Math.min(total, (i + 1) * CHUNK_SEC));
      model ||= res.model;
      lines.push(...parseLines(res.text, i * CHUNK_SEC, Math.min(total, (i + 1) * CHUNK_SEC)));
    }
  } else {
    for (let s = 0, round = 0; round < 6; round++) {
      const res = await piece(path.join(OUT, `${id}.from${s}.txt`), id, s, total);
      model ||= res.model;
      const got = parseLines(res.text, s, total).filter(l => l[0] >= s);
      if (!got.length) break;
      lines = lines.filter(l => l[0] < s).concat(got);
      const last = Math.max(...got.map(l => l[0]));
      if (last >= total - 120 || last < s + 60) break;
      s = last; // the answer stopped early: ask for the rest, starting at its last line
    }
  }
  lines.sort((a, b) => a[0] - b[0]);
  return lines.length ? { blocks: toBlocks(lines), model } : null;
}

// ---------- Test mode: transcribe a few videos to local files only ----------
if (TEST) {
  for (const id of TEST) {
    const t0 = Date.now();
    const res = await transcribe(id, argNum("minutes", 1e6) * 60);
    const txt = (res?.blocks || []).map(([t, s]) => `[${hms(t)}] ${s}`).join("\n\n");
    fs.writeFileSync(path.join(OUT, `test-${id}.txt`), txt);
    log(`${id}: ${res?.blocks.length || 0} blocks, ${txt.length} chars, model ${res?.model}, ${Math.round((Date.now() - t0) / 1000)}s`);
  }
  process.exit(0);
}

// ---------- Full run against the site database ----------
const { catalog, baseYoutubeId } = await import("../server/catalog");
catalog.manualSave = true;
const { saveTranscript } = await import("../server/transcripts");
const { encodeBlocks } = await import("../server/transcript-format");

const CATALOG_SAVE_UNITS = 250; // rough write cost of one catalog snapshot save

function useUnits(n: number) {
  if (state.day.date !== pacificDate()) state.day = { date: pacificDate(), units: 0 };
  state.day.units += n;
  saveState();
}
function unitsLeft() { return state.day.date === pacificDate() ? MAX_UNITS - state.day.units : MAX_UNITS; }

const pending: Array<{ id: string; blocks: Block[]; model: string }> = [];

/** Save finished transcripts in one go: fresh catalog first, so the site's own edits are kept. */
async function savePending() {
  if (!pending.length) return;
  await catalog.sync();
  const have = new Set((await catalog.getAll()).filter(v => v.has_transcript).map(v => baseYoutubeId(v.youtube_id)));
  let units = CATALOG_SAVE_UNITS, n = 0;
  for (const p of pending) {
    if (have.has(p.id)) { state.done[p.id] = { blocks: 0, model: "skipped (already had one)", at: new Date().toISOString() }; continue; }
    await saveTranscript(p.id, p.blocks, "gemini");
    units += Math.ceil((await encodeBlocks(p.blocks)).length / 1024) + 3;
    state.done[p.id] = { blocks: p.blocks.length, model: p.model, at: new Date().toISOString() };
    n++;
  }
  await catalog.flush();
  useUnits(units);
  pending.length = 0;
  log(`Saved ${n} transcripts to the site (~${units} write units; today ${state.day.units}/${MAX_UNITS}).`);
}

async function waitForTomorrow(why: string) {
  await savePending().catch(e => log("Save failed, will retry:", e?.message || e));
  if (WORKER) { await flushState(); log(`${why} — stopping; the next daily run continues.`); process.exit(0); }
  const ms = msUntilPacificMidnight();
  log(`${why} — waiting ${Math.round(ms / 3600000 * 10) / 10} hours for the free quota to reset.`);
  await sleep(ms);
  exhausted.clear();
}

// --resave=<id>,<id>: rebuild already-saved Gemini transcripts from the local files (after a fix).
const RESAVE = argStr("resave")?.split(",").filter(Boolean);
if (RESAVE) {
  await catalog.sync();
  for (const id of RESAVE) {
    const res = await transcribe(id);
    if (!res) { log(`${id}: nothing to save`); continue; }
    await saveTranscript(id, res.blocks, "gemini");
    state.done[id] = { blocks: res.blocks.length, model: res.model, at: new Date().toISOString() };
    log(`${id}: re-saved, ${res.blocks.length} blocks`);
  }
  await catalog.flush();
  await flushState();
  process.exit(0);
}

const all = await catalog.getAll();
const byBase = new Map<string, any>();
for (const v of all) {
  const base = baseYoutubeId(v.youtube_id);
  if (v.has_transcript) { byBase.set(base, null); continue; }
  if (!byBase.has(base)) byBase.set(base, v);
}
const todo = Array.from(byBase.entries())
  .filter(([id, v]) => v && !state.done[id] && (state.failed[id]?.tries || 0) < 3)
  .map(([id, v]) => ({ id, title: String(v.title || ""), date: String(v.published_at || "") }))
  .sort((a, b) => b.date.localeCompare(a.date))
  .slice(0, LIMIT);
log(`Lessons to transcribe: ${todo.length} (done earlier: ${Object.keys(state.done).length}).`);

for (const [i, v] of todo.entries()) {
  if (Date.now() - STARTED > MAX_HOURS * 3600_000) await waitForTomorrow("Time limit for this run");
  saveState();
  for (;;) {
    if (unitsLeft() < 2000) { await waitForTomorrow("Daily database write budget reached"); continue; }
    try {
      const t0 = Date.now();
      const res = await transcribe(v.id);
      if (!res) { state.failed[v.id] = { tries: 3, error: "no speech or under 2 minutes" }; saveState(); log(`[${i + 1}/${todo.length}] ${v.id}: no speech or under 2 minutes`); break; }
      pending.push({ id: v.id, ...res });
      delete state.failed[v.id];
      log(`[${i + 1}/${todo.length}] ${v.id}: ${res.blocks.length} blocks (${res.model}, ${Math.round((Date.now() - t0) / 1000)}s) ${v.title.slice(0, 50)}`);
      if (pending.length >= SAVE_EVERY) await savePending();
      break;
    } catch (err: any) {
      if (err instanceof QuotaError) { await waitForTomorrow("Gemini free daily limit reached"); continue; }
      const f = state.failed[v.id] = { tries: (state.failed[v.id]?.tries || 0) + 1, error: String(err?.message || err).slice(0, 300) };
      saveState();
      log(`[${i + 1}/${todo.length}] ${v.id}: error (try ${f.tries}): ${f.error}`);
      break;
    }
  }
}
await savePending();
await flushState();
log(`Finished. Transcribed ${Object.values(state.done).filter(d => d.blocks).length} lessons; failed: ${Object.keys(state.failed).length}.`);
process.exit(0);

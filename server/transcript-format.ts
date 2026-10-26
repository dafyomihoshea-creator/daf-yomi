// Transcript cleanup and compact storage format, shared by the browser, the nightly worker
// and the scripts.
//
// YouTube auto-captions repeat each line 2-3 times (a "rolling" window). We remove the
// repeats, merge the text into ~30-second blocks, and store [[startSeconds, text], ...]
// gzip-compressed — roughly 10x smaller than the raw captions.
import { gzip, gunzip } from "./store";

export interface Segment { start: number; duration: number; text: string }
export type Block = [number, string];

const BLOCK_SECONDS = 30;

function cleanWord(w: string) { return w.replace(/[.,!?״"'׳]/g, ""); }

/** Remove the overlapping repeats of rolling auto-captions, keeping each word's start time. */
export function dedupeRolling(segments: Segment[]): Array<{ word: string; start: number }> {
  const words: Array<{ word: string; start: number }> = [];
  for (const s of segments) {
    for (const w of String(s.text || "").replace(/\s+/g, " ").trim().split(" ")) {
      if (w) words.push({ word: w, start: s.start });
    }
  }
  const out: Array<{ word: string; start: number }> = [];
  for (let i = 0; i < words.length; i++) {
    // Does the text starting at i repeat the tail we already have?
    const look = Math.min(out.length, 40);
    const base = out.length - look;
    let best = 0;
    for (let j = base; j < out.length; j++) {
      let n = 0;
      while (j + n < out.length && i + n < words.length && cleanWord(out[j + n].word) === cleanWord(words[i + n].word)) n++;
      if (n >= 3 && j + n >= out.length - 2 && n > best) best = n;
    }
    if (best >= 3) { i += best - 1; continue; }
    out.push(words[i]);
  }
  return out;
}

export function toBlocks(segments: Segment[]): Block[] {
  const words = dedupeRolling(segments);
  const blocks: Block[] = [];
  let start = -1, buf: string[] = [];
  for (const w of words) {
    if (start < 0) start = Math.floor(w.start);
    if (w.start - start >= BLOCK_SECONDS && buf.length) {
      blocks.push([start, buf.join(" ")]);
      start = Math.floor(w.start);
      buf = [];
    }
    buf.push(w.word);
  }
  if (buf.length) blocks.push([Math.max(0, start), buf.join(" ")]);
  return blocks;
}

export function blocksToSegments(blocks: Block[]): Segment[] {
  return blocks.map(([start, text], i) => ({
    start,
    duration: Math.max(1, (blocks[i + 1]?.[0] ?? start + BLOCK_SECONDS) - start),
    text,
  }));
}

export function encodeBlocks(blocks: Block[]): Promise<Uint8Array> {
  return gzip(JSON.stringify(blocks));
}

export async function decodeBlocks(gz: Uint8Array): Promise<Block[]> {
  return JSON.parse(await gunzip(gz));
}

/** Parse transcripts saved by the old app: an array of segments, JSON text, or "[m:ss] text" lines. */
export function parseLegacyTranscript(raw: any): Segment[] {
  if (Array.isArray(raw)) {
    return raw.map((s: any) => ({ start: Number(s.start) || 0, duration: Number(s.duration) || 0, text: String(s.text || "") }));
  }
  if (typeof raw !== "string") return [];
  try { return parseLegacyTranscript(JSON.parse(raw)); } catch { /* plain text */ }
  const segs: Segment[] = [];
  const re = /\[(?:(\d+):)?(\d+):(\d+)\]\s*([^[]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) {
    const start = (m[1] ? parseInt(m[1]) * 3600 : 0) + parseInt(m[2]) * 60 + parseInt(m[3]);
    const text = m[4].split("---")[0].trim();
    if (text) segs.push({ start, duration: 0, text });
  }
  if (segs.length) return segs;
  return raw.trim() ? [{ start: 0, duration: 0, text: raw.trim() }] : [];
}

/** Fetch YouTube's Hebrew captions. Works from home internet; YouTube often blocks cloud servers. */
export async function fetchYouTubeCaptions(videoId: string): Promise<Segment[] | null> {
  const { YoutubeTranscript } = await import("youtube-transcript");
  for (const lang of ["iw", "he", undefined]) {
    try {
      const items = await YoutubeTranscript.fetchTranscript(videoId, lang ? { lang } : undefined);
      if (items?.length) {
        // The library reports offsets in ms for some caption formats and in seconds for others.
        const last = items[items.length - 1];
        const inMs = Number(last.offset) > 20000;
        return items.map((x: any) => ({
          start: inMs ? x.offset / 1000 : Number(x.offset),
          duration: inMs ? x.duration / 1000 : Number(x.duration),
          text: decodeEntities(String(x.text || "")),
        }));
      }
    } catch (e: any) {
      const msg = String(e?.message || e);
      if (/disabled|No transcripts|not available/i.test(msg)) return null;
      if (/too many|captcha|429/i.test(msg)) throw new Error("YOUTUBE_RATE_LIMIT");
    }
  }
  return null;
}

function decodeEntities(s: string) {
  return s.replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\s+/g, " ").trim();
}

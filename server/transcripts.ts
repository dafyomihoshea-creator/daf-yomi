// Lesson transcripts: one small gzip document per YouTube video in /transcripts/{videoId}.
// Several catalog entries (one per daf) can share a video, so transcripts are keyed by the
// 11-character YouTube id.
import { store } from "./store";
import { catalog, baseYoutubeId } from "./catalog";
import { type Block, type Segment, blocksToSegments, decodeBlocks, encodeBlocks, fetchYouTubeCaptions, toBlocks } from "./transcript-format";

const CACHE_MAX = 200;
const cache = new Map<string, Block[] | null>();

function remember(id: string, blocks: Block[] | null) {
  cache.delete(id);
  cache.set(id, blocks);
  if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value as string);
}

/** Read a transcript (3–5 read units), cached in memory. Returns null when none exists. */
export async function getTranscriptBlocks(videoId: string): Promise<Block[] | null> {
  const id = baseYoutubeId(videoId);
  if (cache.has(id)) return cache.get(id)!;
  // Skip the read entirely when the catalog says there is no transcript.
  const entry = await catalog.get(id);
  if (entry && !entry.has_transcript) { remember(id, null); return null; }
  const doc = await store().get(`transcripts/${id}`);
  const blocks = doc?.gz ? await decodeBlocks(doc.gz) : null;
  remember(id, blocks);
  return blocks;
}

export async function getTranscriptSegments(videoId: string): Promise<Segment[] | null> {
  const blocks = await getTranscriptBlocks(videoId);
  return blocks ? blocksToSegments(blocks) : null;
}

export async function saveTranscript(videoId: string, blocks: Block[], source: string) {
  const id = baseYoutubeId(videoId);
  if (!blocks.length) return deleteTranscript(id);
  await store().set(`transcripts/${id}`, {
    gz: await encodeBlocks(blocks),
    blocks: blocks.length,
    source,
    updated_at: new Date().toISOString(),
  });
  remember(id, blocks);
  await markVideos(id, true);
}

export async function deleteTranscript(videoId: string) {
  const id = baseYoutubeId(videoId);
  await store().delete(`transcripts/${id}`);
  remember(id, null);
  await markVideos(id, false);
}

/** Set has_transcript on every lesson document of this video, and in the catalog. */
async function markVideos(baseId: string, has: boolean) {
  const all = await catalog.getAll();
  const ids = all.filter(v => baseYoutubeId(v.youtube_id) === baseId && !!v.has_transcript !== has).map(v => v.youtube_id);
  await store().commit(ids.map(vid => ({ type: "set", path: `videos/${vid}`, data: { has_transcript: has }, merge: true })));
  catalog.setHasTranscript(baseId, has);
}

/**
 * Try to get the YouTube captions for a new lesson (nightly worker only — browsers can't read
 * YouTube's captions). YouTube often blocks cloud servers, so this may fail.
 */
export async function tryFetchTranscript(videoId: string): Promise<boolean> {
  if (typeof window !== "undefined") return false;
  const id = baseYoutubeId(videoId);
  try {
    const segs = await fetchYouTubeCaptions(id);
    if (!segs?.length) return false;
    await saveTranscript(id, toBlocks(segs), "youtube");
    return true;
  } catch (err: any) {
    console.warn(`[Transcripts] YouTube captions not available for ${id}:`, err?.message || err);
    return false;
  }
}

/** Pick the transcript passages most relevant to a question (keeps AI prompts small). */
export function selectRelevantBlocks(blocks: Block[], question: string, maxChars = 12000): Block[] {
  const words = question
    .replace(/[^֐-׿a-zA-Z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(w => w.length > 2);
  if (!words.length) return blocks.slice(0, Math.max(1, Math.floor(maxChars / 600)));
  const scored = blocks.map((b, i) => {
    const text = b[1];
    let score = 0;
    for (const w of words) if (text.includes(w)) score += 1 + Math.min(3, text.split(w).length - 2);
    return { i, score };
  });
  const picked = new Set<number>();
  let used = 0;
  for (const { i, score } of scored.sort((a, b) => b.score - a.score)) {
    if (score === 0 && picked.size > 0) break;
    for (const j of [i - 1, i, i + 1]) {
      if (j < 0 || j >= blocks.length || picked.has(j)) continue;
      if (used + blocks[j][1].length > maxChars) break;
      picked.add(j);
      used += blocks[j][1].length;
    }
    if (used >= maxChars) break;
  }
  return Array.from(picked).sort((a, b) => a - b).map(j => blocks[j]);
}

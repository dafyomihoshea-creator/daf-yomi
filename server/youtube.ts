// YouTube sync: adds new lessons from the Rabbi's channel. Uses the YouTube Data API
// (free quota, ~3 units per run) and compares against the catalog, so it costs no database
// reads. Runs in the nightly worker and from the admin page.
import { store, config, type Op } from "./store";
import { catalog, baseYoutubeId } from "./catalog";
import { tryFetchTranscript, getTranscriptBlocks } from "./transcripts";
import { askGemini } from "./gemini";
import { getGregorianDateForDaf } from "../src/lib/daf-yomi";
import { parseTitleForMasechetDafs } from "../src/lib/daf-parse";

const CHANNEL_ID = "UC6JUZduip3HRgYDTacpqiQg";
// Stop paging once this many already-known videos are seen in a row.
const KNOWN_IN_A_ROW_TO_STOP = 5;

export { parseTitleForMasechetDafs };

async function writeSyncLog(entry: Record<string, any>) {
  await store().add("sync_logs", { ...entry, ran_at: new Date().toISOString() }).catch(() => {});
}

/** Short summary from the transcript (free Gemini key). */
export async function summarizeLesson(videoId: string, title: string): Promise<string | null> {
  const blocks = await getTranscriptBlocks(videoId);
  if (!blocks?.length) return null;
  const text = blocks.map(b => b[1]).join(" ").slice(0, 6000);
  return askGemini({
    system: "אתה כותב סיכומים קצרים לשיעורי גמרא בעברית: 2-3 משפטים, עד 200 תווים, רק תוכן הלימוד, בלי שם הרב ובלי מספר הדף.",
    prompt: `כותרת: ${title}\n\nתמלול (התחלה):\n${text}\n\nכתוב סיכום קצר:`,
  });
}

let running: Promise<{ newVideos: number }> | null = null;

export function runYouTubeSync(): Promise<{ newVideos: number }> {
  running ??= doSync().finally(() => { running = null; });
  return running;
}

async function doSync(): Promise<{ newVideos: number }> {
  const key = config.youtubeKey;
  if (!key) { console.warn("[Sync] YOUTUBE_API_KEY is not set — skipping."); return { newVideos: 0 }; }
  await catalog.markSynced();

  const known = new Map((await catalog.getAll()).map(v => [v.youtube_id, v]));
  const ch: any = await (await fetch(`https://www.googleapis.com/youtube/v3/channels?part=contentDetails&id=${CHANNEL_ID}&key=${key}`)).json();
  const uploads = ch.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
  if (!uploads) throw new Error("Could not find the channel's uploads playlist");

  const added: Array<{ id: string; title: string }> = [];
  let knownInARow = 0, pageToken = "";
  do {
    const url = new URL("https://www.googleapis.com/youtube/v3/playlistItems");
    url.search = new URLSearchParams({ part: "snippet", playlistId: uploads, maxResults: "50", key, ...(pageToken ? { pageToken } : {}) }).toString();
    const data: any = await (await fetch(url)).json();
    if (!data.items) break;
    for (const item of data.items) {
      const sn = item.snippet;
      const baseId: string = sn.resourceId.videoId;
      const { masechet, dafs } = parseTitleForMasechetDafs(sn.title);
      const parts = dafs.length ? dafs : [null];
      const ids = parts.map((d, i) => (i === 0 ? baseId : `${baseId}_${d}`));
      const root = known.get(baseId);
      if (ids.every(id => known.has(id)) && !(root && root.masechet == null && masechet)) {
        if (++knownInARow >= KNOWN_IN_A_ROW_TO_STOP) break;
        continue;
      }
      knownInARow = 0;
      const thumb = sn.thumbnails?.high?.url || sn.thumbnails?.medium?.url || sn.thumbnails?.default?.url || null;
      const ops: Op[] = [];
      const upserts: Array<{ id: string; data: any }> = [];
      parts.forEach((daf, i) => {
        const id = ids[i];
        const existing = known.get(id);
        if (existing && !(existing.masechet == null && masechet)) return;
        const date = masechet && daf != null ? getGregorianDateForDaf(masechet, daf) : null;
        const data: any = {
          id, youtube_id: id, title: sn.title, masechet, daf, thumbnail_url: thumb,
          published_at: date ? date.toISOString() : sn.publishedAt,
          ...(existing ? {} : { created_at: new Date().toISOString(), has_transcript: false }),
        };
        ops.push({ type: "set", path: `videos/${id}`, data, merge: true });
        upserts.push({ id, data });
      });
      if (upserts.length) {
        await store().commit(ops);
        catalog.upsert(upserts);
        upserts.forEach(u => known.set(u.id, u.data));
        added.push({ id: baseId, title: sn.title });
      }
    }
    if (knownInARow >= KNOWN_IN_A_ROW_TO_STOP) break;
    pageToken = data.nextPageToken || "";
  } while (pageToken);

  // New lessons: try to get captions now, then a short summary.
  for (const v of added.slice(0, 10)) {
    if (await tryFetchTranscript(v.id)) {
      const summary = await summarizeLesson(v.id, v.title);
      if (summary) {
        const same = Array.from(known.values()).filter(x => baseYoutubeId(x.youtube_id) === v.id && !x.summary);
        await store().commit(same.map(x => ({ type: "set", path: `videos/${x.youtube_id}`, data: { summary }, merge: true })));
        catalog.upsert(same.map(x => ({ id: x.youtube_id, data: { summary } })));
      }
    }
  }
  await catalog.flush();
  await writeSyncLog({ type: "youtube_sync", status: "success", new_videos: added.length, total_processed: added.length });
  console.log(`[Sync] Done. ${added.length} new video(s).`);
  return { newVideos: added.length };
}

/** Write short summaries for lessons that have a transcript but no summary yet. */
export async function fillMissingSummaries(limit: number): Promise<number> {
  const all = await catalog.getAll();
  const todo = all.filter(v => v.has_transcript && !v.summary && !v.summary_edited).slice(0, limit);
  let done = 0;
  for (const v of todo) {
    const summary = await summarizeLesson(v.youtube_id, v.title);
    if (!summary) break; // AI quota reached — try again another day
    await store().set(`videos/${v.youtube_id}`, { summary }, true);
    catalog.upsert([{ id: v.youtube_id, data: { summary } }]);
    done++;
  }
  await catalog.flush();
  return done;
}

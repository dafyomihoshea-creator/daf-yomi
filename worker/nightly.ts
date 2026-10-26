// The daily jobs the old server did, run by GitHub Actions (.github/workflows/nightly.yml):
// new lessons from YouTube (with captions when YouTube gives them), and short summaries for
// lessons with a transcript. Each step is independent: one failing doesn't stop the others.
//   npx tsx worker/nightly.ts        (GOOGLE_APPLICATION_CREDENTIALS = the worker's key)
import "../server/db";
import { catalog, baseYoutubeId } from "../server/catalog";
import { runYouTubeSync, fillMissingSummaries } from "../server/youtube";
import { tryFetchTranscript } from "../server/transcripts";

catalog.manualSave = true;
let failed = false;

async function step(name: string, fn: () => Promise<any>) {
  try {
    console.log(`[${name}]`, JSON.stringify(await fn()));
  } catch (err: any) {
    failed = true;
    console.error(`[${name}] failed:`, err?.message || err);
  }
}

await step("YouTube sync", () => runYouTubeSync());

// Lessons of the last two weeks still without a transcript: YouTube's captions may be ready now.
await step("Captions", async () => {
  const since = new Date(Date.now() - 14 * 86400_000).toISOString();
  const recent = (await catalog.getAll()).filter(v => !v.has_transcript && String(v.created_at || "") >= since);
  const ids = Array.from(new Set(recent.map(v => baseYoutubeId(v.youtube_id)))).slice(0, 20);
  let got = 0;
  for (const id of ids) if (await tryFetchTranscript(id)) got++;
  await catalog.flush();
  return { tried: ids.length, got };
});

await step("Summaries", async () => ({ written: await fillMissingSummaries(30) }));

await catalog.flush();
process.exit(failed ? 1 : 0);

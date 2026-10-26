// Re-assign every lesson to its dafim using the title rule in src/lib/daf-parse.ts.
// A YouTube video that covers several dafim appears once per daf: "<videoId>" for the first
// daf and "<videoId>_<daf>" for each further one. Titles the rule can't read are left as is.
import { store, type Op } from "./store";
import { catalog } from "./catalog";
import { parseTitleForMasechetDafs } from "../src/lib/daf-parse";
import { getGregorianDateForDaf } from "../src/lib/daf-yomi";

export interface RecatalogResult { updated: number; created: number; removed: number; unreadable: number }

export async function recatalogAll(dryRun = false): Promise<RecatalogResult> {
  const all = await catalog.getAll();
  const byId = new Map(all.map(v => [v.youtube_id, v]));
  const upserts: Array<{ id: string; data: any }> = [];
  const removes: string[] = [];
  let unreadable = 0;

  for (const root of all) {
    if (String(root.youtube_id).includes("_")) continue;
    const { masechet, dafs } = parseTitleForMasechetDafs(root.title || "");
    if (!masechet || !dafs.length) { unreadable++; continue; }

    const wanted = new Map<string, number>();
    dafs.forEach((daf, i) => wanted.set(i === 0 ? root.youtube_id : `${root.youtube_id}_${daf}`, daf));

    for (const [id, daf] of wanted) {
      const cur = byId.get(id);
      const date = getGregorianDateForDaf(masechet, daf);
      const published_at = date ? date.toISOString() : cur?.published_at ?? root.published_at ?? null;
      if (cur && cur.masechet === masechet && cur.daf === daf && cur.published_at === published_at) continue;
      upserts.push({
        id,
        data: cur
          ? { masechet, daf, published_at }
          : {
              id, youtube_id: id, title: root.title, thumbnail_url: root.thumbnail_url ?? null,
              summary: root.summary ?? null, has_transcript: !!root.has_transcript,
              created_at: root.created_at ?? new Date().toISOString(), masechet, daf, published_at,
            },
      });
    }
    // Extra entries of this video for dafim it no longer covers.
    for (const v of all) {
      const id = String(v.youtube_id);
      if (id.startsWith(`${root.youtube_id}_`) && !wanted.has(id)) removes.push(id);
    }
  }

  const created = upserts.filter(u => !byId.has(u.id)).length;
  const result = { updated: upserts.length - created, created, removed: removes.length, unreadable };
  if (dryRun) return result;

  const ops: Op[] = [
    ...upserts.map(u => ({ type: "set" as const, path: `videos/${u.id}`, data: u.data, merge: true })),
    ...removes.map(id => ({ type: "delete" as const, path: `videos/${id}` })),
  ];
  await store().commit(ops);
  catalog.upsert(upserts);
  catalog.remove(removes);
  await catalog.flush();
  return result;
}

// The lesson catalog: every lesson's light fields, kept in memory and persisted as a few
// gzip-compressed documents. Loading the whole catalog costs a handful of reads instead of one
// read per lesson (~2,400). Runs in the browser (visitors read it, the admin edits it) and in
// the nightly worker.
import { store, gzip, gunzip, type Op } from "./store";

const META = "app_meta/catalog";
const SYNC = "app_meta/sync";
const CHUNKS = "catalog_chunks";
const CHUNK_CHARS = 300_000;
// How often a long-lived copy checks (1 read) whether someone else changed the catalog.
const VERSION_CHECK_MS = 5 * 60 * 1000;
// Coalesce bursts of edits into a single snapshot save.
const PERSIST_DEBOUNCE_MS = 1500;

export function baseYoutubeId(id: string): string {
  return String(id || "").substring(0, 11);
}

/** Light shape of a lesson (never includes the transcript text). */
export function toLight(id: string, data: any): any {
  const { transcript, presentation, ...rest } = data || {};
  return { ...rest, id: rest.id || id, youtube_id: rest.youtube_id || id, has_transcript: !!rest.has_transcript };
}

export interface Meta { version: number; chunks: number; count: number; updated_at: string }

/** Optional local copy (the browser keeps the catalog between visits). */
export interface CatalogCache {
  load(): { meta: Meta; videos: any[] } | null;
  save(meta: Meta, videos: any[]): void;
}

class Catalog {
  private videos = new Map<string, any>();
  private meta: Meta | null = null;
  private loaded = false;
  private loading: Promise<void> | null = null;
  private lastCheck = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private saving: Promise<void> | null = null;
  private dirty = false;
  /** Scripts that write many lessons save once at the end (flush) instead of after each change. */
  manualSave = false;
  cache: CatalogCache | null = null;

  get version(): number { return this.meta?.version ?? 0; }

  async getAll(): Promise<any[]> {
    await this.ensureFresh();
    return Array.from(this.videos.values());
  }

  async get(id: string): Promise<any | null> {
    await this.ensureFresh();
    return this.videos.get(id) || null;
  }

  private async ensureFresh() {
    if (!this.loaded) {
      this.loading ??= this.load().finally(() => { this.loading = null; });
      return this.loading;
    }
    if (this.dirty || Date.now() - this.lastCheck < VERSION_CHECK_MS) return;
    this.lastCheck = Date.now();
    try {
      const remote = (await store().get(META)) as Meta | null;
      if (remote && remote.version !== this.meta?.version && !this.dirty) await this.loadChunks(remote);
    } catch (err: any) {
      console.warn("[Catalog] Version check failed, using the copy we have:", err?.message || err);
    }
  }

  private async load() {
    const cached = this.cache?.load();
    const remote = (await store().get(META).catch(err => { if (cached) return null; throw err; })) as Meta | null;
    if (cached && (!remote || remote.version === cached.meta.version)) {
      this.videos = new Map(cached.videos.map(v => [v.youtube_id || v.id, v]));
      this.meta = cached.meta;
    } else if (remote) {
      await this.loadChunks(remote);
    } else {
      console.log("[Catalog] No snapshot yet — building it from the videos collection (one-time).");
      await this.rebuild();
    }
    this.loaded = true;
    this.lastCheck = Date.now();
  }

  private async loadChunks(meta: Meta) {
    const docs = await store().getMany(Array.from({ length: meta.chunks }, (_, i) => `${CHUNKS}/chunk_${i}`));
    const next = new Map<string, any>();
    for (const d of docs) {
      if (!d) continue;
      const json = d.gz ? await gunzip(d.gz) : d.data || "[]";
      for (const v of JSON.parse(json)) next.set(v.youtube_id || v.id, v);
    }
    this.videos = next;
    this.meta = meta;
    this.cache?.save(meta, Array.from(next.values()));
    console.log(`[Catalog] Loaded v${meta.version}: ${next.size} lessons.`);
  }

  /** Pick up changes someone else saved (before editing, or for long-running scripts). */
  async sync() {
    this.lastCheck = 0;
    await this.ensureFresh();
  }

  /** Full read of /videos — only for the first run or an explicit admin request. */
  async rebuild(): Promise<number> {
    const docs = await store().list("videos");
    const next = new Map<string, any>();
    docs.forEach(d => { const v = toLight(d.id, d.data); next.set(v.youtube_id, v); });
    this.videos = next;
    this.loaded = true;
    await this.saveNow();
    return next.size;
  }

  /** Record lessons just written (no extra reads). */
  upsert(items: Array<{ id: string; data: any }>) {
    for (const { id, data } of items) {
      const v = toLight(id, { ...(this.videos.get(id) || {}), ...data });
      this.videos.set(v.youtube_id, v);
    }
    this.scheduleSave();
  }

  remove(ids: string[]) {
    ids.forEach(id => this.videos.delete(id));
    this.scheduleSave();
  }

  /** Flag every catalog entry of a YouTube video (all its dafim) as having a transcript. */
  setHasTranscript(baseId: string, has: boolean) {
    for (const v of this.videos.values()) {
      if (baseYoutubeId(v.youtube_id) === baseId && v.has_transcript !== has) v.has_transcript = has;
    }
    this.scheduleSave();
  }

  /** Re-read specific lessons after the admin edited them. */
  async refresh(ids: string[]) {
    await this.sync();
    const unique = Array.from(new Set(ids)).slice(0, 300);
    if (!unique.length) return;
    const docs = await store().getMany(unique.map(id => `videos/${id}`));
    docs.forEach((d, i) => {
      if (d) { const v = toLight(unique[i], d); this.videos.set(v.youtube_id, v); }
      else this.videos.delete(unique[i]);
    });
    this.scheduleSave();
  }

  private scheduleSave() {
    this.dirty = true;
    if (this.manualSave) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      this.saveNow().catch(err => console.error("[Catalog] Save failed:", err?.message || err));
    }, PERSIST_DEBOUNCE_MS);
  }

  /** Make sure pending changes are saved (call before an action that changed data finishes). */
  async flush() {
    if (this.timer) { clearTimeout(this.timer); this.timer = null; await this.saveNow(); }
    else if (this.saving) await this.saving;
    else if (this.dirty && this.manualSave) await this.saveNow();
  }

  private async saveNow() {
    if (this.saving) await this.saving;
    this.saving = (async () => {
      this.dirty = false;
      const list = Array.from(this.videos.values()).sort((a, b) => String(a.youtube_id).localeCompare(String(b.youtube_id)));
      const chunks: string[] = [];
      let cur: any[] = [], len = 2;
      for (const v of list) {
        const l = JSON.stringify(v).length + 1;
        if (cur.length && len + l > CHUNK_CHARS) { chunks.push(JSON.stringify(cur)); cur = []; len = 2; }
        cur.push(v); len += l;
      }
      if (cur.length) chunks.push(JSON.stringify(cur));
      const prev = this.meta?.chunks ?? 0;
      const meta: Meta = { version: Date.now(), chunks: chunks.length, count: list.length, updated_at: new Date().toISOString() };
      const ops: Op[] = [];
      for (const [i, c] of chunks.entries()) ops.push({ type: "set", path: `${CHUNKS}/chunk_${i}`, data: { gz: await gzip(c), count: JSON.parse(c).length } });
      for (let i = chunks.length; i < prev; i++) ops.push({ type: "delete", path: `${CHUNKS}/chunk_${i}` });
      ops.push({ type: "set", path: META, data: meta });
      await store().commit(ops);
      this.meta = meta;
      this.lastCheck = Date.now();
      this.cache?.save(meta, list);
      console.log(`[Catalog] Saved v${meta.version}: ${meta.count} lessons.`);
    })().finally(() => { this.saving = null; });
    await this.saving;
  }

  // --- Last YouTube sync time, in its own tiny document ---
  async lastSyncAt(): Promise<number> {
    try {
      const s = await store().get(SYNC);
      return s ? new Date(s.last_sync_at || 0).getTime() : 0;
    } catch {
      return Date.now(); // On errors behave as if we just synced, so we don't hammer anything.
    }
  }

  async markSynced() {
    await store().set(SYNC, { last_sync_at: new Date().toISOString() });
  }
}

export const catalog = new Catalog();

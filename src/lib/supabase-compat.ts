import {
  collection,
  getDocs,
  getDoc,
  query,
  where,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  limit as firestoreLimit
} from "firebase/firestore/lite";
import { toVideoRow, type VideoCatalogProvider } from "@/lib/video-catalog";

// The `videos` collection is served from a shared in-memory catalog (see video-catalog.ts)
// instead of being read from Firestore on every query.
function getCatalogProvider(): VideoCatalogProvider | null {
  return (globalThis as any).__videoCatalogProvider || null;
}

/** Transcripts are managed by the server only; never write them from the browser. */
function stripTranscript(data: any): any {
  if (!data || typeof data !== "object" || !("transcript" in data)) return data;
  const { transcript, ...rest } = data;
  console.warn("[Firestore] Ignoring transcript field in a browser write (use the server API).");
  return rest;
}

/** Parse Supabase-style `.or("title.ilike.%x%,summary.ilike.%x%")` expressions. */
function parseOrExpression(expr: string): Array<{ field: string; op: string; value: string }> {
  return String(expr || "")
    .split(",")
    .map(part => {
      const m = part.trim().match(/^([^.]+)\.(eq|neq|ilike|like|gt|gte|lt|lte|is)\.(.*)$/);
      if (!m) return null;
      const op = m[2] === "ilike" ? "like" : m[2];
      return { field: m[1], op, value: m[3] };
    })
    .filter(Boolean) as Array<{ field: string; op: string; value: string }>;
}

function matchesFilter(d: any, field: string, op: string, value: any): boolean {
  const v = d[field];
  switch (op) {
    case "eq": return v === value || (typeof v === "number" && String(v) === String(value));
    case "neq": return v !== value;
    case "gt": return v > value;
    case "lt": return v < value;
    case "gte": return v >= value;
    case "lte": return v <= value;
    case "in": return Array.isArray(value) && value.includes(v);
    case "like": {
      if (v === null || v === undefined) return false;
      const escaped = String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/%/g, ".*");
      return new RegExp(`^${escaped}$`, "is").test(String(v));
    }
    case "is": return value === null || value === "null" ? v === null || v === undefined : v === value;
    case "not_null": return v !== null && v !== undefined;
    default: return true;
  }
}
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged 
} from "firebase/auth";
import { DEFAULT_MASECHET_COUNTS } from "@/lib/masechet-list";

let firestoreQuotaExceededUntil = 0;
const inMemoryCache = new Map<string, any[]>();

function getStorageItem(key: string): string | null {
  try {
    if (typeof localStorage !== "undefined") {
      return localStorage.getItem(key);
    }
  } catch {}
  return null;
}

function setStorageItem(key: string, val: string) {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(key, val);
    }
  } catch {}
}

function saveVideosToCache(docs: any[]) {
  if (!Array.isArray(docs) || docs.length === 0) return;
  const existing = inMemoryCache.get("videos") || [];
  const map = new Map<string, any>();
  for (const doc of existing) {
    if (doc.youtube_id || doc.id) map.set(doc.youtube_id || doc.id, doc);
  }
  for (const doc of docs) {
    if (doc.youtube_id || doc.id) map.set(doc.youtube_id || doc.id, doc);
  }
  const merged = Array.from(map.values());
  inMemoryCache.set("videos", merged);
  try {
    setStorageItem("dafyomi_cached_videos", JSON.stringify(merged.slice(0, 100)));
  } catch {}
}

const FALLBACK_VIDEOS: any[] = [
  {
    id: "7P1PsU7mp00",
    youtube_id: "7P1PsU7mp00",
    title: "בבא מציעא דף ב - שיעור דף יומי מאת הרב הושע רבינוביץ",
    masechet: "בבא מציעא",
    daf: 2,
    published_at: "2026-10-14T00:00:00Z",
    thumbnail_url: "https://img.youtube.com/vi/7P1PsU7mp00/maxresdefault.jpg",
    summary: "פתיחת מסכת בבא מציעא - שנים אוחזין בטלית זה אומר כולה שלי וזה אומר כולה שלי, דיני שבועה וחלוקה."
  },
  {
    id: "OLiNDox7BS4",
    youtube_id: "OLiNDox7BS4",
    title: "בבא מציעא דף ג - שיעור דף יומי מאת הרב הושע רבינוביץ",
    masechet: "בבא מציעא",
    daf: 3,
    published_at: "2026-10-13T00:00:00Z",
    thumbnail_url: "https://img.youtube.com/vi/OLiNDox7BS4/maxresdefault.jpg",
    summary: "המשך דיני שנים אוחזין בטלית, שבועת מודה במקצת וטענת כופר הכל."
  },
  {
    id: "fmB3VcIhmG4",
    youtube_id: "fmB3VcIhmG4",
    title: "בבא מציעא דף כב - שיעור דף יומי מאת הרב הושע רבינוביץ",
    masechet: "בבא מציעא",
    daf: 22,
    published_at: "2026-10-12T00:00:00Z",
    thumbnail_url: "https://img.youtube.com/vi/fmB3VcIhmG4/maxresdefault.jpg",
    summary: "סוגיית ייאוש שלא מדעת - מחלוקת אביי ורבא האם הוי ייאוש או לא."
  },
  {
    id: "fmB3VcIhmG4_23",
    youtube_id: "fmB3VcIhmG4_23",
    title: "בבא מציעא דף כג - שיעור דף יומי מאת הרב הושע רבינוביץ",
    masechet: "בבא מציעא",
    daf: 23,
    published_at: "2026-10-11T00:00:00Z",
    thumbnail_url: "https://img.youtube.com/vi/fmB3VcIhmG4/maxresdefault.jpg",
    summary: "המשך דיני מציאות וסימנים - אלו מציאות שלו ואלו חייב להכריז."
  },
  {
    id: "_cGCfnyArpw",
    youtube_id: "_cGCfnyArpw",
    title: "בבא מציעא דף כד - שיעור דף יומי מאת הרב הושע רבינוביץ",
    masechet: "בבא מציעא",
    daf: 24,
    published_at: "2026-10-10T00:00:00Z",
    thumbnail_url: "https://img.youtube.com/vi/_cGCfnyArpw/maxresdefault.jpg",
    summary: "דין מקום ומציאה בגל ואשפה, וסימנים העשויים להידרס."
  },
  {
    id: "OLiNDox7BS4_26",
    youtube_id: "OLiNDox7BS4_26",
    title: "בבא מציעא דף כו - שיעור דף יומי מאת הרב הושע רבינוביץ",
    masechet: "בבא מציעא",
    daf: 26,
    published_at: "2026-10-09T00:00:00Z",
    thumbnail_url: "https://img.youtube.com/vi/OLiNDox7BS4/maxresdefault.jpg",
    summary: "מצא כלי באשפה או בחצר - דיני היכר והנחת כלים."
  },
  {
    id: "7P1PsU7mp00_27",
    youtube_id: "7P1PsU7mp00_27",
    title: "בבא מציעא דף כז - שיעור דף יומי מאת הרב הושע רבינוביץ",
    masechet: "בבא מציעא",
    daf: 27,
    published_at: "2026-10-08T00:00:00Z",
    thumbnail_url: "https://img.youtube.com/vi/7P1PsU7mp00/maxresdefault.jpg",
    summary: "הכרזת מציאה - עד מתי מכריז, ודין שלושה רגלים."
  },
  {
    id: "7P1PsU7mp00_28",
    youtube_id: "7P1PsU7mp00_28",
    title: "בבא מציעא דף כח - שיעור דף יומי מאת הרב הושע רבינוביץ",
    masechet: "בבא מציעא",
    daf: 28,
    published_at: "2026-10-07T00:00:00Z",
    thumbnail_url: "https://img.youtube.com/vi/7P1PsU7mp00/maxresdefault.jpg",
    summary: "אבן הטוען וסדרי השבת אבדה בירושלים בזמן בית המקדש."
  }
];

function getFallbackDocs(collectionName: string, filters: Array<{ field: string; op: string; value: any }>): any[] {
  if (collectionName === "site_settings") {
    return [
      { id: "general", key: "site_title", value: "שיעורי הדף היומי - הרב הושע רבינוביץ" },
      { id: "auto_sync", key: "auto_sync_enabled", value: "true" }
    ];
  }

  if (collectionName === "videos") {
    let cached = inMemoryCache.get("videos");
    if (!cached || cached.length === 0) {
      const stored = getStorageItem("dafyomi_cached_videos");
      if (stored) {
        try {
          cached = JSON.parse(stored);
          if (Array.isArray(cached) && cached.length > 0) {
            inMemoryCache.set("videos", cached);
          }
        } catch {}
      }
    }
    const pool = (cached && cached.length > 0) ? cached : FALLBACK_VIDEOS;

    const ytidFilter = filters.find(f => f.field === "youtube_id" && f.op === "eq");
    if (ytidFilter) {
      const cleanYt = String(ytidFilter.value).split('_')[0];
      const match = pool.find((v: any) => v.youtube_id === ytidFilter.value || v.youtube_id === cleanYt);
      if (match) return [{ ...match, youtube_id: ytidFilter.value, id: ytidFilter.value }];
      return [{
        id: ytidFilter.value,
        youtube_id: ytidFilter.value,
        title: `שיעור דף יומי - הרב הושע רבינוביץ`,
        masechet: "בבא מציעא",
        daf: 2,
        published_at: new Date().toISOString(),
        thumbnail_url: `https://img.youtube.com/vi/${cleanYt}/maxresdefault.jpg`,
        summary: "שיעור בעיון ובבהירות מאת הרב הושע רבינוביץ"
      }];
    }

    const masechetFilter = filters.find(f => f.field === "masechet" && f.op === "eq");
    if (masechetFilter) {
      const matched = pool.filter((v: any) => v.masechet === masechetFilter.value);
      if (matched.length > 0) return matched;
      return FALLBACK_VIDEOS;
    }

    return pool;
  }

  return [];
}

class FirestoreQueryBuilder {
  private collectionName: string;
  private db: any;
  private filters: Array<{ field: string; op: string; value: any }> = [];
  private orderField: string | null = null;
  private orderDirection: "asc" | "desc" = "asc";
  private limitCount: number | null = null;
  private rangeFrom: number | null = null;
  private rangeTo: number | null = null;
  private isSingle = false;
  private isMaybeSingle = false;
  private isDelete = false;
  private isInsert = false;
  private isUpdate = false;
  private isUpsert = false;
  private writeData: any = null;
  private selectFields = "*";
  private conflictField: string | null = null;
  private orGroups: Array<Array<{ field: string; op: string; value: string }>> = [];

  constructor(collectionName: string, db: any) {
    this.collectionName = collectionName;
    this.db = db;
  }

  select(fields?: string, _options?: any) {
    // We fetch full documents; the field list only decides whether heavy transcripts are loaded.
    if (typeof fields === "string" && fields.trim()) this.selectFields = fields;
    return this;
  }

  or(expression: string) {
    const conditions = parseOrExpression(expression);
    if (conditions.length > 0) this.orGroups.push(conditions);
    return this;
  }

  insert(data: any) {
    this.isInsert = true;
    this.writeData = data;
    return this;
  }

  update(data: any) {
    this.isUpdate = true;
    this.writeData = data;
    return this;
  }

  delete() {
    this.isDelete = true;
    return this;
  }

  upsert(data: any, options?: { onConflict?: string }) {
    this.isUpsert = true;
    this.writeData = data;
    const field = options?.onConflict;
    if (field && !field.includes(",")) this.conflictField = field;
    return this;
  }

  eq(field: string, value: any) {
    this.filters.push({ field, op: "eq", value });
    return this;
  }

  neq(field: string, value: any) {
    this.filters.push({ field, op: "neq", value });
    return this;
  }

  gt(field: string, value: any) {
    this.filters.push({ field, op: "gt", value });
    return this;
  }

  lt(field: string, value: any) {
    this.filters.push({ field, op: "lt", value });
    return this;
  }

  gte(field: string, value: any) {
    this.filters.push({ field, op: "gte", value });
    return this;
  }

  lte(field: string, value: any) {
    this.filters.push({ field, op: "lte", value });
    return this;
  }

  in(field: string, value: any) {
    this.filters.push({ field, op: "in", value });
    return this;
  }

  contains(field: string, value: any) {
    this.filters.push({ field, op: "contains", value });
    return this;
  }

  like(field: string, value: any) {
    this.filters.push({ field, op: "like", value });
    return this;
  }

  ilike(field: string, value: any) {
    this.filters.push({ field, op: "like", value });
    return this;
  }

  is(field: string, value: any) {
    this.filters.push({ field, op: "is", value });
    return this;
  }

  not(field: string, operator: string, value: any) {
    if (operator === "is" && value === null) {
      this.filters.push({ field, op: "not_null", value: null });
    } else {
      this.filters.push({ field, op: "neq", value });
    }
    return this;
  }

  order(field: string, options?: { ascending?: boolean }) {
    this.orderField = field;
    this.orderDirection = options?.ascending === false ? "desc" : "asc";
    return this;
  }

  limit(value: number) {
    this.limitCount = value;
    return this;
  }

  range(from: number, to: number) {
    this.rangeFrom = from;
    this.rangeTo = to;
    return this;
  }

  single() {
    this.isSingle = true;
    return this;
  }

  maybeSingle() {
    this.isMaybeSingle = true;
    return this;
  }

  private postProcess(docs: any[]): any[] {
    let result = [...docs];

    // Apply all in-memory filters for 100% correctness without index limitations
    for (const filter of this.filters) {
      const { field, op, value } = filter;
      if (op === "in" && !Array.isArray(value)) continue;
      result = result.filter((d: any) => matchesFilter(d, field, op, value));
    }
    // Each .or() call is one group of alternatives; all groups must match.
    for (const group of this.orGroups) {
      result = result.filter((d: any) => group.some(c => matchesFilter(d, c.field, c.op, c.value)));
    }

    // Apply Sorting
    if (this.orderField) {
      const f = this.orderField;
      const dir = this.orderDirection === "asc" ? 1 : -1;
      result.sort((a: any, b: any) => {
        const valA = a[f];
        const valB = b[f];
        if (valA === valB) return 0;
        if (valA === undefined || valA === null) return 1;
        if (valB === undefined || valB === null) return -1;
        return valA > valB ? dir : -dir;
      });
    }

    // Apply range and limit
    if (this.rangeFrom !== null && this.rangeTo !== null) {
      result = result.slice(this.rangeFrom, this.rangeTo + 1);
    } else if (this.limitCount !== null) {
      result = result.slice(0, this.limitCount);
    }

    return result;
  }

  private async fetchDocs(): Promise<any[]> {
    const provider = this.collectionName === "videos" ? getCatalogProvider() : null;
    if (provider) {
      let rows: any[];
      try {
        rows = (await provider.getAll()).map(toVideoRow);
      } catch (err: any) {
        console.warn(`[Catalog] Could not load the video catalog:`, err?.message || err);
        rows = getFallbackDocs("videos", this.filters);
      }
      return this.postProcess(rows);
    }

    // If Firestore quota is exhausted, immediately return cached/fallback data
    // to avoid sending failing RPCs that log repeated errors in the console
    if (Date.now() < firestoreQuotaExceededUntil) {
      const fallback = getFallbackDocs(this.collectionName, this.filters);
      return this.postProcess(fallback);
    }

    let q = collection(this.db, this.collectionName);

    // Apply native Firestore constraints for simple EQ queries to reduce payload
    const nativeEqFilters = this.filters.filter(f => f.op === "eq");
    const constraints: any[] = [];
    if (nativeEqFilters.length > 0) {
      for (const f of nativeEqFilters) {
        constraints.push(where(f.field, "==", f.value));
      }
    }
    if ((this.isSingle || this.isMaybeSingle) && nativeEqFilters.length > 0) {
      constraints.push(firestoreLimit(1));
    } else if (this.limitCount && this.filters.length === nativeEqFilters.length) {
      constraints.push(firestoreLimit(this.limitCount));
    } else if (this.rangeTo !== null && this.filters.length === nativeEqFilters.length) {
      constraints.push(firestoreLimit(this.rangeTo + 1));
    }
    if (constraints.length > 0) {
      q = query(q, ...constraints) as any;
    }

    let docs: any[] = [];
    try {
      const snapshot = await getDocs(q);
      docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      if (this.collectionName === "videos" && docs.length > 0) {
        saveVideosToCache(docs);
      }
    } catch (err: any) {
      if (err?.message?.includes("Quota exceeded") || err?.code === "resource-exhausted") {
        firestoreQuotaExceededUntil = Date.now() + 15 * 60 * 1000;
        console.warn(`[Firestore fetchDocs] Quota exceeded on "${this.collectionName}". Activating local fallback mode for 15m.`);
      } else {
        console.warn(`[Firestore fetchDocs] Query on "${this.collectionName}" handled:`, err?.message);
      }
      docs = getFallbackDocs(this.collectionName, this.filters);
    }

    return this.postProcess(docs);
  }

  private isQuotaError(err: any): boolean {
    return err?.message?.includes("Quota exceeded") || err?.code === "resource-exhausted";
  }

  async execute(): Promise<any> {
    const isVideos = this.collectionName === "videos";
    const provider = isVideos ? getCatalogProvider() : null;
    const changedIds: string[] = [];
    let firstError: any = null;
    const handle = (err: any, what: string) => {
      if (this.isQuotaError(err)) firestoreQuotaExceededUntil = Date.now() + 15 * 60 * 1000;
      console.warn(`[Firestore ${what}] "${this.collectionName}":`, err?.message);
      firstError ??= { message: err?.message || String(err), code: err?.code || "DB_ERROR" };
    };
    const notifyCatalog = async () => {
      if (!provider || changedIds.length === 0) return;
      try { await provider.onVideosChanged(changedIds); }
      catch (err: any) { console.warn("[Catalog] Refresh after write failed:", err?.message || err); }
    };

    if (this.isInsert || this.isUpsert) {
      const dataArray = Array.isArray(this.writeData) ? this.writeData : [this.writeData];
      const inserted = [];
      for (const raw of dataArray) {
        const item = isVideos ? stripTranscript(raw) : raw;
        // Upserts keyed by a field (e.g. site_settings by "key") use that value as the document id.
        const keyed = this.conflictField && item[this.conflictField] != null ? String(item[this.conflictField]) : null;
        const docId = item.id || keyed || item.youtube_id || doc(collection(this.db, this.collectionName)).id;
        const fullItem = { id: docId, ...(isVideos || item.created_at ? {} : { created_at: new Date().toISOString() }), ...item };
        try {
          await setDoc(doc(this.db, this.collectionName, docId), fullItem, { merge: true });
          if (isVideos) changedIds.push(docId);
          inserted.push(fullItem);
        } catch (err: any) {
          handle(err, "insert");
        }
      }
      await notifyCatalog();
      if (firstError) return { data: null, error: firstError };
      return { data: Array.isArray(this.writeData) ? inserted : inserted[0], error: null };
    }

    if (this.isUpdate) {
      const docs = await this.fetchDocs();
      const data = isVideos ? stripTranscript(this.writeData) : this.writeData;
      const updated = [];
      for (const docObj of docs) {
        try {
          await updateDoc(doc(this.db, this.collectionName, docObj.id), data);
          if (isVideos) changedIds.push(docObj.id);
          updated.push({ ...docObj, ...data });
        } catch (err: any) {
          handle(err, "update");
        }
      }
      await notifyCatalog();
      return { data: updated, error: firstError };
    }

    if (this.isDelete) {
      const docs = await this.fetchDocs();
      const deleted = [];
      for (const docObj of docs) {
        try {
          await deleteDoc(doc(this.db, this.collectionName, docObj.id));
          if (isVideos) changedIds.push(docObj.id);
          deleted.push(docObj);
        } catch (err: any) {
          handle(err, "delete");
        }
      }
      await notifyCatalog();
      return { data: deleted, error: firstError };
    }

    // Default: READ
    const docs = await this.fetchDocs();
    if (this.isSingle) {
      if (docs.length === 0) {
        return { data: null, error: { message: "No rows found" }, count: 0 };
      }
      return { data: docs[0], error: null, count: 1 };
    }
    if (this.isMaybeSingle) {
      return { data: docs.length > 0 ? docs[0] : null, error: null, count: docs.length };
    }

    return { data: docs, error: null, count: docs.length };
  }

  catch(onrejected?: (reason: any) => any) {
    return this.then(undefined, onrejected);
  }

  async then(onfulfilled?: (value: any) => any, onrejected?: (reason: any) => any) {
    try {
      const result = await this.execute();
      if (onfulfilled) return onfulfilled(result);
      return result;
    } catch (err: any) {
      const errorObj = { 
        data: null, 
        error: { message: err?.message || String(err), code: err?.code || "DB_ERROR" },
        count: 0 
      };
      if (onfulfilled) return onfulfilled(errorObj);
      if (onrejected) return onrejected(err);
      return errorObj;
    }
  }
}

export function createClient(supabaseUrl: string, supabaseKey: string, options?: any) {
  const db = options?.dbInstance || (globalThis as any).__firestoreDb;
  if (!db) {
    throw new Error("Firestore instance (dbInstance or globalThis.__firestoreDb) must be available");
  }

  let auth: any;
  try {
    auth = getAuth();
  } catch (e) {
    // ignore if auth is not initialized or server-side
  }

  return {
    from: (table: string) => new FirestoreQueryBuilder(table, db),
    rpc: async (fnName: string, _params?: any) => {
      if (fnName === "get_masechet_counts") {
        const provider = getCatalogProvider();
        if (provider) {
          try {
            const counts: Record<string, number> = {};
            for (const v of await provider.getAll()) {
              if (v.masechet) counts[v.masechet] = (counts[v.masechet] || 0) + 1;
            }
            if (Object.keys(counts).length > 0) {
              setStorageItem("dafyomi_masechet_counts", JSON.stringify(counts));
              return { data: Object.entries(counts).map(([masechet, count]) => ({ masechet, count })), error: null };
            }
          } catch {
            // fall through to cached/default counts
          }
        }
        try {
          const cached = getStorageItem("dafyomi_masechet_counts");
          if (cached) {
            const parsed = JSON.parse(cached);
            if (parsed && typeof parsed === "object" && Object.keys(parsed).length > 0) {
              const rows = Object.entries(parsed).map(([masechet, count]) => ({ masechet, count: Number(count) }));
              return { data: rows, error: null };
            }
          }
          const rows = Object.entries(DEFAULT_MASECHET_COUNTS).map(([masechet, count]) => ({ masechet, count }));
          return { data: rows, error: null };
        } catch {
          const rows = Object.entries(DEFAULT_MASECHET_COUNTS).map(([masechet, count]) => ({ masechet, count }));
          return { data: rows, error: null };
        }
      }
      return { data: null, error: { message: `RPC method ${fnName} not supported` } };
    },
    auth: {
      getSession: async () => {
        if (!auth) return { data: { session: null }, error: null };
        const user = auth.currentUser;
        const token = user ? await user.getIdToken() : null;
        return { 
          data: { 
            session: user ? { access_token: token, user: { id: user.uid, email: user.email } } : null 
          }, 
          error: null 
        };
      },
      getUser: async (token?: string) => {
        if (token) {
          try {
            // Decode standard JWT format
            const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString('utf-8'));
            return { data: { user: { id: payload.sub || payload.user_id, email: payload.email } }, error: null };
          } catch (e) {
            return { data: { user: null }, error: { message: "Invalid token" } };
          }
        }
        if (!auth) return { data: { user: null }, error: null };
        const user = auth.currentUser;
        return { data: { user: user ? { id: user.uid, email: user.email } : null }, error: null };
      },
      signInWithPassword: async ({ email, password }: any) => {
        if (!auth) return { data: { user: null }, error: { message: "Auth not available" } };
        try {
          const result = await signInWithEmailAndPassword(auth, email, password);
          return { data: { user: { id: result.user.uid, email: result.user.email } }, error: null };
        } catch (err: any) {
          return { data: { user: null }, error: err };
        }
      },
      signUp: async ({ email, password }: any) => {
        if (!auth) return { data: { user: null }, error: { message: "Auth not available" } };
        try {
          const result = await createUserWithEmailAndPassword(auth, email, password);
          return { data: { user: { id: result.user.uid, email: result.user.email } }, error: null };
        } catch (err: any) {
          return { data: { user: null }, error: err };
        }
      },
      signOut: async () => {
        if (!auth) return { error: null };
        try {
          await signOut(auth);
          return { error: null };
        } catch (err: any) {
          return { error: err };
        }
      },
      onAuthStateChange: (callback: any) => {
        if (!auth) {
          return { data: { subscription: { unsubscribe: () => {} } } };
        }
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
          const token = user ? await user.getIdToken() : null;
          const session = user ? { access_token: token, user: { id: user.uid, email: user.email } } : null;
          callback("SIGNED_IN", session);
        });
        return { data: { subscription: { unsubscribe } } };
      }
    }
  };
}

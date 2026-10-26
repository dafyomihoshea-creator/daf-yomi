// Personal data of a signed-in visitor (favorites, playlists, notes, watch history,
// followed tractates, article bookmarks) — all in ONE Firestore document, /users/{uid}.
// It is read once per visit (1 read) and written only when something changes.
import { doc, getDoc, setDoc } from "firebase/firestore/lite";
import { db } from "@/lib/firebase";

export interface UserData {
  favorites: Record<string, string>; // videoId -> created_at
  playlists: Record<string, { name: string; created_at: string; items: string[] }>;
  notes: Record<string, { content: string; updated_at: string }>;
  history: Record<string, { watched_at: string; progress_seconds?: number }>;
  follows: string[];
  bookmarks: Record<string, { article_id: string; page_number: number; label: string | null; created_at: string }>;
}

const EMPTY: UserData = { favorites: {}, playlists: {}, notes: {}, history: {}, follows: [], bookmarks: {} };
const HISTORY_MAX = 60;

const cache = new Map<string, Promise<UserData>>();
const listeners = new Set<() => void>();

export function onUserDataChange(fn: () => void) {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

export function loadUserData(uid: string): Promise<UserData> {
  if (!cache.has(uid)) {
    cache.set(uid, getDoc(doc(db, "users", uid)).then(s => ({ ...EMPTY, ...(s.exists() ? (s.data() as any) : {}) })).catch(err => {
      cache.delete(uid);
      throw err;
    }));
  }
  return cache.get(uid)!;
}

let pending: { uid: string; data: UserData } | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;

async function writeNow() {
  if (!pending) return;
  const { uid, data } = pending;
  pending = null;
  await setDoc(doc(db, "users", uid), data);
}

if (typeof window !== "undefined") {
  window.addEventListener("pagehide", () => { if (timer) { clearTimeout(timer); writeNow(); } });
}

/**
 * Change the user's data. `delayMs` batches frequent updates (like video progress) into a
 * single write.
 */
export async function updateUserData(uid: string, change: (d: UserData) => void, delayMs = 0): Promise<void> {
  const data = structuredClone(await loadUserData(uid));
  change(data);
  // Keep the document small: only the most recent history entries.
  const hist = Object.entries(data.history).sort((a, b) => b[1].watched_at.localeCompare(a[1].watched_at));
  if (hist.length > HISTORY_MAX) data.history = Object.fromEntries(hist.slice(0, HISTORY_MAX));
  cache.set(uid, Promise.resolve(data));
  listeners.forEach(fn => fn());
  pending = { uid, data };
  if (timer) clearTimeout(timer);
  if (delayMs > 0) {
    timer = setTimeout(() => { timer = null; writeNow().catch(e => console.warn("[UserData] save failed", e)); }, delayMs);
  } else {
    timer = null;
    await writeNow();
  }
}

export function newId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

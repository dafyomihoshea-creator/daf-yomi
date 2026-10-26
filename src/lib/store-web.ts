// The browser's side of server/store.ts: Firestore web SDK (lite) under the security rules.
// Visitors may read the catalog, transcripts and site texts; only managers may write.
import {
  doc, getDoc, getDocs, setDoc, addDoc, deleteDoc, collection, writeBatch, Bytes,
} from "firebase/firestore/lite";
import { db } from "@/lib/firebase";
import { setStore, config, type Store, type Op } from "../../server/store";

const fromDb = (d: any) => {
  if (!d) return null;
  for (const k of Object.keys(d)) if (d[k] instanceof Bytes) d[k] = d[k].toUint8Array();
  return d;
};
const toDb = (d: Record<string, any>) => {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(d)) out[k] = v instanceof Uint8Array ? Bytes.fromUint8Array(v) : v;
  return out;
};

const webStore: Store = {
  async get(path) { const s = await getDoc(doc(db, path)); return s.exists() ? fromDb(s.data()) : null; },
  getMany(paths) { return Promise.all(paths.map(p => webStore.get(p))); },
  async list(name) { return (await getDocs(collection(db, name))).docs.map(d => ({ id: d.id, data: fromDb(d.data()) })); },
  async set(path, data, merge = false) { await setDoc(doc(db, path), toDb(data), { merge }); },
  async add(name, data) { return (await addDoc(collection(db, name), toDb(data))).id; },
  async delete(path) { await deleteDoc(doc(db, path)); },
  async commit(ops: Op[]) {
    for (let i = 0; i < ops.length; i += 400) {
      const batch = writeBatch(db);
      for (const op of ops.slice(i, i + 400)) {
        if (op.type === "set") batch.set(doc(db, op.path), toDb(op.data), { merge: !!op.merge });
        else batch.delete(doc(db, op.path));
      }
      await batch.commit();
    }
  },
  newId(name) { return doc(collection(db, name)).id; },
};

setStore(webStore);
// These keys only work from the site's own address (restricted in Google Cloud).
config.geminiKey = import.meta.env.VITE_GEMINI_API_KEY || "";
config.youtubeKey = import.meta.env.VITE_YOUTUBE_API_KEY || "";
config.siteUrl = window.location.origin;

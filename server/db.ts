// Database access for the nightly worker and the scripts (Node): Firebase Admin SDK with the
// worker's service account (GOOGLE_APPLICATION_CREDENTIALS). The browser uses its own Store
// (src/lib/store-web.ts) under the security rules.
import fs from "fs";
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { setStore, config, type Store, type Op } from "./store";

const firebaseConfig = JSON.parse(fs.readFileSync(new URL("../firebase-config.json", import.meta.url), "utf-8"));

export const PROJECT_ID: string = process.env.FIREBASE_PROJECT_ID || firebaseConfig.projectId;
export const DATABASE_ID: string = process.env.FIRESTORE_DATABASE_ID || "(default)";

const app = getApps()[0] || initializeApp({ projectId: PROJECT_ID });
export const db: Firestore = getFirestore(app, DATABASE_ID);
db.settings({ ignoreUndefinedProperties: true });

// Admin SDK returns Buffer for bytes; plain Uint8Array everywhere else.
const fromDb = (d: any) => {
  if (!d) return null;
  for (const k of Object.keys(d)) if (Buffer.isBuffer(d[k])) d[k] = new Uint8Array(d[k]);
  return d;
};
const toDb = (d: Record<string, any>) => {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(d)) out[k] = v instanceof Uint8Array && !Buffer.isBuffer(v) ? Buffer.from(v) : v;
  return out;
};

export const nodeStore: Store = {
  async get(path) { const s = await db.doc(path).get(); return s.exists ? fromDb(s.data()) : null; },
  async getMany(paths) {
    if (!paths.length) return [];
    const snaps = await db.getAll(...paths.map(p => db.doc(p)));
    return snaps.map(s => (s.exists ? fromDb(s.data()) : null));
  },
  async list(collection) { return (await db.collection(collection).get()).docs.map(d => ({ id: d.id, data: fromDb(d.data()) })); },
  async set(path, data, merge = false) { await db.doc(path).set(toDb(data), { merge }); },
  async add(collection, data) { return (await db.collection(collection).add(toDb(data))).id; },
  async delete(path) { await db.doc(path).delete(); },
  async commit(ops: Op[]) {
    for (let i = 0; i < ops.length; i += 400) {
      const batch = db.batch();
      for (const op of ops.slice(i, i + 400)) {
        if (op.type === "set") batch.set(db.doc(op.path), toDb(op.data), { merge: !!op.merge });
        else batch.delete(db.doc(op.path));
      }
      await batch.commit();
    }
  },
  newId(collection) { return db.collection(collection).doc().id; },
};

setStore(nodeStore);
config.geminiKey = process.env.GEMINI_API_KEY || "";
config.youtubeKey = process.env.YOUTUBE_API_KEY || "";
if (process.env.SITE_URL) config.siteUrl = process.env.SITE_URL.replace(/\/$/, "");
if (process.env.ADMIN_EMAILS) config.adminEmails.push(...process.env.ADMIN_EMAILS.split(",").map(s => s.trim().toLowerCase()).filter(Boolean));

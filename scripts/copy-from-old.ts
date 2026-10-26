// One-time move from the old Google project (gen-lang-client-0416604560, billed) to the new
// free Firebase project: every Firestore collection, the article files (from Cloud Storage into
// Firestore pieces), the Gemini transcription progress, and the signed-in users (same user ids,
// so personal data keeps working).
//   OLD_TOKEN=$(gcloud auth print-access-token) GOOGLE_APPLICATION_CREDENTIALS=<worker key> \
//     npx tsx scripts/copy-from-old.ts [--dry-run] [--only=videos,transcripts]
export {};
import { getAuth } from "firebase-admin/auth";
await import("../server/db");
const { store } = await import("../server/store");
const { saveArticleFile } = await import("../server/articles");

const OLD_PROJECT = "gen-lang-client-0416604560";
const OLD_DB = "ai-studio-dafyomirabihoshe-416eb3f5-fb11-475b-ba2e-a1e6b83f8d06";
const OLD_BUCKET = "gen-lang-client-0416604560-dafyomi-articles";
const OLD_STATE = "transcribe-job/state.json";
const TOKEN = process.env.OLD_TOKEN || "";
const DRY = process.argv.includes("--dry-run");
const ONLY = process.argv.find(a => a.startsWith("--only="))?.slice(7).split(",");
if (!TOKEN) { console.error("Set OLD_TOKEN (gcloud auth print-access-token)."); process.exit(1); }

const headers = { Authorization: `Bearer ${TOKEN}`, "x-goog-user-project": OLD_PROJECT, "Content-Type": "application/json" };
const DOCS = `https://firestore.googleapis.com/v1/projects/${OLD_PROJECT}/databases/${OLD_DB}/documents`;

async function call(url: string, init?: RequestInit): Promise<any> {
  const r = await fetch(url, { ...init, headers });
  const j = await r.json();
  if (!r.ok) throw new Error(`${r.status} ${JSON.stringify(j?.error || j).slice(0, 300)}`);
  return j;
}

/** Firestore REST value → plain JS (bytes become Uint8Array, timestamps Date). */
function value(v: any): any {
  if ("stringValue" in v) return v.stringValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return v.doubleValue;
  if ("booleanValue" in v) return v.booleanValue;
  if ("nullValue" in v) return null;
  if ("timestampValue" in v) return new Date(v.timestampValue);
  if ("bytesValue" in v) return new Uint8Array(Buffer.from(v.bytesValue, "base64"));
  if ("arrayValue" in v) return (v.arrayValue.values || []).map(value);
  if ("mapValue" in v) return fields(v.mapValue.fields || {});
  if ("geoPointValue" in v) return v.geoPointValue;
  if ("referenceValue" in v) return v.referenceValue;
  return null;
}
const fields = (f: Record<string, any>) => Object.fromEntries(Object.entries(f).map(([k, v]) => [k, value(v)]));

async function* listDocs(collection: string) {
  let pageToken = "";
  do {
    const j = await call(`${DOCS}/${collection}?pageSize=300${pageToken ? `&pageToken=${pageToken}` : ""}`);
    for (const d of j.documents || []) yield { id: d.name.split("/").pop() as string, data: fields(d.fields || {}) };
    pageToken = j.nextPageToken || "";
  } while (pageToken);
}

const { collectionIds } = await call(`${DOCS}:listCollectionIds`, { method: "POST", body: JSON.stringify({ pageSize: 100 }) });
const collections: string[] = (collectionIds || []).filter((c: string) => !ONLY || ONLY.includes(c));
console.log("Collections:", collections.join(", "));

let total = 0;
for (const c of collections) {
  const ops: any[] = [];
  for await (const d of listDocs(c)) {
    if (c === "articles" && d.data.file_path) {
      // The file moves from Cloud Storage into Firestore pieces (free plan has no file storage).
      const r = await fetch(`https://storage.googleapis.com/storage/v1/b/${OLD_BUCKET}/o/${encodeURIComponent(d.data.file_path)}?alt=media`, { headers });
      if (!r.ok) { console.warn(`  article ${d.id}: file not found (${r.status})`); continue; }
      const bytes = new Uint8Array(await r.arrayBuffer());
      const mime = r.headers.get("content-type") || "application/pdf";
      const chunks = DRY ? Math.ceil(bytes.length / 700_000) : await saveArticleFile(d.id, bytes);
      const { file_path, file_url, ...rest } = d.data;
      d.data = { ...rest, file_chunks: chunks, file_mime: mime, file_name: String(file_path).split("/").pop() };
      console.log(`  article ${d.id}: ${bytes.length} bytes in ${chunks} piece(s)`);
    }
    ops.push({ type: "set", path: `${c}/${d.id}`, data: d.data });
  }
  if (!DRY) await store().commit(ops);
  total += ops.length;
  console.log(`${c}: ${ops.length} documents${DRY ? " (dry run)" : ""}`);
}

// Gemini transcription progress (the old cloud job kept it in Cloud Storage).
if (!ONLY || ONLY.includes("transcribe_state")) {
  const r = await fetch(`https://storage.googleapis.com/storage/v1/b/${OLD_BUCKET}/o/${encodeURIComponent(OLD_STATE)}?alt=media`, { headers });
  if (r.ok) {
    const s = await r.json();
    delete s.month;
    if (!DRY) await store().set("app_meta/transcribe_state", { json: JSON.stringify(s), updated_at: new Date().toISOString() });
    console.log(`Transcription progress: ${Object.keys(s.done || {}).length} done`);
  } else console.warn(`Transcription progress not found (${r.status})`);
}

// Signed-in users (Google accounts), with the same ids.
if (!ONLY || ONLY.includes("users_auth")) {
  const users: any[] = [];
  let next = "";
  do {
    const j = await call(`https://identitytoolkit.googleapis.com/v1/projects/${OLD_PROJECT}/accounts:batchGet?maxResults=500${next ? `&nextPageToken=${next}` : ""}`);
    users.push(...(j.users || []));
    next = j.nextPageToken || "";
  } while (next);
  const records = users.map(u => ({
    uid: u.localId,
    email: u.email,
    emailVerified: !!u.emailVerified,
    displayName: u.displayName,
    photoURL: u.photoUrl,
    disabled: !!u.disabled,
    metadata: { creationTime: u.createdAt ? new Date(Number(u.createdAt)).toUTCString() : undefined, lastSignInTime: u.lastLoginAt ? new Date(Number(u.lastLoginAt)).toUTCString() : undefined },
    providerData: (u.providerUserInfo || []).map((p: any) => ({ uid: p.rawId, providerId: p.providerId, email: p.email, displayName: p.displayName, photoURL: p.photoUrl })),
  }));
  if (!DRY && records.length) {
    for (let i = 0; i < records.length; i += 1000) {
      const res = await getAuth().importUsers(records.slice(i, i + 1000) as any);
      if (res.failureCount) console.warn("  user import errors:", res.errors.map(e => e.error.message).slice(0, 5));
    }
  }
  console.log(`Users: ${records.length}${DRY ? " (dry run)" : ""}`);
}

console.log(`Done: ${total} documents.`);
process.exit(0);

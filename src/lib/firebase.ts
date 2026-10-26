import { initializeApp } from "firebase/app";
import { initializeFirestore } from "firebase/firestore/lite";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut as fbSignOut } from "firebase/auth";
import firebaseConfig from "../../firebase-config.json";

const app = initializeApp(firebaseConfig);
export const db = initializeFirestore(app, {});
(globalThis as any).__firestoreDb = db;

export const auth = getAuth(app);

/** Visitors sign in with their Google account (no passwords stored anywhere). */
export async function signInWithGoogle() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  const result = await signInWithPopup(auth, provider);
  return result.user;
}

export async function signOutUser() {
  await fbSignOut(auth);
}

/** Kept for code that still sends it to the in-browser API (src/lib/local-api.ts). */
export async function authHeaders(): Promise<Record<string, string>> {
  return {};
}

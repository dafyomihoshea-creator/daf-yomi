// Gemini calls (chatbot, smart search, lesson summaries) over the plain REST API, so the same
// code runs in the browser and in the nightly worker. The key belongs to a Google project
// without billing (free tier only); the browser's key only works from the site's address.
import { config } from "./store";

const MODELS = ["gemini-flash-lite-latest", "gemini-3.5-flash-lite", "gemini-flash-latest"];
let quotaPausedUntil = 0;

export function geminiAvailable(): boolean {
  return !!config.geminiKey && Date.now() >= quotaPausedUntil;
}

export async function askGemini(opts: { system?: string; prompt: string; json?: boolean; temperature?: number }): Promise<string | null> {
  if (!geminiAvailable()) return null;
  let quotaHits = 0;
  for (const model of MODELS) {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": config.geminiKey },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: opts.prompt }] }],
          ...(opts.system ? { systemInstruction: { parts: [{ text: opts.system }] } } : {}),
          generationConfig: {
            temperature: opts.temperature ?? 0.2,
            ...(opts.json ? { responseMimeType: "application/json" } : {}),
          },
        }),
      });
      if (res.status === 429) { quotaHits++; continue; }
      const j: any = await res.json();
      if (!res.ok) { console.warn(`[Gemini] ${model} failed:`, JSON.stringify(j?.error || j).slice(0, 200)); continue; }
      const text = (j.candidates?.[0]?.content?.parts || []).map((p: any) => p.text || "").join("");
      if (text) return text;
    } catch (err: any) {
      console.warn(`[Gemini] ${model} failed:`, String(err?.message || err).slice(0, 200));
    }
  }
  // Every model is over its free daily limit: stop calling for a while.
  if (quotaHits === MODELS.length) quotaPausedUntil = Date.now() + 30 * 60 * 1000;
  return null;
}

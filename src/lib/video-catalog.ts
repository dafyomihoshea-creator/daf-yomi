// Shared helpers for the lightweight video catalog.
//
// Reading the `videos` collection document-by-document costs one Firestore read per
// lesson (~2,400 reads for a full list). Instead, the server keeps a compact snapshot
// of every video's light fields in a handful of `catalog_chunks` documents and serves
// it from memory. Heavy data (transcripts) lives in the `transcripts` collection and is
// only read when a single lesson actually needs it.

export const CATALOG_META_COLLECTION = "app_meta";
export const CATALOG_META_DOC = "catalog";
export const CATALOG_CHUNKS_COLLECTION = "catalog_chunks";
export const TRANSCRIPTS_COLLECTION = "transcripts";

// Max characters of JSON per chunk document (Firestore limit is 1 MiB per document).
export const CATALOG_CHUNK_CHARS = 300_000;

// Marker placed in `transcript` for list results, so existing UI checks like
// `video.transcript && video.transcript.length > 0` keep working without loading
// the real (heavy) transcript.
export const TRANSCRIPT_PLACEHOLDER = Object.freeze([
  Object.freeze({ start: 0, duration: 0, text: "", placeholder: true }),
]) as unknown as any[];

export function isTranscriptPlaceholder(value: any): boolean {
  return Array.isArray(value) && value.length === 1 && value[0]?.placeholder === true;
}

/** Strip heavy fields from a video document and record whether it has a transcript. */
export function toLightVideo(docId: string, data: any): any {
  const { transcript, ...rest } = data || {};
  const hasInlineTranscript = Array.isArray(transcript) ? transcript.length > 0 : !!transcript;
  return {
    ...rest,
    id: rest.id || docId,
    youtube_id: rest.youtube_id || docId,
    has_transcript: !!rest.has_transcript || hasInlineTranscript,
  };
}

/** Shape a light catalog record the way the rest of the app expects a video row. */
export function toVideoRow(light: any): any {
  return {
    ...light,
    transcript: light.has_transcript ? TRANSCRIPT_PLACEHOLDER : null,
  };
}

export function splitIntoChunks(videos: any[]): string[] {
  const chunks: string[] = [];
  let current: any[] = [];
  let currentLen = 2;
  for (const v of videos) {
    const len = JSON.stringify(v).length + 1;
    if (current.length > 0 && currentLen + len > CATALOG_CHUNK_CHARS) {
      chunks.push(JSON.stringify(current));
      current = [];
      currentLen = 2;
    }
    current.push(v);
    currentLen += len;
  }
  if (current.length > 0) chunks.push(JSON.stringify(current));
  return chunks;
}

/** Interface the query shim uses to read and update the video catalog. */
export interface VideoCatalogProvider {
  getAll(): Promise<any[]>;
  /** Called after videos were written/deleted so the catalog can refresh them. */
  onVideosChanged(ids: string[]): Promise<void>;
}

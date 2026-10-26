// Browser-side video catalog: the light list of all lessons, read from a few compressed
// Firestore documents (server/catalog.ts) and kept in the browser between visits, so the
// lesson lists cost almost no database reads.
import type { VideoCatalogProvider } from "@/lib/video-catalog";
import "@/lib/local-api";
import { catalog } from "../../server/catalog";

/** Re-check the catalog now (e.g. after a sync found new lessons). */
export async function reloadClientCatalog(): Promise<void> {
  await catalog.sync().catch(() => {});
}

export const clientCatalog: VideoCatalogProvider = {
  getAll() {
    return catalog.getAll();
  },

  async onVideosChanged(ids: string[]) {
    if (!ids.length) return;
    await catalog.refresh(ids);
    await catalog.flush();
  },
};

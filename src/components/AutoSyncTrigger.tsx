import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { reloadClientCatalog } from "@/lib/catalog-client";

const AUTO_SYNC_COOLDOWN_MS = 2 * 60 * 60 * 1000; // 2 hours

export function AutoSyncTrigger() {
  const queryClient = useQueryClient();

  useEffect(() => {
    let isMounted = true;

    async function checkSync() {
      try {
        const lastCheck = localStorage.getItem("last_auto_sync_client");
        const now = Date.now();
        if (lastCheck && now - Number(lastCheck) < AUTO_SYNC_COOLDOWN_MS) {
          return;
        }

        // Record timestamp immediately to prevent race conditions across tabs
        localStorage.setItem("last_auto_sync_client", String(now));

        const res = await fetch("/api/auto-sync-check");
        if (!res.ok) return;

        const data = await res.json();
        if (isMounted && data?.newVideos && data.newVideos > 0) {
          console.log(`[AutoSync] Background sync found ${data.newVideos} new videos. Refreshing query cache.`);
          await reloadClientCatalog();
          await Promise.allSettled([
            queryClient.invalidateQueries({ queryKey: ["videos"] }),
            queryClient.invalidateQueries({ queryKey: ["admin-videos"] }),
            queryClient.invalidateQueries({ queryKey: ["calendar-videos"] }),
            queryClient.invalidateQueries({ queryKey: ["dafim"] }),
            queryClient.invalidateQueries({ queryKey: ["masechtot"] }),
            queryClient.invalidateQueries({ queryKey: ["total-video-count"] }),
            queryClient.invalidateQueries({ queryKey: ["today-lesson"] }),
          ]);
        }
      } catch (e) {
        // Silently catch background errors so the user is never disturbed
        console.debug("[AutoSync] Background auto-sync ping:", e);
      }
    }

    // Run after a short delay so the initial page render is instantaneous
    const timer = setTimeout(() => {
      checkSync();
    }, 2500);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [queryClient]);

  return null;
}

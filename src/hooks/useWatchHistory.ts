import { useMutation } from "@tanstack/react-query";
import { useUserData, useVideosById } from "./useUserData";
import { updateUserData } from "@/lib/user-data";

export function useWatchHistory() {
  const { data, isLoading } = useUserData();
  const { data: videos } = useVideosById();
  const list = Object.entries(data?.history || {})
    .sort((a, b) => b[1].watched_at.localeCompare(a[1].watched_at))
    .slice(0, 50)
    .map(([video_id, h]) => ({ id: video_id, video_id, watched_at: h.watched_at, progress_seconds: h.progress_seconds || 0, videos: videos?.get(video_id) }))
    .filter(h => h.videos);
  return { data: list, isLoading };
}

export function useTrackWatch() {
  const { user } = useUserData();
  return useMutation({
    mutationFn: async ({ videoId, progressSeconds }: { videoId: string; progressSeconds?: number }) => {
      if (!user) return;
      // Progress updates arrive every few seconds while watching: save at most once a minute.
      await updateUserData(user.id, d => {
        d.history[videoId] = {
          watched_at: new Date().toISOString(),
          progress_seconds: progressSeconds !== undefined ? Math.floor(progressSeconds) : d.history[videoId]?.progress_seconds || 0,
        };
      }, progressSeconds !== undefined ? 60_000 : 0);
    },
  });
}

export function useVideoProgress(videoId: string | undefined) {
  const { data, isLoading } = useUserData();
  return { data: (videoId && data?.history[videoId]?.progress_seconds) || 0, isLoading };
}

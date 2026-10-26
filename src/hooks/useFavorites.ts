import { useMutation } from "@tanstack/react-query";
import { useUserData, useVideosById } from "./useUserData";
import { updateUserData } from "@/lib/user-data";

export function useFavorites() {
  const { data, isLoading } = useUserData();
  const { data: videos } = useVideosById();
  const favorites = Object.entries(data?.favorites || {})
    .sort((a, b) => b[1].localeCompare(a[1]))
    .map(([video_id, created_at]) => ({ id: video_id, video_id, created_at, videos: videos?.get(video_id) }))
    .filter(f => f.videos);
  return { favorites, isLoading };
}

export function useFavoriteIds() {
  const { data, isLoading } = useUserData();
  return { data: new Set(Object.keys(data?.favorites || {})), isLoading };
}

export function useToggleFavorite() {
  const { user } = useUserData();
  return useMutation({
    mutationFn: async ({ videoId, isFavorited }: { videoId: string; isFavorited: boolean }) => {
      if (!user) throw new Error("Not authenticated");
      await updateUserData(user.id, d => {
        if (isFavorited) delete d.favorites[videoId];
        else d.favorites[videoId] = new Date().toISOString();
      });
    },
  });
}

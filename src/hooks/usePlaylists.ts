import { useMutation } from "@tanstack/react-query";
import { useUserData, useVideosById } from "./useUserData";
import { updateUserData, newId } from "@/lib/user-data";

export function usePlaylists() {
  const { data, isLoading } = useUserData();
  const list = Object.entries(data?.playlists || {})
    .sort((a, b) => b[1].created_at.localeCompare(a[1].created_at))
    .map(([id, p]) => ({ id, name: p.name, created_at: p.created_at, playlist_items: [{ count: p.items.length }] }));
  return { data: list, isLoading };
}

export function usePlaylistItems(playlistId: string | null) {
  const { data, isLoading } = useUserData();
  const { data: videos } = useVideosById();
  const items = (playlistId ? data?.playlists[playlistId]?.items || [] : [])
    .map((video_id, position) => ({ id: `${playlistId}_${video_id}`, video_id, position, videos: videos?.get(video_id) }))
    .filter(i => i.videos);
  return { data: items, isLoading };
}

export function useCreatePlaylist() {
  const { user } = useUserData();
  return useMutation({
    mutationFn: async (name: string) => {
      if (!user) throw new Error("Not authenticated");
      const id = newId();
      await updateUserData(user.id, d => { d.playlists[id] = { name, created_at: new Date().toISOString(), items: [] }; });
      return { id, name };
    },
  });
}

export function useDeletePlaylist() {
  const { user } = useUserData();
  return useMutation({
    mutationFn: async (playlistId: string) => {
      if (!user) throw new Error("Not authenticated");
      await updateUserData(user.id, d => { delete d.playlists[playlistId]; });
    },
  });
}

export function useAddToPlaylist() {
  const { user } = useUserData();
  return useMutation({
    mutationFn: async ({ playlistId, videoId }: { playlistId: string; videoId: string }) => {
      if (!user) throw new Error("Not authenticated");
      await updateUserData(user.id, d => {
        const p = d.playlists[playlistId];
        if (p && !p.items.includes(videoId)) p.items.push(videoId);
      });
    },
  });
}

export function useRemoveFromPlaylist() {
  const { user } = useUserData();
  return useMutation({
    mutationFn: async ({ playlistId, videoId }: { playlistId: string; videoId: string }) => {
      if (!user) throw new Error("Not authenticated");
      await updateUserData(user.id, d => {
        const p = d.playlists[playlistId];
        if (p) p.items = p.items.filter(v => v !== videoId);
      });
    },
  });
}

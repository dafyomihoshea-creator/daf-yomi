import { useMutation } from "@tanstack/react-query";
import { useUserData } from "./useUserData";
import { updateUserData } from "@/lib/user-data";

export function useLessonNote(videoId: string | undefined) {
  const { user, data, isLoading } = useUserData();
  const entry = videoId ? data?.notes[videoId] : undefined;
  const note = entry ? { video_id: videoId, content: entry.content, updated_at: entry.updated_at } : null;

  const saveNote = useMutation({
    mutationFn: async (content: string) => {
      if (!user || !videoId) throw new Error("Missing data");
      await updateUserData(user.id, d => {
        if (content.trim()) d.notes[videoId] = { content: content.slice(0, 5000), updated_at: new Date().toISOString() };
        else delete d.notes[videoId];
      });
    },
  });

  return { note, isLoading, saveNote };
}

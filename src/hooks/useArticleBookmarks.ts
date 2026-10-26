import { useMutation } from "@tanstack/react-query";
import { useUserData } from "./useUserData";
import { updateUserData, newId } from "@/lib/user-data";

export interface ArticleBookmark {
  id: string;
  user_id: string;
  article_id: string;
  page_number: number;
  label: string | null;
  created_at: string;
}

export function useArticleBookmarks(articleId: string | undefined) {
  const { user, data } = useUserData();
  const bookmarks: ArticleBookmark[] = Object.entries(data?.bookmarks || {})
    .filter(([, b]) => b.article_id === articleId)
    .map(([id, b]) => ({ id, user_id: user?.id || "", ...b }))
    .sort((a, b) => a.page_number - b.page_number);

  const addMutation = useMutation({
    mutationFn: async ({ articleId, pageNumber, label }: { articleId: string; pageNumber: number; label?: string }) => {
      if (!user) throw new Error("Not authenticated");
      await updateUserData(user.id, d => {
        d.bookmarks[newId()] = { article_id: articleId, page_number: pageNumber, label: label || null, created_at: new Date().toISOString() };
      });
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (bookmarkId: string) => {
      if (!user) throw new Error("Not authenticated");
      await updateUserData(user.id, d => { delete d.bookmarks[bookmarkId]; });
    },
  });

  return { bookmarks, addBookmark: addMutation.mutate, removeBookmark: removeMutation.mutate };
}

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { authHeaders } from "@/lib/firebase";
import "@/lib/store-web";
import { loadArticleFile } from "../../server/articles";

export interface Article {
  id: string;
  title: string;
  description: string | null;
  summary: string | null;
  file_url: string;
  file_type: string;
  created_at: string;
}

export function useArticles() {
  return useQuery({
    queryKey: ["articles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("articles")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      // Files are kept inside the database (see server/articles.ts): load them as local links.
      return Promise.all((data as any[]).map(async a => {
        if (!a.file_chunks) return a as Article;
        try {
          const bytes = await loadArticleFile(a.id, a.file_chunks);
          return { ...a, file_url: URL.createObjectURL(new Blob([bytes], { type: a.file_mime || "application/pdf" })) } as Article;
        } catch {
          return { ...a, file_url: "" } as Article;
        }
      }));
    },
    staleTime: 30 * 60 * 1000,
  });
}

// Files are stored inside the database, by the in-browser API (src/lib/local-api.ts).
export function useUploadArticle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ title, description, file }: { title: string; description: string; file: File }) => {
      const params = new URLSearchParams({ title, description, fileName: file.name });
      const res = await fetch(`/api/admin/articles?${params}`, {
        method: "POST",
        headers: { "Content-Type": file.type || "application/pdf", ...(await authHeaders()) },
        body: file,
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Upload failed");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["articles"] }),
  });
}

export function useDeleteArticle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (article: Article) => {
      const res = await fetch(`/api/admin/articles/${encodeURIComponent(article.id)}`, { method: "DELETE", headers: await authHeaders() });
      if (!res.ok) throw new Error("Delete failed");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["articles"] }),
  });
}

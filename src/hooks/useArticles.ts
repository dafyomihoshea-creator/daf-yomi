import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { authHeaders } from "@/lib/firebase";
import "@/lib/store-web";
import { loadArticleFile, fileKey } from "../../server/articles";

export interface Article {
  id: string;
  title: string;
  description: string | null;
  summary: string | null;
  file_type: string;
  file_name?: string | null;
  file_mime?: string | null;
  file_chunks?: number;
  file_key?: string | null;
  /** Old articles kept their file at an address. */
  file_url?: string;
  /** "converting" (Word file waiting for PDF) or "convert_failed"; empty when ready. */
  status?: string | null;
  convert_error?: string | null;
  series?: string | null;
  number?: number | null;
  hebrew_date?: string | null;
  created_at: string;
}

/** Newest first; a series uploaded together stays in its own order. */
function byDate(a: Article, b: Article) {
  return String(b.created_at).localeCompare(String(a.created_at)) || (a.number ?? 0) - (b.number ?? 0);
}

/** The article list only (titles and summaries). Files are loaded when a reader opens one. */
export function useArticles({ includeHidden = false } = {}) {
  return useQuery({
    queryKey: ["articles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("articles").select("*");
      if (error) throw error;
      return (data as Article[]).slice().sort(byDate);
    },
    staleTime: 30 * 60 * 1000,
    select: (list: Article[]) => (includeHidden ? list : list.filter(a => !a.status)),
  });
}

const fileUrls = new Map<string, Promise<string>>();

/** A local link to the article's file, read from the database once per visit. */
export function articleFileUrl(a: Article): Promise<string> {
  if (!a.file_chunks) return Promise.resolve(a.file_url || "");
  const key = `${fileKey(a)}:${a.file_chunks}`;
  if (!fileUrls.has(key)) {
    const p = loadArticleFile(fileKey(a), a.file_chunks)
      .then(bytes => URL.createObjectURL(new Blob([bytes], { type: a.file_mime || "application/pdf" })));
    p.catch(() => fileUrls.delete(key));
    fileUrls.set(key, p);
  }
  return fileUrls.get(key)!;
}

/** Save the article's file to the reader's computer. */
export async function downloadArticle(a: Article) {
  const url = await articleFileUrl(a);
  if (!url) throw new Error("no file");
  const link = document.createElement("a");
  link.href = url;
  const ext = a.file_type ? `.${a.file_type}` : "";
  link.download = a.title.replace(/[\\/:*?"<>|]/g, "").trim() + ext;
  document.body.appendChild(link);
  link.click();
  link.remove();
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
      const out = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(out.error || "Upload failed");
      return out as { converting?: boolean };
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

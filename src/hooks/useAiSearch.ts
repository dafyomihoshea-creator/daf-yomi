import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Video } from "./useVideos";

interface AiSearchResult {
  results: Video[];
  interpretation: string | null;
}

export function useAiSearch() {
  const [data, setData] = useState<AiSearchResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = useCallback(async (query: string) => {
    setIsSearching(true);
    setError(null);
    setData(null);

    try {
      const resp = await fetch("/api/ai-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      const result = await resp.json();
      if (!resp.ok) throw new Error(result.error || "Search failed");
      setData(result as AiSearchResult);
    } catch (err: any) {
      setError(err.message || "שגיאה בחיפוש");
    } finally {
      setIsSearching(false);
    }
  }, []);

  const clear = useCallback(() => {
    setData(null);
    setError(null);
  }, []);

  return { data, isSearching, error, search, clear };
}

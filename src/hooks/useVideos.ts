import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { parseTitleForMasechetDafs, DEFAULT_MASECHET_COUNTS } from "@/lib/masechet-list";

export interface Video {
  id: string;
  youtube_id: string;
  title: string;
  masechet: string | null;
  daf: number | null;
  thumbnail_url: string | null;
  published_at: string | null;
  summary: string | null;
}

const PAGE_SIZE = 24;

export function useVideos(masechet?: string, searchQuery?: string, daf?: number) {
  return useQuery({
    queryKey: ["videos", masechet, searchQuery, daf],
    queryFn: async () => {
      let query = supabase
        .from("videos")
        .select("*")
        .order("published_at", { ascending: false });

      // Conserve reads when showing recent lessons on home page
      if (!masechet && !searchQuery && !daf) {
        query = query.limit(24);
      }

      if (masechet) {
        query = query.eq("masechet", masechet);
      }

      if (searchQuery) {
        // Search in both title and summary
        const words = searchQuery.trim().split(/\s+/).filter(w => w.length > 1);
        if (words.length > 1) {
          for (const word of words) {
            query = query.or(`title.ilike.%${word}%,summary.ilike.%${word}%`);
          }
        } else {
          query = query.or(`title.ilike.%${searchQuery}%,summary.ilike.%${searchQuery}%`);
        }
      }

      const { data, error } = await query;
      if (error) throw error;
      
      let results = data as Video[];
      
      if (daf) {
        results = results.filter(v => {
          const { dafs } = parseTitleForMasechetDafs(v.title);
          const actualDafs = dafs.length > 0 ? dafs : (v.daf ? [v.daf] : []);
          return actualDafs.includes(daf);
        });
      }
      
      return results;
    },
  });
}

export function useInfiniteVideos(masechet?: string, searchQuery?: string, daf?: number) {
  return useInfiniteQuery({
    queryKey: ["videos-infinite", masechet, searchQuery, daf],
    queryFn: async ({ pageParam = 0 }) => {
      let query = supabase
        .from("videos")
        .select("*")
        .order("published_at", { ascending: false });

      if (masechet) {
        query = query.eq("masechet", masechet);
      }

      if (searchQuery) {
        const words = searchQuery.trim().split(/\s+/).filter(w => w.length > 1);
        if (words.length > 1) {
          for (const word of words) {
            query = query.or(`title.ilike.%${word}%,summary.ilike.%${word}%`);
          }
        } else {
          query = query.or(`title.ilike.%${searchQuery}%,summary.ilike.%${searchQuery}%`);
        }
      }

      // If no daf filter, we can safely paginate in DB.
      // If there IS a daf filter, we must fetch everything (for that masechet/search)
      // and filter locally because a video might cover multiple dafs not stored in the DB column.
      if (!daf) {
        query = query.range(pageParam, pageParam + PAGE_SIZE - 1);
      } else {
        // If daf is present, we will query without limit (it's bound by masechet usually anyway).
      }

      const { data, error } = await query;
      if (error) throw error;
      
      let results = data as Video[];
      
      if (daf) {
        results = results.filter(v => {
          const { dafs } = parseTitleForMasechetDafs(v.title);
          const actualDafs = dafs.length > 0 ? dafs : (v.daf ? [v.daf] : []);
          return actualDafs.includes(daf);
        });
        // Now manually paginate the filtered results
        results = results.slice(pageParam, pageParam + PAGE_SIZE);
      }

      return results;
    },
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage.length < PAGE_SIZE) return undefined;
      return allPages.length * PAGE_SIZE;
    },
    initialPageParam: 0,
  });
}

export function useDafimForMasechet(masechet: string | null) {
  return useQuery({
    queryKey: ["dafim", masechet],
    queryFn: async () => {
      if (!masechet) return [];
      const { data, error } = await supabase
        .from("videos")
        .select("daf, title")
        .eq("masechet", masechet)
        .order("published_at", { ascending: true });
      if (error) throw error;
      
      const allDafs = new Set<number>();
      for (const row of data) {
        const { dafs } = parseTitleForMasechetDafs(row.title);
        const actualDafs = dafs.length > 0 ? dafs : (row.daf ? [row.daf] : []);
        actualDafs.forEach(d => allDafs.add(d));
      }
      return Array.from(allDafs).sort((a, b) => a - b);
    },
    enabled: !!masechet,
  });
}

export function useVideo(youtubeId: string) {
  return useQuery({
    queryKey: ["video", youtubeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("videos")
        .select("*")
        .eq("youtube_id", youtubeId)
        .maybeSingle();
      if (error) throw error;
      return data as Video | null;
    },
    enabled: !!youtubeId,
  });
}

export function useAdjacentVideos(masechet: string | null, daf: number | null) {
  return useQuery({
    queryKey: ["adjacent-videos", masechet, daf],
    queryFn: async () => {
      if (!masechet || !daf) return { prev: null, next: null };

      const [prevRes, nextRes] = await Promise.all([
        supabase
          .from("videos")
          .select("*")
          .eq("masechet", masechet)
          .lt("daf", daf)
          .order("daf", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("videos")
          .select("*")
          .eq("masechet", masechet)
          .gt("daf", daf)
          .order("daf", { ascending: true })
          .limit(1)
          .maybeSingle(),
      ]);

      return {
        prev: prevRes.data as Video | null,
        next: nextRes.data as Video | null,
      };
    },
    enabled: !!masechet && !!daf,
  });
}

export function useTotalVideoCount() {
  return useQuery({
    queryKey: ["total-video-count"],
    queryFn: async () => {
      try {
        const { count, error } = await supabase
          .from("videos")
          .select("id", { count: "exact", head: true });
        if (error) throw error;
        return count || 2248;
      } catch {
        return 2248;
      }
    },
    staleTime: 30 * 60 * 1000,
  });
}

export function useMasechtot() {
  return useQuery({
    queryKey: ["masechtot"],
    queryFn: async () => {
      try {
        const { data, error } = await supabase.rpc("get_masechet_counts");
        const counts: Record<string, number> = {};
        for (const row of (data || []) as { masechet: string; count: number }[]) {
          counts[row.masechet] = Number(row.count);
        }
        if (Object.keys(counts).length > 0) return counts;
        return DEFAULT_MASECHET_COUNTS;
      } catch {
        return DEFAULT_MASECHET_COUNTS;
      }
    },
    staleTime: 30 * 60 * 1000,
  });
}

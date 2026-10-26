import { useQuery } from "@tanstack/react-query";

// Site texts come from the server cache, so visitors cause no database reads.
export function useSiteSettings() {
  return useQuery({
    queryKey: ["site-settings"],
    queryFn: async () => {
      const res = await fetch("/api/site-settings");
      if (!res.ok) return {} as Record<string, string>;
      return (await res.json()) as Record<string, string>;
    },
    staleTime: 30 * 60 * 1000,
  });
}

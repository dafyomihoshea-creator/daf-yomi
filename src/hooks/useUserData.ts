import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "./useAuth";
import { loadUserData, onUserDataChange, type UserData } from "@/lib/user-data";
import { clientCatalog } from "@/lib/catalog-client";

/** The signed-in user's personal data document (one read per visit). */
export function useUserData() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  useEffect(() => onUserDataChange(() => queryClient.invalidateQueries({ queryKey: ["user-data"] })), [queryClient]);
  const query = useQuery<UserData>({
    queryKey: ["user-data", user?.id],
    queryFn: () => loadUserData(user!.id),
    enabled: !!user,
    staleTime: Infinity,
  });
  return { user, data: query.data, isLoading: !!user && query.isLoading };
}

/** Lessons by id, from the shared catalog (no database reads). */
export function useVideosById() {
  return useQuery({
    queryKey: ["videos-by-id"],
    queryFn: async () => new Map((await clientCatalog.getAll()).map(v => [v.youtube_id, v])),
    staleTime: 5 * 60 * 1000,
  });
}

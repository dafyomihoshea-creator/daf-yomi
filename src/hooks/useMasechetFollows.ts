import { useMutation } from "@tanstack/react-query";
import { useUserData } from "./useUserData";
import { updateUserData } from "@/lib/user-data";

export function useMasechetFollows() {
  const { user, data, isLoading } = useUserData();
  const follows = (data?.follows || []).map(masechet => ({ id: masechet, masechet }));

  const toggleFollow = useMutation({
    mutationFn: async (masechet: string) => {
      if (!user) throw new Error("Not authenticated");
      await updateUserData(user.id, d => {
        d.follows = d.follows.includes(masechet) ? d.follows.filter(m => m !== masechet) : [...d.follows, masechet];
      });
    },
  });

  const isFollowing = (masechet: string) => follows.some(f => f.masechet === masechet);
  return { follows, isLoading, toggleFollow, isFollowing };
}

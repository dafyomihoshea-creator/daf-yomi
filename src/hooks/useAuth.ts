import { useState, useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { useQuery } from "@tanstack/react-query";
import { auth, signInWithGoogle, signOutUser, authHeaders } from "@/lib/firebase";

export interface AppUser {
  id: string;
  email: string | null;
  name: string | null;
  photoURL: string | null;
}

function toAppUser(u: any): AppUser | null {
  return u ? { id: u.uid, email: u.email, name: u.displayName, photoURL: u.photoURL } : null;
}

export function useAuth() {
  const [user, setUser] = useState<AppUser | null>(toAppUser(auth.currentUser));
  const [loading, setLoading] = useState(!auth.currentUser);

  useEffect(() => onAuthStateChanged(auth, u => {
    setUser(toAppUser(u));
    setLoading(false);
  }), []);

  return {
    user,
    loading,
    signIn: signInWithGoogle,
    signOut: signOutUser,
  };
}

/** Admin status is decided by the server (list of manager e-mails). */
export function useIsAdmin() {
  const { user, loading: authLoading } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["is-admin", user?.id],
    queryFn: async () => {
      const res = await fetch("/api/admin/whoami", { headers: await authHeaders() });
      const body = await res.json();
      return !!body.isAdmin;
    },
    enabled: !!user,
    staleTime: 30 * 60 * 1000,
  });
  return { user, isAdmin: !!user && !!data, loading: authLoading || (!!user && isLoading) };
}

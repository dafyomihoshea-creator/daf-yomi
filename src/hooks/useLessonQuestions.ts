import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface LessonQuestion {
  id: string;
  user_id: string;
  video_id: string;
  question: string;
  answer: string | null;
  answered_at: string | null;
  created_at: string;
}

// For regular users: get their own questions for a video
export function useMyQuestions(videoId: string | undefined) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["my-questions", videoId, user?.id],
    queryFn: async () => {
      if (!videoId || !user) return [];
      const { data, error } = await supabase
        .from("lesson_questions")
        .select("*")
        .eq("video_id", videoId)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as LessonQuestion[];
    },
    enabled: !!videoId && !!user,
  });
}

// For regular users: get all their questions across all videos (messages page)
export function useAllMyQuestions() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["all-my-questions", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("lesson_questions")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as LessonQuestion[];
    },
    enabled: !!user,
  });
}

// For admins: get all questions
export function useAllQuestions() {
  return useQuery({
    queryKey: ["admin-all-questions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lesson_questions")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as LessonQuestion[];
    },
  });
}

export function useAskQuestion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ videoId, question }: { videoId: string; question: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("יש להתחבר כדי לשאול שאלה");
      const { error } = await supabase
        .from("lesson_questions")
        .insert({ video_id: videoId, user_id: user.id, question });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-questions"] });
      queryClient.invalidateQueries({ queryKey: ["all-my-questions"] });
      queryClient.invalidateQueries({ queryKey: ["admin-all-questions"] });
    },
  });
}

export function useAnswerQuestion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ questionId, answer }: { questionId: string; answer: string }) => {
      const { error } = await supabase
        .from("lesson_questions")
        .update({ answer, answered_at: new Date().toISOString() })
        .eq("id", questionId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-all-questions"] });
      queryClient.invalidateQueries({ queryKey: ["my-questions"] });
      queryClient.invalidateQueries({ queryKey: ["all-my-questions"] });
    },
  });
}

export function useDeleteQuestion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (questionId: string) => {
      const { error } = await supabase
        .from("lesson_questions")
        .delete()
        .eq("id", questionId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-all-questions"] });
    },
  });
}

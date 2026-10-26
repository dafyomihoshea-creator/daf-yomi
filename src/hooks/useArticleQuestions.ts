import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface ArticleQuestion {
  id: string;
  user_id: string;
  article_id: string;
  question: string;
  answer: string | null;
  answered_at: string | null;
  created_at: string;
}

export function useMyArticleQuestions(articleId: string | undefined) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["my-article-questions", articleId, user?.id],
    queryFn: async () => {
      if (!articleId || !user) return [];
      const { data, error } = await supabase
        .from("article_questions")
        .select("*")
        .eq("article_id", articleId)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as ArticleQuestion[];
    },
    enabled: !!articleId && !!user,
  });
}

export function useAllMyArticleQuestions() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["all-my-article-questions", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("article_questions")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as ArticleQuestion[];
    },
    enabled: !!user,
  });
}

export function useAllArticleQuestions() {
  return useQuery({
    queryKey: ["admin-all-article-questions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("article_questions")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as ArticleQuestion[];
    },
  });
}

export function useAskArticleQuestion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ articleId, question }: { articleId: string; question: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("יש להתחבר כדי לשאול שאלה");
      const { error } = await supabase
        .from("article_questions")
        .insert({ article_id: articleId, user_id: user.id, question });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-article-questions"] });
      queryClient.invalidateQueries({ queryKey: ["all-my-article-questions"] });
      queryClient.invalidateQueries({ queryKey: ["admin-all-article-questions"] });
    },
  });
}

export function useAnswerArticleQuestion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ questionId, answer }: { questionId: string; answer: string }) => {
      const { error } = await supabase
        .from("article_questions")
        .update({ answer, answered_at: new Date().toISOString() })
        .eq("id", questionId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-all-article-questions"] });
      queryClient.invalidateQueries({ queryKey: ["my-article-questions"] });
      queryClient.invalidateQueries({ queryKey: ["all-my-article-questions"] });
    },
  });
}

export function useDeleteArticleQuestion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (questionId: string) => {
      const { error } = await supabase.from("article_questions").delete().eq("id", questionId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-all-article-questions"] });
    },
  });
}

import { useState } from "react";
import { useAllQuestions, useAnswerQuestion, useDeleteQuestion, LessonQuestion } from "@/hooks/useLessonQuestions";
import { useAllArticleQuestions, useAnswerArticleQuestion, useDeleteArticleQuestion } from "@/hooks/useArticleQuestions";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { MessageCircle, Send, Loader2, Trash2, CheckCircle2, Clock, Video, FileText } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

function QuestionList({
  questions,
  type,
  getContext,
  onAnswer,
  onDelete,
  answerPending,
}: {
  questions: any[];
  type: "lesson" | "article";
  getContext: (q: any) => { icon: React.ReactNode; label: string } | null;
  onAnswer: (id: string, answer: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  answerPending: boolean;
}) {
  const [answeringId, setAnsweringId] = useState<string | null>(null);
  const [answerText, setAnswerText] = useState("");

  const handleAnswer = async (id: string) => {
    if (!answerText.trim()) return;
    try {
      await onAnswer(id, answerText.trim());
      setAnsweringId(null);
      setAnswerText("");
      toast({ title: "התשובה נשלחה" });
    } catch (err: any) {
      toast({ title: "שגיאה", description: err.message, variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await onDelete(id);
      toast({ title: "השאלה נמחקה" });
    } catch (err: any) {
      toast({ title: "שגיאה", description: err.message, variant: "destructive" });
    }
  };

  const unanswered = questions.filter(q => !q.answer);
  const answered = questions.filter(q => q.answer);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-lg flex items-center gap-2" dir="rtl">
            <Clock className="h-5 w-5 text-orange-500" />
            שאלות ממתינות ({unanswered.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {unanswered.length === 0 ? (
            <p className="text-sm text-muted-foreground font-body" dir="rtl">אין שאלות ממתינות 🎉</p>
          ) : (
            <div className="space-y-3">
              {unanswered.map((q) => {
                const ctx = getContext(q);
                return (
                  <div key={q.id} className="p-3 rounded-lg border border-border space-y-2" dir="rtl">
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1 flex-1">
                        {ctx && (
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-body">
                            {ctx.icon}
                            <span>{ctx.label}</span>
                          </div>
                        )}
                        <p className="text-sm font-body text-foreground">{q.question}</p>
                        <p className="text-[10px] text-muted-foreground font-body">
                          {new Date(q.created_at).toLocaleDateString("he-IL")} • {q.user_id.slice(0, 8)}...
                        </p>
                      </div>
                      <Button variant="ghost" size="icon" className="shrink-0" onClick={() => handleDelete(q.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                    {answeringId === q.id ? (
                      <div className="space-y-2">
                        <Textarea value={answerText} onChange={(e) => setAnswerText(e.target.value)} placeholder="כתוב תשובה..." className="text-foreground text-sm min-h-[60px]" dir="rtl" />
                        <div className="flex gap-2">
                          <Button size="sm" className="font-body gap-1" onClick={() => handleAnswer(q.id)} disabled={answerPending}>
                            {answerPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                            שלח תשובה
                          </Button>
                          <Button size="sm" variant="ghost" className="font-body" onClick={() => { setAnsweringId(null); setAnswerText(""); }}>ביטול</Button>
                        </div>
                      </div>
                    ) : (
                      <Button size="sm" variant="outline" className="font-body gap-1" onClick={() => { setAnsweringId(q.id); setAnswerText(q.answer || ""); }}>
                        <MessageCircle className="h-3 w-3" />השב
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {answered.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-lg flex items-center gap-2" dir="rtl">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              שאלות שנענו ({answered.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {answered.map((q) => {
                const ctx = getContext(q);
                return (
                  <div key={q.id} className="p-3 rounded-lg border border-border space-y-2" dir="rtl">
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1 flex-1">
                        {ctx && (
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-body">
                            {ctx.icon}
                            <span>{ctx.label}</span>
                          </div>
                        )}
                        <p className="text-sm font-body text-foreground">{q.question}</p>
                        <div className="flex items-start gap-1.5 text-xs mt-1">
                          <Badge variant="secondary" className="text-[10px] font-body">תשובה</Badge>
                          <p className="text-muted-foreground font-body">{q.answer}</p>
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" className="shrink-0" onClick={() => handleDelete(q.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export function QuestionManager() {
  const { data: lessonQuestions, isLoading: lessonLoading } = useAllQuestions();
  const { data: articleQuestions, isLoading: articleLoading } = useAllArticleQuestions();
  const answerLessonMutation = useAnswerQuestion();
  const deleteLessonMutation = useDeleteQuestion();
  const answerArticleMutation = useAnswerArticleQuestion();
  const deleteArticleMutation = useDeleteArticleQuestion();

  const videoIds = [...new Set(lessonQuestions?.map(q => q.video_id) || [])];
  const { data: videos } = useQuery({
    queryKey: ["admin-question-videos", videoIds],
    queryFn: async () => {
      if (videoIds.length === 0) return [];
      const { data } = await supabase.from("videos").select("id, title, youtube_id, masechet, daf").in("id", videoIds);
      return data || [];
    },
    enabled: videoIds.length > 0,
  });

  const articleIds = [...new Set(articleQuestions?.map(q => q.article_id) || [])];
  const { data: articles } = useQuery({
    queryKey: ["admin-question-articles", articleIds],
    queryFn: async () => {
      if (articleIds.length === 0) return [];
      const { data } = await supabase.from("articles").select("id, title").in("id", articleIds);
      return data || [];
    },
    enabled: articleIds.length > 0,
  });

  if (lessonLoading || articleLoading) return <Skeleton className="h-40 w-full" />;

  const lessonUnanswered = lessonQuestions?.filter(q => !q.answer).length || 0;
  const articleUnanswered = articleQuestions?.filter(q => !q.answer).length || 0;

  return (
    <Tabs defaultValue="lessons" dir="rtl">
      <TabsList className="mb-4">
        <TabsTrigger value="lessons" className="font-body gap-1.5">
          <Video className="h-3.5 w-3.5" />
          שיעורים {lessonUnanswered > 0 && <Badge variant="destructive" className="text-[10px] h-5 px-1.5">{lessonUnanswered}</Badge>}
        </TabsTrigger>
        <TabsTrigger value="articles" className="font-body gap-1.5">
          <FileText className="h-3.5 w-3.5" />
          מאמרים {articleUnanswered > 0 && <Badge variant="destructive" className="text-[10px] h-5 px-1.5">{articleUnanswered}</Badge>}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="lessons">
        <QuestionList
          questions={lessonQuestions || []}
          type="lesson"
          getContext={(q) => {
            const video = videos?.find(v => v.id === q.video_id);
            if (!video) return null;
            return {
              icon: <Video className="h-3 w-3" />,
              label: video.masechet && video.daf ? `${video.masechet} דף ${video.daf}` : video.title,
            };
          }}
          onAnswer={async (id, answer) => { await answerLessonMutation.mutateAsync({ questionId: id, answer }); }}
          onDelete={async (id) => { await deleteLessonMutation.mutateAsync(id); }}
          answerPending={answerLessonMutation.isPending}
        />
      </TabsContent>

      <TabsContent value="articles">
        <QuestionList
          questions={articleQuestions || []}
          type="article"
          getContext={(q) => {
            const article = articles?.find(a => a.id === q.article_id);
            if (!article) return null;
            return {
              icon: <FileText className="h-3 w-3" />,
              label: article.title,
            };
          }}
          onAnswer={async (id, answer) => { await answerArticleMutation.mutateAsync({ questionId: id, answer }); }}
          onDelete={async (id) => { await deleteArticleMutation.mutateAsync(id); }}
          answerPending={answerArticleMutation.isPending}
        />
      </TabsContent>
    </Tabs>
  );
}

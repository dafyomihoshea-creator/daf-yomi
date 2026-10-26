import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useMyQuestions, useAskQuestion } from "@/hooks/useLessonQuestions";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageCircle, Send, Loader2, CheckCircle2, Clock, LogIn } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Link } from "react-router-dom";

interface LessonQuestionFormProps { videoId: string; }

export function LessonQuestionForm({ videoId }: LessonQuestionFormProps) {
  const { user } = useAuth();
  const { data: myQuestions } = useMyQuestions(videoId);
  const askMutation = useAskQuestion();
  const [question, setQuestion] = useState("");
  const { t, dir } = useLanguage();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim()) return;
    try {
      await askMutation.mutateAsync({ videoId, question: question.trim() });
      setQuestion("");
      toast({ title: t("questions.sent"), description: t("questions.sentDesc") });
    } catch (err: any) { toast({ title: t("common.error"), description: err.message, variant: "destructive" }); }
  };

  if (!user) {
    return (
      <Card className="mt-6">
        <CardContent className="p-4 text-center" dir={dir}>
          <p className="text-sm text-muted-foreground font-body mb-2">{t("questions.loginPrompt")}</p>
          <Link to="/login"><Button variant="outline" size="sm" className="font-body gap-1.5"><LogIn className="h-4 w-4" />{t("questions.loginButton")}</Button></Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mt-6">
      <CardHeader className="pb-3">
        <CardTitle className="font-display text-base flex items-center gap-2" dir={dir}>
          <MessageCircle className="h-4 w-4 text-accent" />{t("questions.title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4" dir={dir}>
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Textarea value={question} onChange={(e) => setQuestion(e.target.value)} placeholder={t("questions.placeholder")} className="text-foreground min-h-[60px] text-sm" dir={dir} />
          <Button type="submit" size="icon" className="shrink-0 self-end" disabled={askMutation.isPending || !question.trim()}>
            {askMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </form>
        {myQuestions && myQuestions.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-border">
            <p className="text-xs text-muted-foreground font-body">{t("questions.yourQuestions")}</p>
            {myQuestions.map((q) => (
              <div key={q.id} className="p-2.5 rounded-md bg-muted/50 space-y-1.5">
                <p className="text-sm font-body text-foreground">{q.question}</p>
                {q.answer ? (
                  <div className="flex items-start gap-1.5 text-xs"><CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0 mt-0.5" /><p className="text-muted-foreground font-body">{q.answer}</p></div>
                ) : (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground"><Clock className="h-3 w-3" /><span className="font-body">{t("messages.waiting")}</span></div>
                )}
              </div>
            ))}
          </div>
        )}
        <p className="text-[10px] text-muted-foreground font-body">
          {t("questions.answersHint")}<Link to="/messages" className="text-accent hover:underline">{t("questions.answersLink")}</Link>
        </p>
      </CardContent>
    </Card>
  );
}

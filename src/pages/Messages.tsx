import { Header } from "@/components/Header";
import { SEOHead } from "@/components/SEOHead";
import { useAuth } from "@/hooks/useAuth";
import { useAllMyQuestions } from "@/hooks/useLessonQuestions";
import { useAllMyArticleQuestions } from "@/hooks/useArticleQuestions";
import { useLanguage } from "@/contexts/LanguageContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { MessageCircle, CheckCircle2, Clock, LogIn, Video, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const Messages = () => {
  const { user, loading: authLoading } = useAuth();
  const { data: questions, isLoading } = useAllMyQuestions();
  const { data: articleQuestions, isLoading: articleLoading } = useAllMyArticleQuestions();
  const { t, dir, lang } = useLanguage();

  const videoIds = [...new Set(questions?.map(q => q.video_id) || [])];
  const { data: videos } = useQuery({
    queryKey: ["message-videos", videoIds],
    queryFn: async () => {
      if (videoIds.length === 0) return [];
      const { data } = await supabase.from("videos").select("id, title, title_en, youtube_id, masechet, daf").in("id", videoIds);
      return data || [];
    },
    enabled: videoIds.length > 0,
  });

  const articleIds = [...new Set(articleQuestions?.map(q => q.article_id) || [])];
  const { data: articles } = useQuery({
    queryKey: ["message-articles", articleIds],
    queryFn: async () => {
      if (articleIds.length === 0) return [];
      const { data } = await supabase.from("articles").select("id, title").in("id", articleIds);
      return data || [];
    },
    enabled: articleIds.length > 0,
  });

  const getVideo = (videoId: string) => videos?.find(v => v.id === videoId);
  const getArticle = (articleId: string) => articles?.find(a => a.id === articleId);

  const allEmpty = (!questions || questions.length === 0) && (!articleQuestions || articleQuestions.length === 0);

  if (authLoading) {
    return (<div className="min-h-screen bg-background"><Header /><div className="container px-4 py-8 max-w-2xl"><Skeleton className="h-40 w-full" /></div></div>);
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container px-4 py-16 text-center">
          <MessageCircle className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
          <h2 className="font-display text-2xl font-bold text-foreground mb-2" dir={dir}>{t("nav.messages")}</h2>
          <p className="text-muted-foreground font-body mb-6" dir={dir}>{t("messages.loginPrompt")}</p>
          <Link to="/login"><Button className="font-body gap-1.5"><LogIn className="h-4 w-4" />{t("nav.login")}</Button></Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <SEOHead title={t("messages.title")} description={lang === "en" ? "Your questions and answers" : "השאלות והתשובות שלך"} path="/messages" />
      <div className="container px-4 py-6 max-w-2xl">
        <h1 className="font-display text-2xl font-bold text-foreground mb-6" dir={dir}>
          <MessageCircle className="h-6 w-6 inline-block ml-2 text-accent" />
          {t("messages.title")}
        </h1>

        {(isLoading || articleLoading) ? (
          <Skeleton className="h-40 w-full" />
        ) : allEmpty ? (
          <Card>
            <CardContent className="p-8 text-center">
              <MessageCircle className="h-12 w-12 text-muted-foreground/20 mx-auto mb-3" />
              <p className="text-muted-foreground font-body" dir={dir}>{t("messages.noQuestions")}</p>
              <p className="text-sm text-muted-foreground/70 font-body mt-1" dir={dir}>{t("messages.askHint")}</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {/* Lesson questions */}
            {questions?.map((q) => {
              const video = getVideo(q.video_id);
              const videoTitle = video ? (lang === "en" && (video as any).title_en ? (video as any).title_en : video.title) : null;
              return (
                <Card key={q.id}>
                  <CardContent className="p-4 space-y-2" dir={dir}>
                    {video && (
                      <Link to={`/lesson/${video.youtube_id}`} className="flex items-center gap-1.5 text-xs text-accent hover:underline font-body">
                        <Video className="h-3 w-3" />
                        {video.masechet && video.daf ? `${video.masechet} ${lang === "en" ? `Page ${video.daf}` : `דף ${video.daf}`}` : videoTitle}
                      </Link>
                    )}
                    <p className="text-sm font-body text-foreground">{q.question}</p>
                    <p className="text-[10px] text-muted-foreground font-body">
                      {new Date(q.created_at).toLocaleDateString(lang === "en" ? "en-US" : "he-IL")}
                    </p>
                    {q.answer ? (
                      <div className="p-2.5 rounded-md bg-accent/5 border border-accent/20">
                        <div className="flex items-center gap-1.5 mb-1">
                          <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                          <Badge variant="secondary" className="text-[10px] font-body">{t("messages.rabbiAnswer")}</Badge>
                        </div>
                        <p className="text-sm font-body text-foreground">{q.answer}</p>
                        {q.answered_at && (
                          <p className="text-[10px] text-muted-foreground font-body mt-1">
                            {new Date(q.answered_at).toLocaleDateString(lang === "en" ? "en-US" : "he-IL")}
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Clock className="h-3.5 w-3.5" />
                        <span className="font-body">{t("messages.waiting")}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}

            {/* Article questions */}
            {articleQuestions?.map((q) => {
              const article = getArticle(q.article_id);
              return (
                <Card key={q.id}>
                  <CardContent className="p-4 space-y-2" dir={dir}>
                    {article && (
                      <Link to="/articles" className="flex items-center gap-1.5 text-xs text-accent hover:underline font-body">
                        <FileText className="h-3 w-3" />
                        {article.title}
                      </Link>
                    )}
                    <p className="text-sm font-body text-foreground">{q.question}</p>
                    <p className="text-[10px] text-muted-foreground font-body">
                      {new Date(q.created_at).toLocaleDateString(lang === "en" ? "en-US" : "he-IL")}
                    </p>
                    {q.answer ? (
                      <div className="p-2.5 rounded-md bg-accent/5 border border-accent/20">
                        <div className="flex items-center gap-1.5 mb-1">
                          <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                          <Badge variant="secondary" className="text-[10px] font-body">{t("messages.rabbiAnswer")}</Badge>
                        </div>
                        <p className="text-sm font-body text-foreground">{q.answer}</p>
                        {q.answered_at && (
                          <p className="text-[10px] text-muted-foreground font-body mt-1">
                            {new Date(q.answered_at).toLocaleDateString(lang === "en" ? "en-US" : "he-IL")}
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Clock className="h-3.5 w-3.5" />
                        <span className="font-body">{t("messages.waiting")}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default Messages;

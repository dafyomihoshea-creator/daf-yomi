import { useMemo, useState } from "react";
import { Header } from "@/components/Header";
import { useArticles, articleFileUrl, downloadArticle, type Article } from "@/hooks/useArticles";
import { useLanguage } from "@/contexts/LanguageContext";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText, Download, BookOpen, Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FlipbookViewer } from "@/components/FlipbookViewer";
import { ArticleQuestionForm } from "@/components/ArticleQuestionForm";
import { toast } from "@/hooks/use-toast";

const Articles = () => {
  const { data: articles, isLoading } = useArticles();
  const [viewingArticle, setViewingArticle] = useState<{ url: string; title: string; id: string } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const { t, dir, lang } = useLanguage();

  const shown = useMemo(() => {
    const words = query.trim().split(/\s+/).filter(Boolean);
    if (!words.length || !articles) return articles || [];
    return articles.filter(a => {
      const text = `${a.title} ${a.summary || ""} ${a.description || ""} ${a.hebrew_date || ""}`;
      return words.every(w => text.includes(w));
    });
  }, [articles, query]);

  // The file is read from the database only now, when the reader asks for it.
  const withFile = async (article: Article, action: () => Promise<void>) => {
    setBusyId(article.id);
    try { await action(); }
    catch { toast({ title: t("articles.loadError"), variant: "destructive" }); }
    setBusyId(null);
  };
  const openArticle = (article: Article) => withFile(article, async () => {
    const url = await articleFileUrl(article);
    if (!url) throw new Error("no file");
    setViewingArticle({ url, title: article.title, id: article.id });
  });

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container px-4 py-6">
        <h1 className="font-display text-2xl font-bold text-foreground mb-4" dir={dir}>{t("articles.title")}</h1>

        {articles && articles.length > 6 && (
          <div className="max-w-md mb-6" dir={dir}>
            <div className="relative">
              <Search className="absolute top-1/2 -translate-y-1/2 start-3 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input value={query} onChange={e => setQuery(e.target.value)} placeholder={t("articles.search")}
                className="ps-9 text-foreground font-body" aria-label={t("articles.search")} />
            </div>
            <p className="text-xs text-muted-foreground font-body mt-1">{shown.length} {t("articles.count")}</p>
          </div>
        )}

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-lg border border-border bg-card p-6">
                <Skeleton className="h-12 w-12 rounded-lg mb-4" />
                <Skeleton className="h-5 w-full mb-2" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            ))}
          </div>
        ) : shown.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {shown.map((article) => (
              <div key={article.id} className="rounded-lg border border-border bg-card p-6 flex flex-col gap-3 hover:shadow-md transition-shadow">
                <div className="flex items-center gap-3" dir={dir}>
                  <div className="w-12 h-12 rounded-lg bg-accent/15 flex items-center justify-center shrink-0">
                    <FileText className="h-6 w-6 text-accent" />
                  </div>
                  {article.series && (
                    <span className="text-xs text-muted-foreground font-body">
                      {article.series}{article.number ? ` · ${article.number}` : ""}
                    </span>
                  )}
                </div>
                <div dir={dir}>
                  <h3 className="font-display text-lg font-bold text-foreground">{article.title}</h3>
                  {article.summary ? (
                    <p className="text-sm text-muted-foreground font-body mt-1 leading-relaxed line-clamp-3">{article.summary}</p>
                  ) : article.description ? (
                    <p className="text-sm text-muted-foreground font-body mt-1">{article.description}</p>
                  ) : null}
                  {article.hebrew_date ? (
                    <p className="text-xs text-muted-foreground font-body mt-2">{article.hebrew_date}</p>
                  ) : !article.series ? (
                    <p className="text-xs text-muted-foreground font-body mt-2">
                      {new Date(article.created_at).toLocaleDateString(lang === "en" ? "en-US" : "he-IL")}
                    </p>
                  ) : null}
                </div>
                <div className="flex gap-2 mt-auto">
                  {article.file_type === "pdf" && (
                    <Button variant="outline" size="sm" className="font-body" disabled={busyId === article.id} onClick={() => openArticle(article)}>
                      {busyId === article.id ? <Loader2 className="h-4 w-4 ml-1 animate-spin" /> : <BookOpen className="h-4 w-4 ml-1" />}
                      {t("articles.read")}
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" className="font-body" disabled={busyId === article.id}
                    onClick={() => withFile(article, () => downloadArticle(article))}>
                    <Download className="h-4 w-4 ml-1" />
                    {t("articles.download")}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <FileText className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-muted-foreground font-body" dir={dir}>{articles?.length ? t("articles.noMatch") : t("articles.noArticles")}</p>
          </div>
        )}
      </div>

      <Dialog open={!!viewingArticle} onOpenChange={() => setViewingArticle(null)}>
        <DialogContent className="max-w-6xl h-[92vh] flex flex-col p-3 sm:p-6">
          <DialogHeader>
            <DialogTitle className="font-display" dir={dir}>{viewingArticle?.title}</DialogTitle>
            <DialogDescription className="sr-only">
              {lang === "he" ? "חלון קריאה למאמר בפורמט PDF" : "PDF article reader dialog"}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-4">
            <div className="flex-1 min-h-0">
              {viewingArticle && <FlipbookViewer pdfUrl={viewingArticle.url} title={viewingArticle.title} articleId={viewingArticle.id} />}
            </div>
            <div className="lg:w-80 shrink-0 overflow-y-auto">
              {viewingArticle && <ArticleQuestionForm articleId={viewingArticle.id} />}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Articles;

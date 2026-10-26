import { useState } from "react";
import { Header } from "@/components/Header";
import { useArticles } from "@/hooks/useArticles";
import { useLanguage } from "@/contexts/LanguageContext";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText, Download, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FlipbookViewer } from "@/components/FlipbookViewer";
import { ArticleQuestionForm } from "@/components/ArticleQuestionForm";

const Articles = () => {
  const { data: articles, isLoading } = useArticles();
  const [viewingArticle, setViewingArticle] = useState<{ url: string; title: string; id: string } | null>(null);
  const { t, dir, lang } = useLanguage();

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container px-4 py-6">
        <h1 className="font-display text-2xl font-bold text-foreground mb-6" dir={dir}>{t("articles.title")}</h1>

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
        ) : articles && articles.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {articles.map((article) => (
              <div key={article.id} className="rounded-lg border border-border bg-card p-6 flex flex-col gap-3 hover:shadow-md transition-shadow">
                <div className="w-12 h-12 rounded-lg bg-accent/15 flex items-center justify-center">
                  <FileText className="h-6 w-6 text-accent" />
                </div>
                <div dir={dir}>
                  <h3 className="font-display text-lg font-bold text-foreground">{article.title}</h3>
                  {article.summary ? (
                    <p className="text-sm text-muted-foreground font-body mt-1 leading-relaxed line-clamp-3">{article.summary}</p>
                  ) : article.description ? (
                    <p className="text-sm text-muted-foreground font-body mt-1">{article.description}</p>
                  ) : null}
                  <p className="text-xs text-muted-foreground font-body mt-2">
                    {new Date(article.created_at).toLocaleDateString(lang === "en" ? "en-US" : "he-IL")}
                  </p>
                </div>
                <div className="flex gap-2 mt-auto">
                  {article.file_type === "pdf" && (
                    <Button variant="outline" size="sm" className="font-body" onClick={() => setViewingArticle({ url: article.file_url, title: article.title, id: article.id })}>
                      <BookOpen className="h-4 w-4 ml-1" />
                      {t("articles.read")}
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" className="font-body" asChild>
                    <a href={article.file_url} target="_blank" rel="noopener noreferrer" download>
                      <Download className="h-4 w-4 ml-1" />
                      {t("articles.download")}
                    </a>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <FileText className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-muted-foreground font-body" dir={dir}>{t("articles.noArticles")}</p>
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

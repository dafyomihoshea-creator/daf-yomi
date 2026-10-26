import { useParams, Link } from "react-router-dom";
import { Header } from "@/components/Header";
import { SEOHead } from "@/components/SEOHead";
import { VideoCard } from "@/components/VideoCard";
import { useVideos } from "@/hooks/useVideos";
import { useLanguage } from "@/contexts/LanguageContext";
import { getMasechetEnglish, numberToHebrewDaf, formatDafLabel, parseTitleForMasechetDafs } from "@/lib/masechet-list";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowRight, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";

const Masechet = () => {
  const { name } = useParams<{ name: string }>();
  const masechet = decodeURIComponent(name || "");
  const { data: videos, isLoading } = useVideos(masechet);
  const { t, dir, lang } = useLanguage();

  const videosByDaf = videos?.reduce<Record<number, typeof videos>>((acc, video) => {
    const { dafs } = parseTitleForMasechetDafs(video.title);
    const actualDafs = dafs.length > 0 ? dafs : (video.daf ? [video.daf] : [0]);
    
    for (const d of actualDafs) {
      if (!acc[d]) acc[d] = [];
      acc[d].push(video);
    }
    return acc;
  }, {}) ?? {};

  const sortedDafim = Object.keys(videosByDaf).map(Number).sort((a, b) => a - b);
  const dafimToDisplay = sortedDafim.filter(d => d !== 0);
  const dafLabel = (daf: number) => lang === "en" ? `Page ${daf}` : `דף ${numberToHebrewDaf(daf)}`;

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title={lang === "en" ? `Tractate ${getMasechetEnglish(masechet)}` : `מסכת ${masechet}`}
        description={`${videos?.length || 0} ${lang === "en" ? "lessons in" : "שיעורי גמרא במסכת"} ${masechet}`}
        path={`/masechet/${encodeURIComponent(masechet)}`}
      />
      <Header />
      <div className="container px-4 py-6">
        <div className="flex items-center gap-2 mb-6" dir={dir}>
          <Link to="/browse"><Button variant="ghost" size="sm" className="text-muted-foreground font-body gap-1"><ArrowRight className="h-4 w-4" />{t("masechetPage.browse")}</Button></Link>
          <span className="text-muted-foreground">/</span>
          <span className="font-body text-sm text-foreground">{lang === "en" ? getMasechetEnglish(masechet) : masechet}</span>
        </div>
        <div className="mb-8 text-center" dir={dir}>
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-accent/15 text-accent mb-4">
            <BookOpen className="h-4 w-4" />
            <span className="text-sm font-body font-medium">{getMasechetEnglish(masechet)}</span>
          </div>
          <h1 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-2">
            {lang === "en" ? `Tractate ${getMasechetEnglish(masechet)}` : `מסכת ${masechet}`}
          </h1>
          <p className="text-muted-foreground font-body">
            {videos?.length || 0} {t("masechetPage.lessons")} • {dafimToDisplay.length} {t("masechetPage.pages")}
          </p>
        </div>

        {dafimToDisplay.length > 0 && (
          <div className="mb-8">
            <h2 className="font-display text-sm font-bold text-muted-foreground mb-3" dir={dir}>{t("masechetPage.jumpToPage")}</h2>
            <div className="flex flex-wrap gap-2" dir={dir}>
              {dafimToDisplay.map((daf) => (
                <a key={daf} href={`#daf-${daf}`} className="px-3 py-1.5 rounded-md text-sm font-body border border-border bg-card hover:bg-accent hover:text-accent-foreground transition-colors">
                  {lang === "en" ? daf : numberToHebrewDaf(daf)}
                </a>
              ))}
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="rounded-lg overflow-hidden border border-border bg-card"><Skeleton className="aspect-video w-full" /><div className="p-4 space-y-2"><Skeleton className="h-4 w-full" /><Skeleton className="h-3 w-2/3" /></div></div>
            ))}
          </div>
        ) : sortedDafim.length > 0 ? (
          <div className="space-y-10">
            {sortedDafim.map((daf) => (
              <div key={daf} id={`daf-${daf}`} className="scroll-mt-20">
                <h2 className="font-display text-lg font-bold text-foreground mb-4 border-b border-border pb-2" dir={dir}>
                  {daf === 0 ? t("masechetPage.noDefinedPage") : dafLabel(daf)}
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                  {videosByDaf[daf].map((video) => <VideoCard key={video.id} video={video} />)}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-16"><p className="text-muted-foreground font-body" dir={dir}>{t("masechetPage.noLessons")}</p></div>
        )}
      </div>
    </div>
  );
};

export default Masechet;

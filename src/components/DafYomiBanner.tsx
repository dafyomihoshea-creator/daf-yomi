import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { getTodaysDafYomi } from "@/lib/daf-yomi";
import { useVideos } from "@/hooks/useVideos";
import { useLanguage } from "@/contexts/LanguageContext";
import { getMasechetEnglish, numberToHebrewDaf } from "@/lib/masechet-list";
import { CalendarDays, Play } from "lucide-react";

export function DafYomiBanner() {
  const dafYomi = getTodaysDafYomi();
  const { data: videos } = useVideos(dafYomi.masechet, undefined, dafYomi.actualDaf);
  const video = videos?.[0];
  const { t, lang, dir } = useLanguage();

  const videoTitle = video ? (lang === "en" && (video as any).title_en ? (video as any).title_en : video.title) : "";

  return (
    <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.05 }} className="container px-4 py-6">
      <div className="rounded-xl border-2 border-accent bg-accent/10 shadow-md p-5 md:p-6" dir={dir}>
        <div className="flex items-center gap-2 mb-3">
          <CalendarDays className="h-5 w-5 text-accent" />
          <h2 className="font-display text-lg font-bold text-foreground">{t("dafYomi.title")}</h2>
          <span className="text-xs text-muted-foreground font-body">{new Date().toLocaleDateString(lang === "en" ? "en-US" : "he-IL")}</span>
        </div>
        <p className="text-sm text-muted-foreground font-body">{t("dafYomi.todayLearning")}</p>
        <div className="mt-1 flex items-center gap-3 flex-wrap">
          <span className="font-display text-2xl md:text-3xl font-bold text-foreground">
            {lang === "en" ? `${getMasechetEnglish(dafYomi.masechet)}` : `מסכת ${dafYomi.masechet}`}
          </span>
          <span className="inline-flex items-center px-4 py-1 rounded-full bg-accent text-accent-foreground font-display font-bold text-xl md:text-2xl shadow-sm">
            {lang === "en" ? `Page ${dafYomi.actualDaf}` : `דף ${numberToHebrewDaf(dafYomi.actualDaf)}`}
          </span>
          {lang === "he" && <span className="text-sm text-muted-foreground font-body">({getMasechetEnglish(dafYomi.masechet)})</span>}
        </div>
        {video ? (
          <Link to={`/lesson/${video.youtube_id}`} className="group mt-4 flex items-center gap-3 p-3 rounded-lg bg-card border border-border hover:border-accent hover:shadow-md transition-all">
            <div className="w-24 h-14 rounded overflow-hidden shrink-0 relative">
              <img src={video.thumbnail_url || `https://img.youtube.com/vi/${video.youtube_id}/mqdefault.jpg`} alt={videoTitle} className="w-full h-full object-cover" />
              <div className="absolute inset-0 flex items-center justify-center bg-primary/20 opacity-0 group-hover:opacity-100 transition-opacity"><Play className="h-5 w-5 text-accent fill-current" /></div>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-display text-sm font-semibold text-foreground line-clamp-1">{videoTitle}</p>
              <p className="text-xs text-accent font-body mt-0.5">{t("dafYomi.watchLesson")}</p>
            </div>
          </Link>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground font-body">{t("dafYomi.noLesson")}</p>
        )}
      </div>
    </motion.section>
  );
}

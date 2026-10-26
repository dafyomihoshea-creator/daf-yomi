import { Link } from "react-router-dom";
import type { Video } from "@/hooks/useVideos";
import { getMasechetEnglish, numberToHebrewDaf, parseTitleForMasechetDafs } from "@/lib/masechet-list";
import { useLanguage } from "@/contexts/LanguageContext";

interface VideoCardProps {
  video: Video & { title_en?: string | null; summary_en?: string | null };
}

export function VideoCard({ video }: VideoCardProps) {
  const { lang, dir } = useLanguage();
  const actualYoutubeId = video.youtube_id.length >= 11 ? video.youtube_id.substring(0, 11) : video.youtube_id.split('_')[0];
  const thumbnail = video.thumbnail_url || `https://img.youtube.com/vi/${actualYoutubeId}/mqdefault.jpg`;

  const title = lang === "en" && video.title_en ? video.title_en : video.title;
  const summary = lang === "en" && video.summary_en ? video.summary_en : video.summary;
  
  const { dafs } = parseTitleForMasechetDafs(video.title);
  const displayDafs = dafs.length > 0 ? dafs : video.daf ? [video.daf] : [];

  return (
    <Link
      to={`/lesson/${video.youtube_id}`}
      className="group block rounded-lg overflow-hidden border border-border bg-card hover:shadow-lg transition-all duration-300 hover:-translate-y-1"
    >
      <div className="aspect-video relative overflow-hidden">
        <img
          src={thumbnail}
          alt={title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          loading="lazy"
        />
        {video.masechet && displayDafs.length > 0 && (
          <span className="absolute top-2 right-2 bg-primary/90 text-primary-foreground text-xs font-body font-semibold px-2 py-1 rounded">
            {lang === "en" ? `Page ${displayDafs.join(", ")}` : `דפים ${displayDafs.map(numberToHebrewDaf).join(", ")}`}
          </span>
        )}
      </div>
      <div className="p-4">
        <h3 className="font-display text-sm font-semibold text-foreground line-clamp-2 leading-relaxed" dir={dir}>
          {title}
        </h3>
        {summary && (
          <p className="mt-1.5 text-xs text-muted-foreground font-body line-clamp-2 leading-relaxed" dir={dir}>
            {summary}
          </p>
        )}
        {video.masechet && (
          <p className="mt-2 text-xs text-muted-foreground font-body">
            {lang === "en" ? getMasechetEnglish(video.masechet) : `מסכת ${video.masechet}`}
            {lang === "en" && ` • ${video.masechet}`}
            {lang === "he" && ` • ${getMasechetEnglish(video.masechet)}`}
          </p>
        )}
      </div>
    </Link>
  );
}

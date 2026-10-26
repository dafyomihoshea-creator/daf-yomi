import { useParams, Link, useSearchParams } from "react-router-dom";
import { useEffect, useRef, useCallback } from "react";
import { Header } from "@/components/Header";
import { SEOHead } from "@/components/SEOHead";
import { ShareButtons } from "@/components/ShareButtons";
import { FavoriteButton } from "@/components/FavoriteButton";
import { AddToPlaylistButton } from "@/components/AddToPlaylistButton";
import { useVideo, useAdjacentVideos } from "@/hooks/useVideos";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTrackWatch, useVideoProgress } from "@/hooks/useWatchHistory";
import { getMasechetEnglish, numberToHebrewDaf, formatDafLabel } from "@/lib/masechet-list";
import { ChevronRight, ChevronLeft, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { LessonNotes } from "@/components/LessonNotes";
import { FollowMasechetButton } from "@/components/FollowMasechetButton";
import { TalmudTextPanel } from "@/components/TalmudTextPanel";
import { SteinsaltzTextPanel } from "@/components/SteinsaltzTextPanel";
import { LessonQuestionForm } from "@/components/LessonQuestionForm";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { LessonTranscript } from "@/components/LessonTranscript";
import { useState } from "react";

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: (() => void) | undefined;
  }
}

const Lesson = () => {
  const { youtubeId } = useParams<{ youtubeId: string }>();
  const { data: video, isLoading } = useVideo(youtubeId || "");
  const { data: adjacent } = useAdjacentVideos(video?.masechet ?? null, video?.daf ?? null);
  const { user } = useAuth();
  const { t, lang, dir } = useLanguage();
  const trackWatch = useTrackWatch();
  const { data: savedProgress } = useVideoProgress(video?.id);
  const playerRef = useRef<any>(null);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasResumedRef = useRef(false);
  const [currentTime, setCurrentTime] = useState(0);
  // ?t=750 (from a chatbot answer): start the lesson at that second.
  const [searchParams] = useSearchParams();
  const startAt = Number(searchParams.get("t")) || 0;
  const startAtRef = useRef(startAt);
  const currentTimeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleSeek = useCallback((seconds: number) => {
    if (playerRef.current && typeof playerRef.current.seekTo === "function") {
      playerRef.current.seekTo(seconds, true);
      playerRef.current.playVideo?.();
    }
  }, []);

  useEffect(() => {
    if (video?.id && user?.id) {
      trackWatch.mutate({ videoId: video.id });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [video?.id, user?.id]);
  useEffect(() => { hasResumedRef.current = false; }, [youtubeId]);
  // A new ?t= while the player is already open (another link in the chat): jump there.
  useEffect(() => {
    if (startAt > 0 && startAt !== startAtRef.current) { startAtRef.current = startAt; handleSeek(startAt); }
  }, [startAt, handleSeek]);
  useEffect(() => { if (!(window as any).YT) { const tag = document.createElement("script"); tag.src = "https://www.youtube.com/iframe_api"; document.head.appendChild(tag); } }, []);

  const trackWatchRef = useRef(trackWatch.mutate);
  const userRef = useRef(user);
  const savedProgressRef = useRef(savedProgress);

  useEffect(() => { trackWatchRef.current = trackWatch.mutate; }, [trackWatch.mutate]);
  useEffect(() => { userRef.current = user; }, [user]);
  useEffect(() => { savedProgressRef.current = savedProgress; }, [savedProgress]);

  useEffect(() => {
    if (!video?.youtube_id) return;
    const initPlayer = () => {
      if (playerRef.current) playerRef.current.destroy();
      playerRef.current = new (window as any).YT.Player(`yt-player-${video.youtube_id}`, {
        videoId: video.youtube_id.length >= 11 ? video.youtube_id.substring(0, 11) : video.youtube_id.split('_')[0],
        playerVars: { rel: 0, modestbranding: 1 },
        events: {
          onReady: (event: any) => {
            if (startAtRef.current > 0) {
              hasResumedRef.current = true;
              event.target.seekTo(startAtRef.current, true);
              event.target.playVideo?.();
              return;
            }
            const progress = savedProgressRef.current;
            if (progress && progress > 10 && !hasResumedRef.current) { 
              hasResumedRef.current = true; 
              event.target.seekTo(progress, true); 
            }
          },
          onStateChange: (event: any) => {
            if (event.data === 1) {
              if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
              progressIntervalRef.current = setInterval(() => {
                if (playerRef.current && video?.id && userRef.current) { 
                  const ct = playerRef.current.getCurrentTime?.(); 
                  if (ct) trackWatchRef.current({ videoId: video.id, progressSeconds: ct }); 
                }
              }, 15000);

              if (currentTimeIntervalRef.current) clearInterval(currentTimeIntervalRef.current);
              currentTimeIntervalRef.current = setInterval(() => {
                if (playerRef.current) {
                  const ct = playerRef.current.getCurrentTime?.() || 0;
                  setCurrentTime(ct);
                }
              }, 500);
            } else {
              if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
              if (currentTimeIntervalRef.current) clearInterval(currentTimeIntervalRef.current);
              if (playerRef.current && video?.id && userRef.current) { 
                const ct = playerRef.current.getCurrentTime?.(); 
                if (ct) trackWatchRef.current({ videoId: video.id, progressSeconds: ct }); 
              }
              if (playerRef.current) {
                const ct = playerRef.current.getCurrentTime?.() || 0;
                setCurrentTime(ct);
              }
            }
          },
        },
      });
    };
    if ((window as any).YT && (window as any).YT.Player) initPlayer();
    else (window as any).onYouTubeIframeAPIReady = initPlayer;
    return () => { 
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current); 
      if (currentTimeIntervalRef.current) clearInterval(currentTimeIntervalRef.current); 
      if (playerRef.current) { try { playerRef.current.destroy(); } catch {} playerRef.current = null; } 
    };
  }, [video?.youtube_id, video?.id]);

  const videoTitle = video ? (lang === "en" && (video as any).title_en ? (video as any).title_en : video.title) : "";
  const videoSummary = video ? (lang === "en" && (video as any).summary_en ? (video as any).summary_en : video.summary) : "";

  if (isLoading) {
    return (<div className="min-h-screen bg-background"><Header /><div className="container px-4 py-8 max-w-4xl"><Skeleton className="aspect-video w-full rounded-lg" /><Skeleton className="h-8 w-2/3 mt-6" /><Skeleton className="h-4 w-1/3 mt-3" /></div></div>);
  }

  if (!video) {
    return (
      <div className="min-h-screen bg-background"><Header />
        <div className="container px-4 py-16 text-center">
          <BookOpen className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
          <h2 className="font-display text-2xl font-bold text-foreground mb-2">{t("lesson.notFound")}</h2>
          <p className="text-muted-foreground font-body mb-6">{t("lesson.notFoundDesc")}</p>
          <Link to="/browse"><Button variant="outline">{t("lesson.backToBrowse")}</Button></Link>
        </div>
      </div>
    );
  }

  const displayDafLabel = formatDafLabel(video.title, video.daf, lang);
  const dafLabel = (daf: number) => lang === "en" ? `Page ${daf}` : `דף ${numberToHebrewDaf(daf)}`;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container px-4 pt-6 max-w-7xl">
        {video.masechet && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground font-body mb-4" dir={dir}>
            <Link to="/browse" className="hover:text-foreground transition-colors">{t("lesson.lessons")}</Link>
            <ChevronLeft className="h-3 w-3" />
            <Link to={`/browse?masechet=${encodeURIComponent(video.masechet)}`} className="hover:text-foreground transition-colors">
              {lang === "en" ? getMasechetEnglish(video.masechet) : `מסכת ${video.masechet}`}
            </Link>
            {video.daf && displayDafLabel && (<><ChevronLeft className="h-3 w-3" /><span>{displayDafLabel}</span></>)}
          </div>
        )}
      </div>

      <SEOHead title={videoTitle} description={videoSummary ? String(videoSummary).slice(0, 300) : lang === "en" ? `Lesson on ${video.masechet ? getMasechetEnglish(video.masechet) : ""} by Rabbi Hoshea Rabinowitz` : `שיעור ${video.masechet ? `במסכת ${video.masechet}` : ""} ${video.daf ? `דף ${video.daf}` : ""} מפי הרב הושע רבינוביץ׳`} path={`/lesson/${video.youtube_id}`} />

      <div className="container px-4 pb-8 max-w-7xl">
        {video.masechet && video.daf ? (
          <ResizablePanelGroup direction="horizontal" className="min-h-[600px] rounded-lg">
            <ResizablePanel defaultSize={42} minSize={25} maxSize={60}>
              <ResizablePanelGroup direction="vertical">
                <ResizablePanel defaultSize={50} minSize={20}>
                  <div className="h-full overflow-hidden pb-2"><TalmudTextPanel masechet={video.masechet} daf={video.daf} /></div>
                </ResizablePanel>
                <ResizableHandle withHandle />
                <ResizablePanel defaultSize={50} minSize={20}>
                  <div className="h-full overflow-hidden pt-2"><SteinsaltzTextPanel masechet={video.masechet} daf={video.daf} /></div>
                </ResizablePanel>
              </ResizablePanelGroup>
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize={58} minSize={40}>
              <div className="pr-4 overflow-y-auto h-full">
                <div className="aspect-video rounded-lg overflow-hidden bg-foreground/5 shadow-lg sticky top-4">
                  <div id={`yt-player-${video.youtube_id}`} className="w-full h-full" />
                </div>
                {videoSummary && (
                  <div className="mt-5 p-4 rounded-lg bg-accent/5 border border-accent/20" dir={dir}>
                    <p className="text-sm font-body text-foreground leading-relaxed">
                      <span className="font-display font-bold text-accent">{t("lesson.summary")}</span>{videoSummary}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-2 font-body">
                      {(video as any).summary_edited ? t("lesson.summaryEdited") : t("lesson.summaryAi")}
                    </p>
                  </div>
                )}
                <div className="mt-5" dir={dir}>
                  <h1 className="font-display text-xl md:text-2xl font-bold text-foreground leading-relaxed">{videoTitle}</h1>
                  <div className="flex items-center justify-between flex-wrap gap-3 mt-3">
                    <div className="flex items-center gap-3">
                      {video.masechet && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent/15 text-accent font-body text-sm font-medium">
                          <BookOpen className="h-3.5 w-3.5" />{getMasechetEnglish(video.masechet)}
                        </span>
                      )}
                      {video.daf && displayDafLabel && <span className="text-sm text-muted-foreground font-body">{displayDafLabel}</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      {video.masechet && <FollowMasechetButton masechet={video.masechet} />}
                      <FavoriteButton videoId={video.id} />
                      <AddToPlaylistButton videoId={video.id} />
                      <ShareButtons url={`${window.location.origin}/lesson/${video.youtube_id}`} title={videoTitle} summary={videoSummary || undefined} />
                    </div>
                  </div>
                </div>
                {video.youtube_id && (
                  <LessonTranscript
                    youtubeId={video.youtube_id}
                    onSeek={handleSeek}
                    currentTime={currentTime}
                  />
                )}
                {video.id && <LessonNotes videoId={video.id} />}
                {video.id && <LessonQuestionForm videoId={video.id} />}
                {adjacent && (adjacent.prev || adjacent.next) && (
                  <div className="flex items-center justify-between mt-6 pt-4 border-t border-border">
                    {adjacent.prev ? (<Link to={`/lesson/${adjacent.prev.youtube_id}`}><Button variant="outline" className="font-body"><ChevronRight className="h-4 w-4 ml-1" />{dafLabel(adjacent.prev.daf!)}</Button></Link>) : <div />}
                    {adjacent.next ? (<Link to={`/lesson/${adjacent.next.youtube_id}`}><Button variant="outline" className="font-body">{dafLabel(adjacent.next.daf!)}<ChevronLeft className="h-4 w-4 mr-1" /></Button></Link>) : <div />}
                  </div>
                )}
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
        ) : (
          <div className="max-w-4xl mx-auto">
            <div className="aspect-video rounded-lg overflow-hidden bg-foreground/5 shadow-lg">
              <div id={`yt-player-${video.youtube_id}`} className="w-full h-full" />
            </div>
            {videoSummary && (
              <div className="mt-5 p-4 rounded-lg bg-accent/5 border border-accent/20" dir={dir}>
                <p className="text-sm font-body text-foreground leading-relaxed">
                  <span className="font-display font-bold text-accent">{t("lesson.summary")}</span>{videoSummary}
                </p>
              </div>
            )}
            <div className="mt-5" dir={dir}>
              <h1 className="font-display text-xl md:text-2xl font-bold text-foreground leading-relaxed">{videoTitle}</h1>
              <div className="flex items-center gap-2 mt-3">
                <FavoriteButton videoId={video.id} />
                <AddToPlaylistButton videoId={video.id} />
                <ShareButtons url={`${window.location.origin}/lesson/${video.youtube_id}`} title={videoTitle} summary={videoSummary || undefined} />
              </div>
            </div>
            {video.youtube_id && (
              <LessonTranscript
                youtubeId={video.youtube_id}
                onSeek={handleSeek}
                currentTime={currentTime}
              />
            )}
            {video.id && <LessonNotes videoId={video.id} />}
            {video.id && <LessonQuestionForm videoId={video.id} />}
          </div>
        )}
      </div>
    </div>
  );
};

export default Lesson;

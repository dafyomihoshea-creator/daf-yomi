import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronRight, ChevronLeft, Play } from "lucide-react";
import { Header } from "@/components/Header";
import { SEOHead } from "@/components/SEOHead";
import { formatDafLabel, numberToHebrewDaf, parseTitleForMasechetDafs } from "@/lib/masechet-list";
import { getHebrewDay, getHebrewMonthsForGregorian } from "@/lib/hebrew-date";
import { getTodaysDafYomi } from "@/lib/daf-yomi";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";

const HEBREW_MONTHS = [
  "ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני",
  "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר"
];

const HEBREW_DAYS = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"];

interface CalendarVideo {
  id: string;
  youtube_id: string;
  title: string;
  masechet: string | null;
  daf: number | null;
  published_at: string;
  thumbnail_url: string | null;
  summary: string | null;
}

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const startOfMonth = new Date(year, month, 1);
  const endOfMonth = new Date(year, month + 1, 0, 23, 59, 59);

  // Buffer range query to prevent timezone boundary overlaps, filter precisely on client-side
  const queryStartDate = new Date(year, month, 1);
  queryStartDate.setDate(queryStartDate.getDate() - 3);
  const queryEndDate = new Date(year, month + 1, 0, 23, 59, 59);
  queryEndDate.setDate(queryEndDate.getDate() + 3);

  const { data: videos } = useQuery({
    queryKey: ["calendar-videos-full", year, month],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("videos")
        .select("id, youtube_id, title, masechet, daf, published_at, thumbnail_url, summary")
        .gte("published_at", queryStartDate.toISOString())
        .lte("published_at", queryEndDate.toISOString())
        .order("published_at", { ascending: true });
      if (error) throw error;
      return data as CalendarVideo[];
    },
  });

  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const videosByDay = useMemo(() => {
    const map: Record<number, CalendarVideo[]> = {};
    if (!videos) return map;

    for (let d = 1; d <= daysInMonth; d++) {
      const scheduled = getTodaysDafYomi(new Date(year, month, d, 12, 0, 0));
      
      const dayLessons = videos.filter((v) => {
        if (!v.masechet) return false;
        const { dafs } = parseTitleForMasechetDafs(v.title);
        const actualDafs = dafs.length > 0 ? dafs : v.daf ? [v.daf] : [];
        return v.masechet === scheduled.masechet && actualDafs.includes(scheduled.actualDaf);
      });

      if (dayLessons.length > 0) {
        map[d] = dayLessons;
      }
    }
    return map;
  }, [videos, year, month, daysInMonth]);

  const calendarDays: (number | null)[] = [];
  for (let i = 0; i < firstDayOfMonth; i++) calendarDays.push(null);
  for (let d = 1; d <= daysInMonth; d++) calendarDays.push(d);
  while (calendarDays.length % 7 !== 0) calendarDays.push(null);

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  const today = new Date();
  const isToday = (day: number) =>
    day === today.getDate() && month === today.getMonth() && year === today.getFullYear();

  const selectedVideos = selectedDay ? videosByDay[selectedDay] || [] : [];

  return (
    <>
      <SEOHead title="לוח שיעורים | הרב הושע רבינוביץ׳" description="לוח שיעורים חודשי עם כל השיעורים לפי תאריך" />
      <Header />
      <main className="container px-4 py-8 max-w-5xl mx-auto" dir="rtl">
        <h2 className="font-display text-2xl font-bold text-foreground mb-6">לוח שיעורים</h2>

        <Card className="overflow-hidden">
          <CardContent className="p-6 sm:p-8">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <Button variant="ghost" size="icon" onClick={nextMonth}>
                <ChevronRight className="h-5 w-5" />
              </Button>
              <div className="text-center flex flex-col items-center gap-1">
                <div className="flex items-center gap-2">
                  <Select value={String(month)} onValueChange={(v) => setCurrentDate(new Date(year, Number(v), 1))}>
                    <SelectTrigger className="h-8 w-auto gap-1 border-none shadow-none font-display text-lg font-bold text-foreground px-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {HEBREW_MONTHS.map((m, i) => (
                        <SelectItem key={i} value={String(i)}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={String(year)} onValueChange={(v) => setCurrentDate(new Date(Number(v), month, 1))}>
                    <SelectTrigger className="h-8 w-auto gap-1 border-none shadow-none font-display text-lg font-bold text-foreground px-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 11 }, (_, i) => year - 5 + i).map((y) => (
                        <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <p className="text-sm text-muted-foreground font-body">{getHebrewMonthsForGregorian(year, month)}</p>
              </div>
              <Button variant="ghost" size="icon" onClick={prevMonth}>
                <ChevronLeft className="h-5 w-5" />
              </Button>
            </div>

            {/* Day headers */}
            <div className="grid grid-cols-7 gap-2 mb-2">
              {HEBREW_DAYS.map((day) => (
                <div key={day} className="text-center text-sm font-body font-semibold text-muted-foreground py-2">
                  {day}
                </div>
              ))}
            </div>

            {/* Days grid */}
            <div className="grid grid-cols-7 gap-2">
              {calendarDays.map((day, i) => {
                if (day === null) {
                  return <div key={`empty-${i}`} className="aspect-square" />;
                }
                const hasVideos = !!videosByDay[day];
                const count = videosByDay[day]?.length || 0;
                const selected = selectedDay === day;

                return (
                  <HoverCard key={day} openDelay={200} closeDelay={100}>
                    <HoverCardTrigger asChild>
                      <button
                        onClick={() => setSelectedDay(selected ? null : day)}
                        className={`
                          aspect-square rounded-xl flex flex-col items-center justify-center text-sm font-body relative transition-all
                          ${isToday(day) ? "ring-2 ring-accent" : ""}
                          ${selected ? "bg-primary text-primary-foreground" : hasVideos ? "bg-accent/10 hover:bg-accent/20 text-foreground" : "hover:bg-muted text-muted-foreground"}
                        `}
                      >
                        <span className={`${hasVideos ? "font-bold" : ""} text-sm leading-tight`}>{day}</span>
                        <span className={`text-[9px] leading-tight ${selected ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                          {getHebrewDay(year, month, day)}
                        </span>
                        {hasVideos && (
                          <div className="flex flex-col items-center gap-0 mt-1 w-full overflow-hidden">
                            {videosByDay[day].slice(0, 1).map((v) => (
                              <span
                                key={v.id}
                                className={`text-[11px] leading-[13px] font-bold truncate max-w-full px-1 ${
                                  selected ? "text-primary-foreground" : "text-accent"
                                }`}
                              >
                                {v.masechet ? (formatDafLabel(v.title, v.daf, "he", true) ? `${v.masechet} ${formatDafLabel(v.title, v.daf, "he", true)}` : v.masechet) : ""}
                              </span>
                            ))}
                            {count > 1 && (
                              <span className={`text-[9px] leading-[11px] ${selected ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                                +{count - 1}
                              </span>
                            )}
                          </div>
                        )}
                      </button>
                    </HoverCardTrigger>
                    {hasVideos && (
                      <HoverCardContent side="bottom" align="center" className="w-72 text-right" dir="rtl">
                        <div className="space-y-2">
                          {videosByDay[day].map((v) => (
                            <div key={v.id} className="space-y-1">
                              <p className="font-display font-bold text-xs text-foreground line-clamp-1">{v.title}</p>
                              {v.masechet && (
                                <p className="text-[11px] text-accent font-body font-semibold">
                                  {v.masechet}{formatDafLabel(v.title, v.daf) ? ` ${formatDafLabel(v.title, v.daf)}` : ""}
                                </p>
                              )}
                              {v.summary && (
                                <p className="text-[11px] text-muted-foreground font-body leading-relaxed line-clamp-3">
                                  {v.summary}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      </HoverCardContent>
                    )}
                  </HoverCard>
                );
              })}
            </div>

            {/* Selected day lessons with hover summaries */}
            {selectedDay && selectedVideos.length > 0 && (
              <div className="mt-6 pt-6 border-t border-border space-y-3">
                <p className="text-base font-body font-semibold text-foreground">
                  {selectedDay} {HEBREW_MONTHS[month]} — {selectedVideos.length} שיעורים
                </p>
                {selectedVideos.map((video) => (
                  <HoverCard key={video.id} openDelay={200} closeDelay={100}>
                    <HoverCardTrigger asChild>
                      <Link
                        to={`/lesson/${video.youtube_id}`}
                        className="flex items-center gap-4 p-3 rounded-xl hover:bg-muted transition-colors"
                      >
                        <div className="w-20 h-12 rounded-lg overflow-hidden shrink-0 relative">
                          <img
                            src={
                              video.thumbnail_url ||
                              `https://img.youtube.com/vi/${video.youtube_id}/mqdefault.jpg`
                            }
                            alt=""
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 flex items-center justify-center bg-primary/20">
                            <Play className="h-4 w-4 text-primary-foreground fill-current" />
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-body text-base text-foreground line-clamp-1">{video.title}</p>
                          {video.masechet && (
                            <p className="text-sm text-muted-foreground font-body">
                              {video.masechet}
                              {formatDafLabel(video.title, video.daf) ? ` ${formatDafLabel(video.title, video.daf)}` : ""}
                            </p>
                          )}
                        </div>
                      </Link>
                    </HoverCardTrigger>
                    <HoverCardContent side="top" align="center" className="w-80 text-right" dir="rtl">
                      <div className="space-y-2">
                        <p className="font-display font-bold text-sm text-foreground line-clamp-2">{video.title}</p>
                        {video.masechet && (
                          <p className="text-xs text-accent font-body font-semibold">
                            {video.masechet}{formatDafLabel(video.title, video.daf) ? ` ${formatDafLabel(video.title, video.daf)}` : ""}
                          </p>
                        )}
                        {video.summary ? (
                          <p className="text-xs text-muted-foreground font-body leading-relaxed line-clamp-5">
                            {video.summary}
                          </p>
                        ) : (
                          <p className="text-xs text-muted-foreground/60 font-body italic">
                            אין תקציר זמין לשיעור זה
                          </p>
                        )}
                      </div>
                    </HoverCardContent>
                  </HoverCard>
                ))}
              </div>
            )}

            {selectedDay && selectedVideos.length === 0 && (
              <div className="mt-6 pt-6 border-t border-border text-center">
                <p className="text-sm text-muted-foreground font-body">
                  אין שיעורים ביום זה
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </>
  );
}

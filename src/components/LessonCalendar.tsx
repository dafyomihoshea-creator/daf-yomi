import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronRight, ChevronLeft, Calendar, Play } from "lucide-react";
import { numberToHebrewDaf, getMasechetEnglish } from "@/lib/masechet-list";
import { getHebrewDay, getHebrewMonthsForGregorian } from "@/lib/hebrew-date";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const HEBREW_MONTHS = [
  "ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני",
  "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר"
];

const ENGLISH_MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const HEBREW_DAYS = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"];
const ENGLISH_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface CalendarVideo {
  id: string;
  youtube_id: string;
  title: string;
  masechet: string | null;
  daf: number | null;
  published_at: string;
  thumbnail_url: string | null;
}

export function LessonCalendar() {
  const { lang, dir } = useLanguage();
  const [currentDate, setCurrentDate] = useState(new Date());
  const months = lang === "en" ? ENGLISH_MONTHS : HEBREW_MONTHS;
  const days = lang === "en" ? ENGLISH_DAYS : HEBREW_DAYS;
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Fetch videos for the displayed month
  const startOfMonth = new Date(year, month, 1);
  const endOfMonth = new Date(year, month + 1, 0, 23, 59, 59);

  const { data: videos } = useQuery({
    queryKey: ["calendar-videos", year, month],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("videos")
        .select("id, youtube_id, title, masechet, daf, published_at, thumbnail_url")
        .gte("published_at", startOfMonth.toISOString())
        .lte("published_at", endOfMonth.toISOString())
        .order("published_at", { ascending: true });
      if (error) throw error;
      return data as CalendarVideo[];
    },
  });

  // Group videos by day
  const videosByDay = useMemo(() => {
    const map: Record<number, CalendarVideo[]> = {};
    if (!videos) return map;
    for (const v of videos) {
      if (!v.published_at) continue;
      const day = new Date(v.published_at).getDate();
      if (!map[day]) map[day] = [];
      map[day].push(v);
    }
    return map;
  }, [videos]);

  // Calendar grid
  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const calendarDays: (number | null)[] = [];
  for (let i = 0; i < firstDayOfMonth; i++) calendarDays.push(null);
  for (let d = 1; d <= daysInMonth; d++) calendarDays.push(d);
  while (calendarDays.length % 7 !== 0) calendarDays.push(null);

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  const today = new Date();
  const isToday = (day: number) =>
    day === today.getDate() && month === today.getMonth() && year === today.getFullYear();

  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const selectedVideos = selectedDay ? videosByDay[selectedDay] || [] : [];

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4 sm:p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <Button variant="ghost" size="icon" onClick={nextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <div className="text-center flex flex-col items-center gap-0.5">
            <div className="flex items-center gap-1">
              <Select value={String(month)} onValueChange={(v) => setCurrentDate(new Date(year, Number(v), 1))}>
                <SelectTrigger className="h-7 w-auto gap-1 border-none shadow-none font-display text-base font-bold text-foreground px-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                {months.map((m, i) => (
                    <SelectItem key={i} value={String(i)}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={String(year)} onValueChange={(v) => setCurrentDate(new Date(Number(v), month, 1))}>
                <SelectTrigger className="h-7 w-auto gap-1 border-none shadow-none font-display text-base font-bold text-foreground px-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 11 }, (_, i) => year - 5 + i).map((y) => (
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground font-body">{getHebrewMonthsForGregorian(year, month)}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={prevMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 gap-1 mb-1">
        {days.map((day) => (
            <div
              key={day}
              className="text-center text-xs font-body text-muted-foreground py-1"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Days grid */}
        <div className="grid grid-cols-7 gap-1">
          {calendarDays.map((day, i) => {
            if (day === null) {
              return <div key={`empty-${i}`} className="aspect-square" />;
            }
            const hasVideos = !!videosByDay[day];
            const count = videosByDay[day]?.length || 0;
            const selected = selectedDay === day;

            return (
              <button
                key={day}
                onClick={() => setSelectedDay(selected ? null : day)}
                className={`
                  aspect-square rounded-lg flex flex-col items-center justify-center text-sm font-body relative transition-all
                  ${isToday(day) ? "ring-2 ring-accent" : ""}
                  ${selected ? "bg-primary text-primary-foreground" : hasVideos ? "bg-accent/10 hover:bg-accent/20 text-foreground" : "hover:bg-muted text-muted-foreground"}
                `}
              >
                <span className={`${hasVideos ? "font-bold" : ""} text-[11px] leading-tight`}>{day}</span>
                <span className={`text-[7px] leading-tight ${selected ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                  {getHebrewDay(year, month, day)}
                </span>
                {hasVideos && (
                  <div className="flex flex-col items-center gap-0 mt-0.5 w-full overflow-hidden">
                    {videosByDay[day].slice(0, 1).map((v) => (
                      <span
                        key={v.id}
                        className={`text-[12px] leading-[14px] font-bold truncate max-w-full px-0.5 ${
                          selected ? "text-primary-foreground" : "text-accent"
                        }`}
                      >
                        {v.masechet ? (lang === "en" ? `${getMasechetEnglish(v.masechet)}${v.daf ? ` ${v.daf}` : ""}` : `${v.masechet}${v.daf ? ` ${numberToHebrewDaf(v.daf)}` : ""}`) : ""}
                      </span>
                    ))}
                    {count > 1 && (
                      <span className={`text-[7px] leading-[9px] ${selected ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                        +{count - 1}
                      </span>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Selected day lessons */}
        {selectedDay && selectedVideos.length > 0 && (
          <div className="mt-4 pt-4 border-t border-border space-y-2" dir={dir}>
            <p className="text-sm font-body font-semibold text-foreground">
              {lang === "en" ? `${months[month]} ${selectedDay}` : `${selectedDay} ${months[month]}`} — {selectedVideos.length} {lang === "en" ? "lessons" : "שיעורים"}
            </p>
            {selectedVideos.map((video) => (
              <Link
                key={video.id}
                to={`/lesson/${video.youtube_id}`}
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted transition-colors"
              >
                <div className="w-14 h-9 rounded overflow-hidden shrink-0 relative">
                  <img
                    src={
                      video.thumbnail_url ||
                      `https://img.youtube.com/vi/${video.youtube_id}/mqdefault.jpg`
                    }
                    alt=""
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-primary/20">
                    <Play className="h-3 w-3 text-primary-foreground fill-current" />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-body text-sm text-foreground line-clamp-1">{video.title}</p>
                  {video.masechet && (
                    <p className="text-xs text-muted-foreground font-body">
                      {lang === "en" ? getMasechetEnglish(video.masechet) : video.masechet}
                      {video.daf ? (lang === "en" ? ` Page ${video.daf}` : ` דף ${numberToHebrewDaf(video.daf)}`) : ""}
                    </p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}

        {selectedDay && selectedVideos.length === 0 && (
          <div className="mt-4 pt-4 border-t border-border text-center">
            <p className="text-sm text-muted-foreground font-body" dir={dir}>
              {lang === "en" ? "No lessons on this day" : "אין שיעורים ביום זה"}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

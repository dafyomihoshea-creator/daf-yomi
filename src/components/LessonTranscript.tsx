import { useState, useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { authHeaders } from "@/lib/firebase";
import { Search, Volume2, HelpCircle, Loader2, Edit2, Save, X, FileText, AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { parseRawTranscript, type TranscriptSegment } from "@/lib/utils";
import { useIsAdmin } from "@/hooks/useAuth";



interface LessonTranscriptProps {
  youtubeId: string;
  onSeek: (seconds: number) => void;
  currentTime?: number;
}

export function LessonTranscript({ youtubeId, onSeek, currentTime = 0 }: LessonTranscriptProps) {
  const { t, dir, lang } = useLanguage();
  const { isAdmin } = useIsAdmin();
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Edit mode states
  const [isEditing, setIsEditing] = useState(false);
  const [editFormat, setEditFormat] = useState<"srt" | "text">("srt");
  const [rawText, setRawText] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Sync / Fetch States
  const [isFetchingFromYoutube, setIsFetchingFromYoutube] = useState(false);
  const [youtubeError, setYoutubeError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  const loadFromServer = async () => {
    const res = await fetch(`/api/video-transcript/${encodeURIComponent(youtubeId)}`);
    if (!res.ok) throw new Error("Transcript not available");
    const body = await res.json();
    return parseRawTranscript(body.segments) as TranscriptSegment[];
  };

  // Admin: ask the server to fetch the YouTube captions for this lesson.
  const handlePullFromYoutube = async () => {
    setIsFetchingFromYoutube(true);
    setYoutubeError(null);
    try {
      const response = await fetch(`/api/video-transcript/${encodeURIComponent(youtubeId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({ fromYoutube: true }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Failed");
      const loaded = await loadFromServer();
      setSegments(loaded);
      setRawText(segmentsToSRT(loaded));
      setError(null);
    } catch (err: any) {
      setYoutubeError(err.message);
    } finally {
      setIsFetchingFromYoutube(false);
    }
  };

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setError(null);
    setSegments([]);
    loadFromServer()
      .then(loaded => {
        if (!active) return;
        setSegments(loaded || []);
        setRawText(loaded?.length ? segmentsToSRT(loaded) : "");
        setIsLoading(false);
      })
      .catch(err => {
        if (!active) return;
        setError(err.message || "Failed to load transcript");
        setIsLoading(false);
      });
    return () => { active = false; };
  }, [youtubeId]);

  // SRT formatting helper
  const segmentsToSRT = (segs: TranscriptSegment[]): string => {
    if (!Array.isArray(segs)) return "";
    return segs.map((seg, idx) => {
      const formatSRTTime = (sec: number) => {
        const safeSec = Number(sec) || 0;
        const h = Math.floor(safeSec / 3600).toString().padStart(2, "0");
        const m = Math.floor((safeSec % 3600) / 60).toString().padStart(2, "0");
        const s = Math.floor(safeSec % 60).toString().padStart(2, "0");
        const ms = Math.floor((safeSec % 1) * 1000).toString().padStart(3, "0");
        return `${h}:${m}:${s},${ms}`;
      };
      return `${idx + 1}\n${formatSRTTime(seg.start)} --> ${formatSRTTime((seg.start || 0) + (seg.duration || 0))}\n${seg.text || ""}`;
    }).join("\n\n");
  };

  // SRT / WebVTT Parser
  const srtToSegments = (srt: string): TranscriptSegment[] => {
    const list: TranscriptSegment[] = [];
    const blocks = srt.trim().split(/\n\s*\n/);

    for (const block of blocks) {
      const lines = block.split("\n").map(l => l.trim()).filter(Boolean);
      if (lines.length < 2) continue;

      let timeLine = "";
      let textLinesStart = 1;

      // Handle block index line if present
      if (/^\d+$/.test(lines[0])) {
        timeLine = lines[1];
        textLinesStart = 2;
      } else {
        timeLine = lines[0];
        textLinesStart = 1;
      }

      if (!timeLine || !timeLine.includes("-->")) continue;

      const [startStr, endStr] = timeLine.split("-->").map(s => s.trim());
      const parseTime = (str: string) => {
        const cleanStr = str.replace(",", "."); // Support SRT comma representation
        const parts = cleanStr.split(":");
        let h = 0, m = 0, sParts = "";
        
        if (parts.length === 3) {
          h = parseInt(parts[0], 10);
          m = parseInt(parts[1], 10);
          sParts = parts[2];
        } else if (parts.length === 2) {
          m = parseInt(parts[0], 10);
          sParts = parts[1];
        } else {
          sParts = parts[0];
        }
        
        const sSec = parseFloat(sParts) || 0;
        return (h * 3600) + (m * 60) + sSec;
      };

      try {
        const start = parseTime(startStr);
        const end = parseTime(endStr);
        const text = lines.slice(textLinesStart).join(" ");
        if (text) {
          list.push({
            start,
            duration: Math.max(0.5, end - start),
            text
          });
        }
      } catch (e) {
        // Skip malformed timestamp line
      }
    }
    return list;
  };

  // Plain Text segment distributor
  const textToSegments = (text: string): TranscriptSegment[] => {
    // Split by newlines or sentence punctuation
    const lines = text.split(/[\n.]+/).map(l => l.trim()).filter(l => l.length > 5);
    const totalDuration = 1800; // Assume standard 30 minutes duration in seconds
    const segDuration = Math.max(12, Math.floor(totalDuration / Math.max(1, lines.length)));

    return lines.map((line, idx) => ({
      start: idx * segDuration,
      duration: segDuration,
      text: line
    }));
  };

  const handleSaveTranscript = () => {
    setSaveError(null);
    setIsSaving(true);
    let newSegments: TranscriptSegment[] = [];

    try {
      if (editFormat === "srt") {
        newSegments = srtToSegments(rawText);
        if (newSegments.length === 0) {
          throw new Error(lang === "en" ? "No valid SRT/WebVTT subtitles detected. Check your format." : "לא זוהה פורמט כתוביות SRT תקין. בדוק את הטקסט שהזנת.");
        }
      } else {
        newSegments = textToSegments(rawText);
        if (newSegments.length === 0) {
          throw new Error(lang === "en" ? "Please enter some text." : "אנא הזן טקסט כלשהו.");
        }
      }

      authHeaders()
        .then(headers => fetch(`/api/video-transcript/${encodeURIComponent(youtubeId)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...headers },
          body: JSON.stringify({ segments: newSegments }),
        }))
        .then(res => {
          if (!res.ok) throw new Error(lang === "en" ? "Server could not save. Try again." : "השרת נכשל בשמירה. נסה שוב.");
          setSegments(newSegments);
          setIsEditing(false);
          setIsSaving(false);
          setError(null);
        })
        .catch((err) => {
          setSaveError(err.message || "Failed to save transcript");
          setIsSaving(false);
        });

    } catch (err: any) {
      setSaveError(err.message);
      setIsSaving(false);
    }
  };

  const formatTime = (sec: number) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = Math.floor(sec % 60);
    
    const mStr = m.toString().padStart(2, "0");
    const sStr = s.toString().padStart(2, "0");
    
    if (h > 0) {
      return `${h}:${mStr}:${sStr}`;
    }
    return `${m}:${sStr}`;
  };

  const activeSegmentIndex = Array.isArray(segments) ? segments.findIndex(
    (seg, idx) =>
      currentTime >= (seg?.start || 0) &&
      (idx === segments.length - 1 || currentTime < (segments[idx + 1]?.start || 0))
  ) : -1;

  const filteredSegments = Array.isArray(segments) ? segments.filter((seg) =>
    seg?.text ? seg.text.toLowerCase().includes(searchQuery?.toLowerCase() || "") : false
  ) : [];

  const highlightMatch = (text: string, query: string) => {
    if (!text) return "";
    if (!query) return text;
    const parts = text.split(new RegExp(`(${query.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")})`, "gi"));
    return (
      <>
        {parts.map((part, i) =>
          part.toLowerCase() === query.toLowerCase() ? (
            <mark key={i} className="bg-yellow-200 dark:bg-yellow-800 text-yellow-900 dark:text-yellow-100 rounded px-0.5 font-medium">
              {part}
            </mark>
          ) : (
            part
          )
        )}
      </>
    );
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-8 border border-border rounded-lg bg-card text-muted-foreground mt-4" dir={dir}>
        <Loader2 className="h-6 w-6 animate-spin text-accent mb-2" />
        <p className="text-sm font-body">{t("lesson.transcriptLoading")}</p>
      </div>
    );
  }

  // --- EDIT MODE VIEW ---
  if (isEditing) {
    return (
      <div id="lesson-transcript-editor" className="mt-6 border border-border rounded-lg bg-card overflow-hidden shadow-sm" dir={dir}>
        {/* Editor Header */}
        <div className="flex items-center justify-between p-4 border-b border-border bg-muted/40">
          <div className="flex items-center gap-2">
            <Edit2 className="h-4.5 w-4.5 text-accent" />
            <h3 className="font-display font-medium text-base text-foreground">
              {lang === "en" ? "Edit Lesson Transcript" : "עריכת תמלול השיעור"}
            </h3>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsEditing(false)}
            className="h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Format Selectors */}
        <div className="p-4 border-b border-border space-y-3 bg-muted/10">
          <div className="flex gap-2">
            <Button
              variant={editFormat === "srt" ? "default" : "outline"}
              size="sm"
              onClick={() => setEditFormat("srt")}
              className="text-xs font-display"
            >
              <FileText className="h-3.5 w-3.5 mr-1" />
              {lang === "en" ? "Subtitles (SRT / VTT)" : "פורמט כתוביות (SRT / VTT)"}
            </Button>
            <Button
              variant={editFormat === "text" ? "default" : "outline"}
              size="sm"
              onClick={() => setEditFormat("text")}
              className="text-xs font-display"
            >
              <FileText className="h-3.5 w-3.5 mr-1" />
              {lang === "en" ? "Plain Hebrew Text" : "טקסט חופשי (פסקה/עמוד)"}
            </Button>
          </div>

          <p className="text-xs text-muted-foreground leading-relaxed font-body">
            {editFormat === "srt" 
              ? (lang === "en" 
                  ? "Paste synchronized captions from an SRT/VTT file. The system will parse timestamps automatically." 
                  : "הדבק קובץ כתוביות SRT או WebVTT מתוזמן. המערכת תפרסר את הזמנים ותאפשר ניווט אינטראקטיבי.")
              : (lang === "en"
                  ? "Paste raw text from files or emails. The sentences will be distributed evenly across the lesson."
                  : "הדבק טקסט חופשי (לא מתוזמן) מתוך קבצי וורד או אתרים. המשפטים יחולקו ויפרסו אוטומטית לאורך השיעור.")}
          </p>
        </div>

        {/* Text Area */}
        <div className="p-4 space-y-4">
          {saveError && (
            <div className="flex gap-2 p-3 bg-destructive/10 border border-destructive/20 text-destructive text-xs rounded font-body">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{saveError}</span>
            </div>
          )}

          <textarea
            className="w-full h-64 p-3 border border-border rounded font-mono text-xs focus:outline-none focus:ring-1 focus:ring-accent/40 bg-background text-foreground"
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            placeholder={
              editFormat === "srt"
                ? "1\n00:00:01,000 --> 00:00:05,000\nשלום לכולם וברוכים הבאים לשיעור...\n\n2\n00:00:05,200 --> 00:00:10,000\nהיום נעסוק בסוגיית המשנה..."
                : "כתוב או הדבק את הטקסט המלא כאן. המשפטים יופרדו ויחולקו אוטומטית לאורך דקות השיעור כדי לאפשר ללומדים לקרוא ולחפש."
            }
            dir="rtl"
          />

          {/* Action Buttons */}
          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditing(false)}
              className="text-xs font-display"
            >
              {lang === "en" ? "Cancel" : "ביטול"}
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={handleSaveTranscript}
              disabled={isSaving || !rawText.trim()}
              className="text-xs font-display"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                  {lang === "en" ? "Saving..." : "שומר..."}
                </>
              ) : (
                <>
                  <Save className="h-3.5 w-3.5 mr-1" />
                  {lang === "en" ? "Save Transcript" : "שמור תמלול"}
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // --- EMPTY STATE VIEW ---
  if (error || segments.length === 0) {
    return (
      <div id="lesson-transcript-container" className="mt-6 border border-border rounded-lg bg-card overflow-hidden shadow-sm" dir={dir}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border bg-muted/40">
          <div className="flex items-center gap-2">
            <Volume2 className="h-4.5 w-4.5 text-accent" />
            <h3 className="font-display font-medium text-base text-foreground">
              {t("lesson.transcript")}
            </h3>
          </div>
          {isAdmin && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setIsEditing(true);
                setEditFormat("text"); // default to plain text for easy entry
              }}
              className="h-8 gap-1.5 text-xs font-display"
            >
              <Edit2 className="h-3 w-3" />
              {lang === "en" ? "Add Transcript" : "הוסף תמלול"}
            </Button>
          )}
        </div>

        {/* Info Content */}
        <div className="p-6 text-center space-y-4">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-950/30 text-amber-600 dark:text-amber-500">
            <HelpCircle className="h-6 w-6" />
          </div>
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-foreground font-display">
              {lang === "en" ? "Interactive Transcript Offline" : "אין תמלול זמין לשיעור זה"}
            </h4>
            <p className="text-xs text-muted-foreground max-w-md mx-auto leading-relaxed font-body">
              {t("lesson.transcriptUnavailable")}
            </p>
            <p className="text-[11px] text-muted-foreground/80 max-w-md mx-auto leading-relaxed italic font-body">
              {t("lesson.transcriptFallbackInstructions")}
            </p>
          </div>

          {youtubeError && (
            <div className="flex gap-2 p-3 bg-destructive/10 border border-destructive/20 text-destructive text-xs rounded font-body max-w-md mx-auto text-right" dir={dir}>
              <AlertCircle className="h-4 w-4 shrink-0 text-destructive" />
              <span className="flex-1">{youtubeError}</span>
              <button onClick={() => setYoutubeError(null)} className="hover:opacity-70 self-center">
                <X className="h-3 w-3" />
              </button>
            </div>
          )}
          
          <div className="flex flex-wrap gap-2 justify-center pt-2">

            {isAdmin && (
              <Button
                variant="outline"
                size="sm"
                onClick={handlePullFromYoutube}
                disabled={isFetchingFromYoutube}
                className="gap-1.5 font-display text-xs text-muted-foreground hover:text-foreground"
              >
                {isFetchingFromYoutube ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                    {lang === "en" ? "Pulling from YouTube..." : "מושך מיוטיוב..."}
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 mr-1" />
                    {lang === "en" ? "Pull from YouTube" : "משוך מיוטיוב"}
                  </>
                )}
              </Button>
            )}

            <Button
              id="watch-on-youtube-btn"
              variant="outline"
              size="sm"
              className="gap-2 font-display text-xs"
              asChild
            >
              <a
                href={`https://www.youtube.com/watch?v=${youtubeId}`}
                target="_blank"
                referrerPolicy="no-referrer"
                rel="noopener noreferrer"
              >
                {t("lesson.openOnYoutube")}
              </a>
            </Button>

            {isAdmin && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsEditing(true);
                  setEditFormat("text");
                }}
                className="gap-1.5 font-display text-xs"
              >
                <Edit2 className="h-3 w-3" />
                {lang === "en" ? "Manual Text Upload" : "העלאת טקסט ידנית"}
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // --- POPULATED ACTIVE TRANSCRIPT VIEW ---
  return (
    <div id="lesson-interactive-transcript-container" className="mt-6 border border-border rounded-lg bg-card overflow-hidden shadow-sm" dir={dir}>
      {/* Header */}
      <div 
        className="flex items-center justify-between p-4 bg-muted/40 cursor-pointer select-none" 
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <Volume2 className="h-4.5 w-4.5 text-accent" />
          <h3 className="font-display font-medium text-base text-foreground">
            {t("lesson.transcript")}
          </h3>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-accent font-medium font-body bg-accent/10 hover:bg-accent/20 transition-all px-2.5 py-1 rounded-md">
            {isExpanded ? (lang === "en" ? "Collapse" : "כווץ תמלול") : (lang === "en" ? "הצג תמלול מלא" : "הצג תמלול מלא")}
          </span>
          
          {isAdmin && isExpanded && (
            <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>

              <Button
                variant="ghost"
                size="sm"
                onClick={handlePullFromYoutube}
                disabled={isFetchingFromYoutube}
                className="h-7 w-7 p-0"
                title={lang === "en" ? "Fetch from YouTube" : "סנכרון תמלול מיוטיוב"}
              >
                <RefreshCw className={`h-3.5 w-3.5 text-muted-foreground hover:text-foreground ${isFetchingFromYoutube ? "animate-spin text-accent" : ""}`} />
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setIsEditing(true);
                  setRawText(segmentsToSRT(segments));
                  setEditFormat("srt");
                }}
                className="h-7 w-7 p-0"
                title={lang === "en" ? "Edit Transcript" : "ערוך תמלול"}
              >
                <Edit2 className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
              </Button>
            </div>
          )}
        </div>
      </div>

      {isExpanded && (
        <>
          {youtubeError && (
            <div className="mx-4 mt-3 p-2.5 bg-destructive/10 border border-destructive/20 text-destructive text-xs rounded font-body flex gap-2 items-center text-right" dir={dir}>
              <AlertCircle className="h-4 w-4 shrink-0 text-destructive" />
              <span className="flex-1">{youtubeError}</span>
              <button onClick={() => setYoutubeError(null)} className="hover:opacity-70 self-center">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* Search Input */}
          <div className="p-3 border-t border-b border-border bg-muted/20">
            <div className="relative">
              <Search className={`absolute top-2.5 h-4 w-4 text-muted-foreground ${lang === "en" ? "left-3" : "right-3"}`} />
              <input
                type="text"
                placeholder={lang === "en" ? "Search in transcript..." : "חפש בתמלול..."}
                className={`w-full py-1.5 focus:outline-none focus:ring-1 focus:ring-accent/40 rounded bg-background border border-border text-sm font-body ${
                  lang === "en" ? "pl-9 pr-4" : "pr-9 pl-4"
                }`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {/* Segments list */}
          <div className="divide-y divide-border max-h-[320px] overflow-y-auto scrollbar-thin">
            {filteredSegments.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground text-sm font-body">
                {lang === "en" ? "No matches found" : "לא נמצאו התאמות"}
              </div>
            ) : (
              filteredSegments.map((seg) => {
                const isOriginalIndexActive = segments.indexOf(seg) === activeSegmentIndex;
                return (
                  <button
                    key={seg.start}
                    onClick={() => onSeek(seg.start)}
                    className={`w-full text-right flex gap-3 p-2.5 items-start transition-all hover:bg-muted/60 focus:bg-muted/80 focus:outline-none text-sm group ${
                      isOriginalIndexActive
                        ? "bg-accent/10 border-r-2 border-accent text-accent font-medium font-body"
                        : "text-foreground font-body"
                    }`}
                  >
                    {/* Time Badge */}
                    <span className={`shrink-0 font-mono text-xs px-2 py-0.5 rounded transition-colors ${
                      isOriginalIndexActive
                        ? "bg-accent text-accent-foreground"
                        : "bg-muted text-muted-foreground group-hover:bg-accent/15 group-hover:text-accent"
                    }`}>
                      {formatTime(seg.start)}
                    </span>

                    {/* Segment Text */}
                    <span className="flex-1 text-right text-xs leading-relaxed select-text">
                      {highlightMatch(seg.text, searchQuery)}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </>
      )}
    </div>
  );
}

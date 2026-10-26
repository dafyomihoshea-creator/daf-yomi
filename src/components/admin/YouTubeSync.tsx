import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { RefreshCw, CheckCircle, Clock, AlertCircle, Copy, Check, Info, Sparkles } from "lucide-react";

export function YouTubeSync() {
  const [syncing, setSyncing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [result, setResult] = useState<{ newVideos: number } | null>(null);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const queryClient = useQueryClient();

  const { data: rawLogs, refetch } = useQuery({
    queryKey: ["sync-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sync_logs")
        .select("*")
        .order("ran_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
  });

  const youtubeLogs = (rawLogs || []).filter((l: any) => l.type === "youtube_sync" || (!l.type && l.status !== "AI_QUOTA_EXCEEDED" && l.status !== "AI_BATCH_SUCCESS"));
  const aiLogs = (rawLogs || []).filter((l: any) => l.type === "ai_summary" || l.status === "AI_QUOTA_EXCEEDED" || l.status === "AI_BATCH_SUCCESS");

  const handleSync = async () => {
    setSyncing(true);
    setResult(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const resp = await fetch("/api/sync-youtube", { 
        method: "POST",
        headers: {
          "Authorization": `Bearer ${session?.access_token}`
        }
      });
      if (!resp.ok) {
        const errText = await resp.text();
        throw new Error(errText || "Sync failed. Check server logs");
      }
      const data = await resp.json();
      setResult({ newVideos: data.newVideos || 0 });
      toast({ title: `הסנכרון הושלם בהצלחה!`, description: `נוספו ${data.newVideos || 0} סרטונים חדשים` });
      
      // Invalidate query cache so all lists, calendars, and tables refresh immediately after syncing
      await queryClient.invalidateQueries({ queryKey: ["admin-videos"] });
      await queryClient.invalidateQueries({ queryKey: ["videos"] });
      await queryClient.invalidateQueries({ queryKey: ["admin-video-dates"] });
      await queryClient.invalidateQueries({ queryKey: ["calendar-videos"] });
      await queryClient.invalidateQueries({ queryKey: ["dafim"] });
      await queryClient.invalidateQueries({ queryKey: ["masechtot"] });
      await queryClient.invalidateQueries({ queryKey: ["total-video-count"] });
      await queryClient.invalidateQueries({ queryKey: ["summary-stats"] });
      
      refetch();
    } catch (err: any) {
      toast({ title: "שגיאה בסנכרון", description: err.message, variant: "destructive" });
      refetch();
    } finally {
      setSyncing(false);
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "לא צוין";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "לא צוין";
    return d.toLocaleString("he-IL", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display text-lg flex items-center gap-2" dir="rtl">
          <RefreshCw className="h-5 w-5 text-accent" />
          סנכרון יוטיוב
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground font-body" dir="rtl">
          סנכרון אוטומטי פעמיים ביום (06:00 ו-20:00). ניתן גם להפעיל ידנית (ירוץ ברקע ולעתים ייקח כמה דקות).
        </p>
        <div className="flex gap-2" dir="rtl">
          <Button onClick={handleSync} disabled={syncing} className="font-body">
            {syncing ? <RefreshCw className="h-4 w-4 animate-spin ml-2" /> : <RefreshCw className="h-4 w-4 ml-2" />}
            {syncing ? "מסנכרן..." : "סנכרן עכשיו"}
          </Button>
          <Button onClick={async () => {
            setSyncing(true);
            try {
              const { data: { session } } = await supabase.auth.getSession();
              const resp = await fetch("/api/re-catalog-videos", { 
                method: "POST",
                headers: {
                  "Authorization": `Bearer ${session?.access_token}`
                }
              });
              if (!resp.ok) throw new Error("Recatalog failed");
              const data = await resp.json();
              toast({ title: `עודכן בהצלחה! ${data.updated} עודכנו, ${data.inserted} נוצרו כפולות.` });
            } catch (err: any) {
              toast({ title: "שגיאה", description: err.message, variant: "destructive" });
            } finally {
              setSyncing(false);
            }
          }} disabled={syncing} variant="outline" className="font-body">
            עדכן קיטלוג מסכתות (Re-catalog)
          </Button>


        </div>
        {result && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground font-body" dir="rtl">
            <CheckCircle className="h-4 w-4 text-green-500" />
            נוספו {result.newVideos} סרטונים חדשים
          </div>
        )}

        {/* Auto Sync & Webhook Information */}
        <div className="rounded-lg border bg-muted/30 p-4 space-y-3" dir="rtl">
          <div className="flex items-start gap-2.5">
            <Info className="h-5 w-5 text-accent shrink-0 mt-0.5" />
            <div className="space-y-1 text-sm font-body">
              <h4 className="font-semibold text-foreground">כיצד עובד העדכון היומי?</h4>
              <p className="text-muted-foreground text-xs leading-relaxed">
                עובד אוטומטי (GitHub Actions) בודק כל 3 שעות אם הועלו שיעורים חדשים ליוטיוב, מוסיף אותם לאתר עם כתוביות וסיכום כשאפשר.
                פעם ביום הוא גם ממשיך את תמלול השיעורים הישנים ומעדכן את דפי האתר לגוגל. הכפתור למעלה מריץ את הבדיקה מיד.
              </p>
            </div>
          </div>
        </div>

        {/* YouTube Sync History */}
        {youtubeLogs && youtubeLogs.length > 0 && (
          <div className="mt-4 space-y-2" dir="rtl">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold font-body flex items-center gap-1.5">
                <RefreshCw className="h-4 w-4 text-accent" />
                היסטוריית סנכרון שיעורים מיוטיוב
              </h4>
              <span className="text-xs text-muted-foreground font-body">
                {youtubeLogs.length} רישומים אחרונים
              </span>
            </div>
            <div className="rounded-md border overflow-hidden">
              <table className="w-full text-sm font-body">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="py-2 px-3 text-right">זמן</th>
                    <th className="py-2 px-3 text-right">סטטוס</th>
                    <th className="py-2 px-3 text-right">שיעורים שנוספו</th>
                  </tr>
                </thead>
                <tbody>
                  {youtubeLogs.map((log: any) => (
                    <tr key={log.id} className="border-t">
                      <td className="py-2 px-3 flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                        {formatDate(log.ran_at)}
                      </td>
                      <td className="py-2 px-3">
                        {log.status === "success" ? (
                          <span className="text-green-600 flex items-center gap-1">
                            <CheckCircle className="h-3.5 w-3.5" /> הצלחה
                          </span>
                        ) : (
                          <span className="text-destructive flex items-center gap-1" title={log.error_message || ""}>
                            <AlertCircle className="h-3.5 w-3.5" /> {log.error_message || "שגיאה"}
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-3 font-semibold">{log.new_videos ?? 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* AI Background Summaries Logs */}
        {aiLogs && aiLogs.length > 0 && (
          <div className="mt-6 space-y-2 border-t pt-4" dir="rtl">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold font-body flex items-center gap-1.5 text-muted-foreground">
                <Sparkles className="h-4 w-4 text-primary" />
                יומן יצירת סיכומי AI (פועל ברקע בנפרד מסנכרון השיעורים)
              </h4>
            </div>
            <div className="rounded-md border overflow-hidden bg-muted/20">
              <table className="w-full text-xs font-body">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="py-1.5 px-3 text-right">זמן</th>
                    <th className="py-1.5 px-3 text-right">סטטוס</th>
                    <th className="py-1.5 px-3 text-right">סוכמו בהצלחה</th>
                    <th className="py-1.5 px-3 text-right">הערה</th>
                  </tr>
                </thead>
                <tbody>
                  {aiLogs.slice(0, 5).map((log: any) => (
                    <tr key={log.id} className="border-t">
                      <td className="py-1.5 px-3">{formatDate(log.ran_at)}</td>
                      <td className="py-1.5 px-3">
                        {log.status === "AI_BATCH_SUCCESS" ? (
                          <span className="text-green-600">הצלחה</span>
                        ) : log.status === "AI_QUOTA_EXCEEDED" ? (
                          <span className="text-amber-600">מכסת AI יומית נוצלה</span>
                        ) : (
                          <span className="text-destructive">שגיאה</span>
                        )}
                      </td>
                      <td className="py-1.5 px-3">{log.total_processed ?? 0}</td>
                      <td className="py-1.5 px-3 text-muted-foreground">{log.error_message || "תקין"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

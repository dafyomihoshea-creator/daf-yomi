import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { FileText, Loader2, RefreshCw } from "lucide-react";
import { clientCatalog, reloadClientCatalog } from "@/lib/catalog-client";
import { authHeaders } from "@/lib/firebase";

const PAGE = 25;

/** Transcript status of all lessons. Real transcripts come from YouTube captions. */
export function TranscriptFetcher() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);

  const { data: videos = [] } = useQuery({
    queryKey: ["admin-transcript-status"],
    queryFn: () => clientCatalog.getAll(),
  });

  const { withT, missing } = useMemo(() => {
    const byBase = new Map<string, any>();
    for (const v of videos) {
      const base = String(v.youtube_id).substring(0, 11);
      if (!byBase.has(base) || !String(v.youtube_id).includes("_")) byBase.set(base, v);
    }
    const all = Array.from(byBase.values());
    return {
      withT: all.filter(v => v.has_transcript).length,
      missing: all.filter(v => !v.has_transcript).sort((a, b) => String(b.published_at || "").localeCompare(String(a.published_at || ""))),
    };
  }, [videos]);

  const pull = async (youtubeId: string) => {
    setBusy(youtubeId);
    try {
      const res = await fetch(`/api/video-transcript/${encodeURIComponent(youtubeId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({ fromYoutube: true }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Failed");
      toast({ title: "התמלול נשמר" });
      await reloadClientCatalog();
      queryClient.invalidateQueries({ queryKey: ["admin-transcript-status"] });
    } catch (err: any) {
      toast({ title: "לא ניתן למשוך תמלול", description: err.message, variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  const shown = missing.slice(page * PAGE, (page + 1) * PAGE);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display text-lg flex items-center gap-2" dir="rtl">
          <FileText className="h-5 w-5" /> תמלולי שיעורים
        </CardTitle>
        <CardDescription dir="rtl" className="font-body">
          {withT} סרטונים עם תמלול · {missing.length} בלי תמלול. התמלולים הם הכתוביות האוטומטיות של יוטיוב.
          יוטיוב חוסם לעיתים קרובות הורדה משרתי ענן, ולכן הדרך העיקרית היא סקריפט ההורדה מהמחשב במשרד.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2" dir="rtl">
        {shown.map(v => (
          <div key={v.youtube_id} className="flex items-center justify-between gap-3 p-2 border border-border rounded">
            <Link to={`/lesson/${v.youtube_id}`} className="text-sm font-body line-clamp-1 hover:underline">{v.title}</Link>
            <Button size="sm" variant="outline" disabled={busy === v.youtube_id} onClick={() => pull(String(v.youtube_id).substring(0, 11))} className="shrink-0 gap-1">
              {busy === v.youtube_id ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
              משוך מיוטיוב
            </Button>
          </div>
        ))}
        {missing.length > PAGE && (
          <div className="flex justify-between pt-2">
            <Button size="sm" variant="ghost" disabled={page === 0} onClick={() => setPage(p => p - 1)}>הקודם</Button>
            <span className="text-xs text-muted-foreground self-center">עמוד {page + 1} מתוך {Math.ceil(missing.length / PAGE)}</span>
            <Button size="sm" variant="ghost" disabled={(page + 1) * PAGE >= missing.length} onClick={() => setPage(p => p + 1)}>הבא</Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

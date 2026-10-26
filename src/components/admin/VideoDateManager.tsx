import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import { Calendar, Save, AlertTriangle, CheckCircle } from "lucide-react";

interface VideoRow {
  id: string;
  title: string;
  masechet: string | null;
  daf: number | null;
  published_at: string | null;
  youtube_id: string;
}

export function VideoDateManager() {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDate, setEditDate] = useState("");

  const { data: videos, isLoading } = useQuery({
    queryKey: ["admin-video-dates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("videos")
        .select("id, title, masechet, daf, published_at, youtube_id")
        .order("published_at", { ascending: false });
      if (error) throw error;
      return data as VideoRow[];
    },
  });

  // Sort: duplicates first, then the rest
  const sortedVideos = useMemo(() => {
    if (!videos) return [];
    const dateCount: Record<string, number> = {};
    for (const v of videos) {
      if (!v.published_at) continue;
      const dateKey = v.published_at.slice(0, 10);
      dateCount[dateKey] = (dateCount[dateKey] || 0) + 1;
    }

    const duplicates: VideoRow[] = [];
    const singles: VideoRow[] = [];
    const noDate: VideoRow[] = [];

    for (const v of videos) {
      if (!v.published_at) {
        noDate.push(v);
      } else {
        const dateKey = v.published_at.slice(0, 10);
        if (dateCount[dateKey] > 1) {
          duplicates.push(v);
        } else {
          singles.push(v);
        }
      }
    }

    return [...duplicates, ...noDate, ...singles];
  }, [videos]);

  const duplicateDates = useMemo(() => {
    if (!videos) return new Set<string>();
    const dateCount: Record<string, number> = {};
    for (const v of videos) {
      if (!v.published_at) continue;
      const dateKey = v.published_at.slice(0, 10);
      dateCount[dateKey] = (dateCount[dateKey] || 0) + 1;
    }
    return new Set(Object.entries(dateCount).filter(([, c]) => c > 1).map(([d]) => d));
  }, [videos]);

  const updateDateMutation = useMutation({
    mutationFn: async ({ id, published_at }: { id: string; published_at: string }) => {
      const { error } = await supabase
        .from("videos")
        .update({ published_at, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-video-dates"] });
      queryClient.invalidateQueries({ queryKey: ["calendar-videos"] });
      queryClient.invalidateQueries({ queryKey: ["videos"] });
      setEditingId(null);
      toast({ title: "התאריך עודכן בהצלחה" });
    },
    onError: (err: any) => {
      toast({ title: "שגיאה", description: err.message, variant: "destructive" });
    },
  });

  const startEdit = (video: VideoRow) => {
    setEditingId(video.id);
    setEditDate(video.published_at ? video.published_at.slice(0, 16) : "");
  };

  const duplicateCount = sortedVideos.filter(
    (v) => v.published_at && duplicateDates.has(v.published_at.slice(0, 10))
  ).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display text-lg flex items-center gap-2" dir="rtl">
          <Calendar className="h-5 w-5 text-accent" />
          ניהול תאריכי שיעורים
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {duplicateCount > 0 && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-sm font-body" dir="rtl">
            <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
            <span className="text-destructive">
              {duplicateCount} שיעורים עם תאריך כפול — מוצגים ראשונים
            </span>
          </div>
        )}

        {isLoading ? (
          <Skeleton className="h-64 w-full" />
        ) : (
          <div className="overflow-auto max-h-[500px]">
            <Table dir="rtl">
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right font-body">כותרת</TableHead>
                  <TableHead className="text-right font-body w-24">מסכת</TableHead>
                  <TableHead className="text-right font-body w-16">דף</TableHead>
                  <TableHead className="text-right font-body w-44">תאריך פרסום</TableHead>
                  <TableHead className="text-right font-body w-16">פעולה</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedVideos.map((video) => {
                  const isDuplicate = video.published_at && duplicateDates.has(video.published_at.slice(0, 10));
                  return (
                    <TableRow key={video.id} className={isDuplicate ? "bg-destructive/5" : ""}>
                      <TableCell className="font-body text-foreground text-sm max-w-[200px] truncate">
                        {isDuplicate && <AlertTriangle className="h-3 w-3 text-destructive inline ml-1" />}
                        {video.title}
                      </TableCell>
                      <TableCell className="font-body text-foreground text-sm">
                        {video.masechet || "—"}
                      </TableCell>
                      <TableCell className="font-body text-foreground text-sm">
                        {video.daf || "—"}
                      </TableCell>
                      <TableCell>
                        {editingId === video.id ? (
                          <Input
                            type="datetime-local"
                            value={editDate}
                            onChange={(e) => setEditDate(e.target.value)}
                            className="text-foreground text-sm w-full"
                          />
                        ) : (
                          <span className="text-sm text-muted-foreground font-body">
                            {video.published_at
                              ? new Date(video.published_at).toLocaleDateString("he-IL", {
                                  day: "numeric",
                                  month: "short",
                                  year: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                              : "—"}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {editingId === video.id ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              if (!editDate) return;
                              updateDateMutation.mutate({
                                id: video.id,
                                published_at: new Date(editDate).toISOString(),
                              });
                            }}
                            disabled={updateDateMutation.isPending}
                          >
                            <Save className="h-4 w-4 text-accent" />
                          </Button>
                        ) : (
                          <Button variant="ghost" size="icon" onClick={() => startEdit(video)}>
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

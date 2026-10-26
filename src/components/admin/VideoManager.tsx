import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";
import { Search, Pencil, Trash2, Save, X, ChevronLeft, ChevronRight, Video, AlertTriangle, FileText, Bot, UserCheck } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const PAGE_SIZE = 20;

export function VideoManager() {
  const [search, setSearch] = useState("");
  const [showIncomplete, setShowIncomplete] = useState(true);
  const [page, setPage] = useState(0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editSummaryId, setEditSummaryId] = useState<string | null>(null);
  const [editSummaryValue, setEditSummaryValue] = useState("");
  const [editValues, setEditValues] = useState<{ masechet: string; daf: string; title: string }>({
    masechet: "",
    daf: "",
    title: "",
  });
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["admin-videos", search, page, showIncomplete],
    queryFn: async () => {
      let query = supabase
        .from("videos")
        .select("*", { count: "exact" })
        .order("published_at", { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (showIncomplete) {
        query = query.or("masechet.is.null,daf.is.null");
      }

      if (search) {
        query = query.ilike("title", `%${search}%`);
      }

      const { data, error, count } = await query;
      if (error) throw error;
      return { videos: data, total: count || 0 };
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, masechet, daf, title }: { id: string; masechet: string | null; daf: number | null; title: string }) => {
      const { error } = await supabase
        .from("videos")
        .update({ masechet, daf, title, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-videos"] });
      queryClient.invalidateQueries({ queryKey: ["videos"] });
      setEditingId(null);
      toast({ title: "השיעור עודכן בהצלחה" });
    },
    onError: (err: any) => {
      toast({ title: "שגיאה", description: err.message, variant: "destructive" });
    },
  });

  const updateSummaryMutation = useMutation({
    mutationFn: async ({ id, summary }: { id: string; summary: string }) => {
      const { error } = await supabase
        .from("videos")
        .update({ summary, summary_edited: true, updated_at: new Date().toISOString() } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-videos"] });
      queryClient.invalidateQueries({ queryKey: ["videos"] });
      setEditSummaryId(null);
      toast({ title: "התקציר עודכן בהצלחה" });
    },
    onError: (err: any) => {
      toast({ title: "שגיאה", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("videos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-videos"] });
      queryClient.invalidateQueries({ queryKey: ["videos"] });
      toast({ title: "השיעור נמחק" });
    },
    onError: (err: any) => {
      toast({ title: "שגיאה", description: err.message, variant: "destructive" });
    },
  });

  const startEdit = (video: any) => {
    setEditingId(video.id);
    setEditValues({
      masechet: video.masechet || "",
      daf: video.daf?.toString() || "",
      title: video.title,
    });
  };

  const saveEdit = () => {
    if (!editingId) return;
    updateMutation.mutate({
      id: editingId,
      masechet: editValues.masechet || null,
      daf: editValues.daf ? parseInt(editValues.daf) : null,
      title: editValues.title,
    });
  };

  const totalPages = Math.ceil((data?.total || 0) / PAGE_SIZE);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display text-lg flex items-center gap-2" dir="rtl">
          <Video className="h-5 w-5 text-accent" />
          ניהול שיעורים ({data?.total || 0})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filter buttons */}
        <div className="flex gap-2" dir="rtl">
          <Button
            variant={showIncomplete ? "default" : "outline"}
            size="sm"
            onClick={() => { setShowIncomplete(true); setPage(0); }}
            className="font-body gap-1"
          >
            <AlertTriangle className="h-4 w-4" />
            חסרי מסכת/דף ({showIncomplete ? data?.total || "..." : "..."})
          </Button>
          <Button
            variant={!showIncomplete ? "default" : "outline"}
            size="sm"
            onClick={() => { setShowIncomplete(false); setPage(0); }}
            className="font-body"
          >
            כל השיעורים
          </Button>
        </div>

        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="חפש שיעור..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            className="pr-10 text-foreground"
            dir="rtl"
          />
        </div>

        {isLoading ? (
          <Skeleton className="h-64 w-full" />
        ) : (
          <>
            <div className="overflow-auto">
              <Table dir="rtl">
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right font-body">כותרת</TableHead>
                    <TableHead className="text-right font-body w-28">מסכת</TableHead>
                    <TableHead className="text-right font-body w-20">דף</TableHead>
                    <TableHead className="text-right font-body w-28">תאריך</TableHead>
                    <TableHead className="text-right font-body w-24">פעולות</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.videos.map((video: any) => (
                    <React.Fragment key={video.id}>
                      <TableRow>
                        {editingId === video.id ? (
                          <>
                            <TableCell>
                              <Input
                                value={editValues.title}
                                onChange={(e) => setEditValues({ ...editValues, title: e.target.value })}
                                className="text-foreground text-sm"
                                dir="rtl"
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                value={editValues.masechet}
                                onChange={(e) => setEditValues({ ...editValues, masechet: e.target.value })}
                                className="text-foreground text-sm"
                                dir="rtl"
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                value={editValues.daf}
                                onChange={(e) => setEditValues({ ...editValues, daf: e.target.value })}
                                className="text-foreground text-sm w-16"
                                type="number"
                              />
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground font-body">
                              {video.published_at ? new Date(video.published_at).toLocaleDateString("he-IL") : "—"}
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                <Button variant="ghost" size="icon" onClick={saveEdit} disabled={updateMutation.isPending}>
                                  <Save className="h-4 w-4 text-accent" />
                                </Button>
                                <Button variant="ghost" size="icon" onClick={() => setEditingId(null)}>
                                  <X className="h-4 w-4 text-muted-foreground" />
                                </Button>
                              </div>
                            </TableCell>
                          </>
                        ) : (
                          <>
                            <TableCell className="font-body text-foreground text-sm max-w-[250px] truncate">
                              {video.title}
                            </TableCell>
                            <TableCell className="font-body text-foreground text-sm">
                              {video.masechet || "—"}
                            </TableCell>
                            <TableCell className="font-body text-foreground text-sm">
                              {video.daf || "—"}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground font-body">
                              {video.published_at ? new Date(video.published_at).toLocaleDateString("he-IL") : "—"}
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                <Button variant="ghost" size="icon" onClick={() => startEdit(video)}>
                                  <Pencil className="h-4 w-4 text-muted-foreground" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => {
                                    setEditSummaryId(editSummaryId === video.id ? null : video.id);
                                    setEditSummaryValue(video.summary || "");
                                  }}
                                  title="ערוך תקציר"
                                >
                                  <FileText className="h-4 w-4 text-muted-foreground" />
                                </Button>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button variant="ghost" size="icon">
                                      <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle dir="rtl">מחיקת שיעור</AlertDialogTitle>
                                      <AlertDialogDescription dir="rtl">
                                        האם אתה בטוח שברצונך למחוק את השיעור "{video.title}"?
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel className="font-body">ביטול</AlertDialogCancel>
                                      <AlertDialogAction
                                        className="font-body bg-destructive text-destructive-foreground"
                                        onClick={() => deleteMutation.mutate(video.id)}
                                      >
                                        מחק
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </div>
                            </TableCell>
                          </>
                        )}
                      </TableRow>
                      {/* Summary edit row */}
                      {editSummaryId === video.id && (
                        <TableRow>
                          <TableCell colSpan={5} className="p-3 bg-muted/30">
                            <div className="space-y-2" dir="rtl">
                              <div className="flex items-center gap-2 text-xs text-muted-foreground font-body">
                                {video.summary_edited ? (
                                  <span className="flex items-center gap-1 text-accent">
                                    <UserCheck className="h-3 w-3" /> נערך ע״י המנהל
                                  </span>
                                ) : video.summary ? (
                                  <span className="flex items-center gap-1">
                                    <Bot className="h-3 w-3" /> תקציר אוטומטי (בינה מלאכותית)
                                  </span>
                                ) : (
                                  <span>אין תקציר</span>
                                )}
                              </div>
                              <Textarea
                                value={editSummaryValue}
                                onChange={(e) => setEditSummaryValue(e.target.value)}
                                className="text-foreground text-sm font-body min-h-[80px]"
                                dir="rtl"
                                placeholder="הקלד תקציר..."
                              />
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  onClick={() => updateSummaryMutation.mutate({ id: video.id, summary: editSummaryValue })}
                                  disabled={updateSummaryMutation.isPending}
                                  className="font-body gap-1"
                                >
                                  <Save className="h-3 w-3" /> שמור תקציר
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setEditSummaryId(null)}
                                  className="font-body"
                                >
                                  ביטול
                                </Button>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={page === 0}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <span className="text-sm text-muted-foreground font-body">
                  {page + 1} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

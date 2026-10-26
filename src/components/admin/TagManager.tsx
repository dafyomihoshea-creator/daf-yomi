import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import { Tag, Plus, X, Search, Loader2 } from "lucide-react";

export function TagManager() {
  const [search, setSearch] = useState("");
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null);
  const [newTag, setNewTag] = useState("");
  const queryClient = useQueryClient();

  // Fetch videos with their tags
  const { data: videos, isLoading: videosLoading } = useQuery({
    queryKey: ["admin-videos-tags", search],
    queryFn: async () => {
      let query = supabase
        .from("videos")
        .select("id, title, youtube_id")
        .order("published_at", { ascending: false })
        .limit(50);
      if (search) {
        query = query.ilike("title", `%${search}%`);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const { data: tags, isLoading: tagsLoading } = useQuery({
    queryKey: ["video-tags", selectedVideoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("video_tags")
        .select("*")
        .eq("video_id", selectedVideoId!);
      if (error) throw error;
      return data;
    },
    enabled: !!selectedVideoId,
  });

  const addTagMutation = useMutation({
    mutationFn: async ({ videoId, tag }: { videoId: string; tag: string }) => {
      const { error } = await supabase
        .from("video_tags")
        .insert({ video_id: videoId, tag });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["video-tags"] });
      setNewTag("");
      toast({ title: "התגית נוספה" });
    },
    onError: (err: any) => {
      toast({ title: "שגיאה", description: err.message, variant: "destructive" });
    },
  });

  const deleteTagMutation = useMutation({
    mutationFn: async (tagId: string) => {
      const { error } = await supabase
        .from("video_tags")
        .delete()
        .eq("id", tagId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["video-tags"] });
      toast({ title: "התגית הוסרה" });
    },
  });

  const handleAddTag = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVideoId || !newTag.trim()) return;
    addTagMutation.mutate({ videoId: selectedVideoId, tag: newTag.trim() });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display text-lg flex items-center gap-2" dir="rtl">
          <Tag className="h-5 w-5 text-accent" />
          ניהול תגיות
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="חפש שיעור לתיוג..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pr-10 text-foreground"
            dir="rtl"
          />
        </div>

        {videosLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : (
          <div className="max-h-48 overflow-y-auto space-y-1 border border-border rounded-lg p-2">
            {videos?.map((video) => (
              <button
                key={video.id}
                onClick={() => setSelectedVideoId(video.id)}
                className={`w-full text-right p-2 rounded text-sm font-body transition-colors ${
                  selectedVideoId === video.id
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-muted text-foreground"
                }`}
                dir="rtl"
              >
                {video.title}
              </button>
            ))}
          </div>
        )}

        {selectedVideoId && (
          <div className="space-y-3 pt-2 border-t border-border">
            <p className="text-sm font-body text-muted-foreground" dir="rtl">
              תגיות לשיעור הנבחר:
            </p>
            {tagsLoading ? (
              <Skeleton className="h-8 w-40" />
            ) : (
              <div className="flex flex-wrap gap-2" dir="rtl">
                {tags?.map((tag) => (
                  <Badge key={tag.id} variant="secondary" className="gap-1 font-body">
                    {tag.tag}
                    <button
                      onClick={() => deleteTagMutation.mutate(tag.id)}
                      className="hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
                {(!tags || tags.length === 0) && (
                  <span className="text-xs text-muted-foreground font-body">אין תגיות</span>
                )}
              </div>
            )}
            <form onSubmit={handleAddTag} className="flex gap-2" dir="rtl">
              <Input
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                placeholder="תגית חדשה..."
                className="text-foreground text-sm flex-1"
                dir="rtl"
              />
              <Button
                type="submit"
                size="sm"
                disabled={addTagMutation.isPending || !newTag.trim()}
                className="font-body gap-1"
              >
                {addTagMutation.isPending ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Plus className="h-3 w-3" />
                )}
                הוסף
              </Button>
            </form>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

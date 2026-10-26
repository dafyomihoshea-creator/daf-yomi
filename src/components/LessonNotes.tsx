import { useState, useEffect } from "react";
import { useLessonNote } from "@/hooks/useLessonNotes";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { StickyNote, Save, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface LessonNotesProps { videoId: string; }

export function LessonNotes({ videoId }: LessonNotesProps) {
  const { user } = useAuth();
  const { note, isLoading, saveNote } = useLessonNote(videoId);
  const [content, setContent] = useState("");
  const [dirty, setDirty] = useState(false);
  const { t, dir } = useLanguage();

  useEffect(() => { setContent(note?.content || ""); setDirty(false); }, [note]);

  if (!user) return null;

  const handleSave = async () => {
    try { await saveNote.mutateAsync(content); setDirty(false); toast({ title: t("notes.saved") }); }
    catch { toast({ title: t("notes.error"), variant: "destructive" }); }
  };

  return (
    <Card className="mt-6">
      <CardContent className="p-4 space-y-3" dir={dir}>
        <div className="flex items-center gap-2">
          <StickyNote className="h-4 w-4 text-accent" />
          <span className="font-display text-sm font-bold text-foreground">{t("notes.title")}</span>
        </div>
        {isLoading ? (
          <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : (
          <>
            <Textarea value={content} onChange={(e) => { setContent(e.target.value); setDirty(true); }} placeholder={t("notes.placeholder")} className="text-foreground text-sm font-body min-h-[100px]" dir={dir} />
            {dirty && (
              <Button size="sm" onClick={handleSave} disabled={saveNote.isPending} className="font-body gap-1">
                {saveNote.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}{t("notes.save")}
              </Button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

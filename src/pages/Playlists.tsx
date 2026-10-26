import { useState } from "react";
import { Header } from "@/components/Header";
import { SEOHead } from "@/components/SEOHead";
import { VideoCard } from "@/components/VideoCard";
import { useAuth } from "@/hooks/useAuth";
import { usePlaylists, usePlaylistItems, useCreatePlaylist, useDeletePlaylist } from "@/hooks/usePlaylists";
import { useLanguage } from "@/contexts/LanguageContext";
import { Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Trash2, ListMusic, ChevronRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

const Playlists = () => {
  const { user, loading: authLoading } = useAuth();
  const { data: playlists, isLoading } = usePlaylists();
  const createPlaylist = useCreatePlaylist();
  const deletePlaylist = useDeletePlaylist();
  const [newName, setNewName] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { data: items, isLoading: itemsLoading } = usePlaylistItems(selectedId);
  const { t, dir } = useLanguage();

  if (authLoading) return null;
  if (!user) return <Navigate to="/login" replace />;

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try {
      await createPlaylist.mutateAsync(newName.trim());
      setNewName("");
      toast.success(t("playlists.created"));
    } catch {
      toast.error(t("playlists.createError"));
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deletePlaylist.mutateAsync(id);
      if (selectedId === id) setSelectedId(null);
      toast.success(t("playlists.deleted"));
    } catch {
      toast.error(t("playlists.deleteError"));
    }
  };

  const selectedPlaylist = playlists?.find((p: any) => p.id === selectedId);

  return (
    <div className="min-h-screen bg-background">
      <SEOHead title={t("playlists.title")} path="/playlists" />
      <Header />
      <div className="container px-4 py-8 max-w-4xl">
        <h1 className="font-display text-2xl font-bold text-foreground mb-6" dir={dir}>{t("playlists.title")}</h1>

        <div className="flex gap-2 mb-6" dir={dir}>
          <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={t("playlists.newName")} className="max-w-xs font-body" onKeyDown={(e) => e.key === "Enter" && handleCreate()} />
          <Button onClick={handleCreate} disabled={!newName.trim()} size="sm" className="gap-1.5"><Plus className="h-4 w-4" />{t("playlists.create")}</Button>
        </div>

        {isLoading ? (
          <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
        ) : !selectedId ? (
          <div className="space-y-2">
            {playlists && playlists.length > 0 ? (
              playlists.map((playlist: any) => (
                <Card key={playlist.id} className="cursor-pointer hover:border-accent transition-colors" onClick={() => setSelectedId(playlist.id)}>
                  <CardContent className="p-4 flex items-center justify-between" dir={dir}>
                    <div className="flex items-center gap-3">
                      <ListMusic className="h-5 w-5 text-accent" />
                      <div>
                        <p className="font-display font-bold text-foreground">{playlist.name}</p>
                        <p className="text-xs text-muted-foreground font-body">{playlist.playlist_items?.[0]?.count || 0} {t("playlists.lessons")}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={(e) => { e.stopPropagation(); handleDelete(playlist.id); }}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <div className="text-center py-12">
                <ListMusic className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
                <p className="text-muted-foreground font-body" dir={dir}>{t("playlists.empty")}</p>
              </div>
            )}
          </div>
        ) : (
          <div>
            <Button variant="ghost" size="sm" onClick={() => setSelectedId(null)} className="mb-4 font-body" dir={dir}>{t("playlists.back")}</Button>
            <h2 className="font-display text-lg font-bold text-foreground mb-4" dir={dir}>{selectedPlaylist?.name}</h2>
            {itemsLoading ? <Skeleton className="h-40" /> : items && items.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {items.map((item: any) => <VideoCard key={item.id} video={item.videos} />)}
              </div>
            ) : (
              <p className="text-center text-muted-foreground font-body py-8" dir={dir}>{t("playlists.emptyPlaylist")}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Playlists;

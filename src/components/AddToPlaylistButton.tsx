import { useState } from "react";
import { ListPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { usePlaylists, useAddToPlaylist } from "@/hooks/usePlaylists";
import { toast } from "sonner";

interface AddToPlaylistButtonProps { videoId: string; }

export function AddToPlaylistButton({ videoId }: AddToPlaylistButtonProps) {
  const { user } = useAuth();
  const { data: playlists } = usePlaylists();
  const addToPlaylist = useAddToPlaylist();
  const { t } = useLanguage();

  if (!user) return null;

  const handleAdd = async (playlistId: string, playlistName: string) => {
    try { await addToPlaylist.mutateAsync({ playlistId, videoId }); toast.success(`${t("playlists.addedTo")}${playlistName}`); }
    catch { toast.error(t("playlists.alreadyIn")); }
  };

  if (!playlists || playlists.length === 0) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-accent"><ListPlus className="h-4 w-4" /></Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {playlists.map((playlist: any) => (
          <DropdownMenuItem key={playlist.id} onClick={() => handleAdd(playlist.id, playlist.name)} className="font-body cursor-pointer">{playlist.name}</DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

import { Link, Navigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { SEOHead } from "@/components/SEOHead";
import { VideoCard } from "@/components/VideoCard";
import { useAuth } from "@/hooks/useAuth";
import { useFavorites } from "@/hooks/useFavorites";
import { useWatchHistory } from "@/hooks/useWatchHistory";
import { useLanguage } from "@/contexts/LanguageContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Heart, Clock, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";

const MyLessons = () => {
  const { user, loading: authLoading } = useAuth();
  const { favorites, isLoading: favLoading } = useFavorites();
  const { data: history, isLoading: histLoading } = useWatchHistory();
  const { t, dir } = useLanguage();

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container px-4 py-8">
          <Skeleton className="h-8 w-48 mb-6" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="aspect-video w-full rounded-lg" />)}
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container px-4 py-16 text-center">
          <LogIn className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
          <h2 className="font-display text-2xl font-bold text-foreground mb-2" dir={dir}>{t("myLessons.loginPrompt")}</h2>
          <p className="text-muted-foreground font-body mb-6" dir={dir}>{t("myLessons.loginDesc")}</p>
          <Link to="/login"><Button>{t("myLessons.login")}</Button></Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SEOHead title={t("myLessons.title")} path="/my-lessons" />
      <Header />
      <div className="container px-4 py-8">
        <h1 className="font-display text-2xl font-bold text-foreground mb-6" dir={dir}>{t("myLessons.title")}</h1>
        <Tabs defaultValue="favorites" dir={dir}>
          <TabsList className="mb-6">
            <TabsTrigger value="favorites" className="font-body gap-1.5"><Heart className="h-4 w-4" />{t("myLessons.favorites")}</TabsTrigger>
            <TabsTrigger value="history" className="font-body gap-1.5"><Clock className="h-4 w-4" />{t("myLessons.history")}</TabsTrigger>
          </TabsList>
          <TabsContent value="favorites">
            {favLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="aspect-video w-full rounded-lg" />)}
              </div>
            ) : favorites.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                {favorites.map((fav: any) => <VideoCard key={fav.id} video={fav.videos} />)}
              </div>
            ) : (
              <div className="text-center py-16">
                <Heart className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
                <p className="text-muted-foreground font-body" dir={dir}>{t("myLessons.noFavorites")}</p>
              </div>
            )}
          </TabsContent>
          <TabsContent value="history">
            {histLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="aspect-video w-full rounded-lg" />)}
              </div>
            ) : history && history.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                {history.map((h: any) => <VideoCard key={h.id} video={h.videos} />)}
              </div>
            ) : (
              <div className="text-center py-16">
                <Clock className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
                <p className="text-muted-foreground font-body" dir={dir}>{t("myLessons.noHistory")}</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default MyLessons;

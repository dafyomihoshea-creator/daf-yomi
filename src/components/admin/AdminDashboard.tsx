import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Play, Library, FileText, Mail, TrendingUp } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export function AdminDashboard() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const [videosRes, articlesRes, subscribersRes, masechtotRes] = await Promise.all([
        supabase.from("videos").select("id", { count: "exact", head: true }),
        supabase.from("articles").select("id", { count: "exact", head: true }),
        supabase.from("email_subscribers").select("id", { count: "exact", head: true }),
        supabase.from("videos").select("masechet").not("masechet", "is", null),
      ]);

      const uniqueMasechtot = new Set(masechtotRes.data?.map(r => r.masechet)).size;

      // Recent videos (last 7 days)
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const recentRes = await supabase
        .from("videos")
        .select("id", { count: "exact", head: true })
        .gte("created_at", weekAgo.toISOString());

      return {
        totalVideos: videosRes.count || 0,
        totalArticles: articlesRes.count || 0,
        totalSubscribers: subscribersRes.count || 0,
        totalMasechtot: uniqueMasechtot,
        recentVideos: recentRes.count || 0,
      };
    },
  });

  if (isLoading) return <Skeleton className="h-40 w-full" />;

  const cards = [
    { icon: Play, label: "סה״כ שיעורים", value: stats?.totalVideos || 0, color: "text-blue-500" },
    { icon: Library, label: "מסכתות", value: stats?.totalMasechtot || 0, color: "text-accent" },
    { icon: FileText, label: "מאמרים", value: stats?.totalArticles || 0, color: "text-green-500" },
    { icon: Mail, label: "נרשמים", value: stats?.totalSubscribers || 0, color: "text-purple-500" },
    { icon: TrendingUp, label: "חדשים השבוע", value: stats?.recentVideos || 0, color: "text-orange-500" },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {cards.map((card) => (
        <Card key={card.label}>
          <CardContent className="p-4 text-center">
            <card.icon className={`h-6 w-6 mx-auto mb-2 ${card.color}`} />
            <p className="font-display text-2xl font-bold text-foreground">{card.value}</p>
            <p className="text-xs text-muted-foreground font-body" dir="rtl">{card.label}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Header } from "@/components/Header";
import { useIsAdmin } from "@/hooks/useAuth";
import { useArticles, useUploadArticle, useDeleteArticle, Article } from "@/hooks/useArticles";
import { supabase } from "@/integrations/supabase/client";
import { signInWithGoogle, signOutUser } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { LogIn, Upload, Trash2, FileText, Loader2, LayoutDashboard, Video, Settings, Mail, RefreshCw, BookOpen, Sparkles, Calendar, Pencil, Save, X, MessageCircle } from "lucide-react";
import { AdminDashboard } from "@/components/admin/AdminDashboard";
import { VideoManager } from "@/components/admin/VideoManager";
import { SiteSettings } from "@/components/admin/SiteSettings";
import { SubscribersList } from "@/components/admin/SubscribersList";
import { YouTubeSync } from "@/components/admin/YouTubeSync";
import { SummaryGenerator } from "@/components/admin/SummaryGenerator";
import { TranscriptFetcher } from "@/components/admin/TranscriptFetcher";
import { TagManager } from "@/components/admin/TagManager";
import { VideoDateManager } from "@/components/admin/VideoDateManager";
import { QuestionManager } from "@/components/admin/QuestionManager";

function AdminLogin() {
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setLoading(true);
    try {
      await signInWithGoogle();
    } catch (err: any) {
      if (err?.code !== "auth/popup-closed-by-user") {
        toast({ title: "שגיאה", description: err.message, variant: "destructive" });
      }
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="font-display text-xl" dir="rtl">כניסת מנהל</CardTitle>
        </CardHeader>
        <CardContent>
          <Button onClick={handleLogin} className="w-full font-body" disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4 ml-2" />}
            כניסה עם Google
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function ArticleUploadForm() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const uploadMutation = useUploadArticle();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    try {
      await uploadMutation.mutateAsync({ title, description, file });
      setTitle(""); setDescription(""); setFile(null);
      toast({ title: "המאמר הועלה בהצלחה" });
    } catch (err: any) {
      toast({ title: "שגיאה", description: err.message, variant: "destructive" });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display text-lg" dir="rtl">העלאת מאמר חדש</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label className="font-body" dir="rtl">כותרת</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} className="text-foreground" dir="rtl" required />
          </div>
          <div>
            <Label className="font-body" dir="rtl">תיאור</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} className="text-foreground" dir="rtl" />
          </div>
          <div>
            <Label className="font-body" dir="rtl">קובץ (PDF)</Label>
            <Input type="file" accept=".pdf,.doc,.docx" onChange={(e) => setFile(e.target.files?.[0] || null)} className="text-foreground" />
          </div>
          <Button type="submit" disabled={uploadMutation.isPending || !file} className="font-body">
            {uploadMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : <Upload className="h-4 w-4 ml-2" />}
            העלאה
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function ArticlesList() {
  const { data: articles, isLoading } = useArticles();
  const deleteMutation = useDeleteArticle();
  const queryClient = useQueryClient();
  const [editSummaryId, setEditSummaryId] = useState<string | null>(null);
  const [editSummaryValue, setEditSummaryValue] = useState("");
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [savingSummaryId, setSavingSummaryId] = useState<string | null>(null);

  const handleDelete = async (article: Article) => {
    try {
      await deleteMutation.mutateAsync(article);
      toast({ title: "המאמר נמחק" });
    } catch (err: any) {
      toast({ title: "שגיאה", description: err.message, variant: "destructive" });
    }
  };

  const handleGenerateSummary = async (articleId: string) => {
    setGeneratingId(articleId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const resp = await fetch("/api/generate-article-summary", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          ...(session?.access_token ? { "Authorization": `Bearer ${session.access_token}` } : {})
        },
        body: JSON.stringify({ article_id: articleId }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "Failed to generate");
      if (data?.error) throw new Error(data.error);
      toast({ title: "התקציר נוצר בהצלחה" });
      queryClient.invalidateQueries({ queryKey: ["articles"] });
    } catch (err: any) {
      toast({ title: "שגיאה ביצירת תקציר", description: err.message, variant: "destructive" });
    } finally {
      setGeneratingId(null);
    }
  };

  const handleSaveSummary = async (articleId: string) => {
    setSavingSummaryId(articleId);
    try {
      const { error } = await supabase
        .from("articles")
        .update({ summary: editSummaryValue })
        .eq("id", articleId);
      if (error) throw error;
      toast({ title: "התקציר נשמר" });
      setEditSummaryId(null);
      queryClient.invalidateQueries({ queryKey: ["articles"] });
    } catch (err: any) {
      toast({ title: "שגיאה", description: err.message, variant: "destructive" });
    } finally {
      setSavingSummaryId(null);
    }
  };

  if (isLoading) return <Skeleton className="h-32 w-full" />;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display text-lg" dir="rtl">מאמרים קיימים</CardTitle>
      </CardHeader>
      <CardContent>
        {!articles || articles.length === 0 ? (
          <p className="text-muted-foreground font-body text-sm" dir="rtl">אין מאמרים</p>
        ) : (
          <div className="space-y-4">
            {articles.map((article) => (
              <div key={article.id} className="p-3 rounded-lg border border-border space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3" dir="rtl">
                    <FileText className="h-5 w-5 text-accent shrink-0" />
                    <div>
                      <p className="font-body font-medium text-foreground text-sm">{article.title}</p>
                      <p className="text-xs text-muted-foreground font-body">
                        {new Date(article.created_at).toLocaleDateString("he-IL")}
                      </p>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(article)} disabled={deleteMutation.isPending}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>

                {/* Summary section */}
                <div className="pr-8 space-y-1" dir="rtl">
                  {editSummaryId === article.id ? (
                    <div className="space-y-2">
                      <Textarea
                        value={editSummaryValue}
                        onChange={(e) => setEditSummaryValue(e.target.value)}
                        className="text-foreground text-sm min-h-[80px]"
                        dir="rtl"
                        placeholder="כתוב תקציר למאמר..."
                      />
                      <div className="flex gap-2">
                        <Button size="sm" className="font-body" onClick={() => handleSaveSummary(article.id)} disabled={savingSummaryId === article.id}>
                          {savingSummaryId === article.id ? <Loader2 className="h-3 w-3 animate-spin ml-1" /> : <Save className="h-3 w-3 ml-1" />}
                          שמור
                        </Button>
                        <Button size="sm" variant="ghost" className="font-body" onClick={() => setEditSummaryId(null)}>
                          <X className="h-3 w-3 ml-1" />
                          ביטול
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-2">
                      {article.summary ? (
                        <p className="text-xs text-muted-foreground font-body flex-1 leading-relaxed">{article.summary}</p>
                      ) : (
                        <p className="text-xs text-muted-foreground/50 font-body italic flex-1">אין תקציר</p>
                      )}
                      <div className="flex gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 font-body text-xs"
                          onClick={() => {
                            setEditSummaryId(article.id);
                            setEditSummaryValue(article.summary || "");
                          }}
                        >
                          <Pencil className="h-3 w-3 ml-1" />
                          ערוך
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 font-body text-xs"
                          onClick={() => handleGenerateSummary(article.id)}
                          disabled={generatingId === article.id}
                        >
                          {generatingId === article.id ? <Loader2 className="h-3 w-3 animate-spin ml-1" /> : <Sparkles className="h-3 w-3 ml-1" />}
                          צור AI
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const Admin = () => {
  const { user, isAdmin, loading } = useIsAdmin();

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container px-4 py-8 flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (!user) return <AdminLogin />;

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container px-4 py-16 text-center">
          <h2 className="font-display text-2xl font-bold text-foreground mb-2" dir="rtl">אין הרשאה</h2>
          <p className="text-muted-foreground font-body" dir="rtl">אין לך הרשאת מנהל לדף זה</p>
          <Button variant="outline" className="mt-4 font-body" onClick={() => signOutUser()}>
            התנתק
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container px-4 py-6 max-w-5xl">
        <div className="flex items-center justify-between mb-6">
          <h1 className="font-display text-2xl font-bold text-foreground" dir="rtl">לוח בקרה</h1>
          <Button variant="ghost" size="sm" className="font-body" onClick={() => signOutUser()}>
            התנתק
          </Button>
        </div>

        {/* Dashboard Stats */}
        <div className="mb-6">
          <AdminDashboard />
        </div>

        {/* Tabs */}
        <Tabs defaultValue="videos" dir="rtl">
          <TabsList className="w-full grid grid-cols-9 mb-6">
            <TabsTrigger value="videos" className="font-body text-xs sm:text-sm gap-1">
              <Video className="h-4 w-4" />
              <span className="hidden sm:inline">שיעורים</span>
            </TabsTrigger>
            <TabsTrigger value="dates" className="font-body text-xs sm:text-sm gap-1">
              <Calendar className="h-4 w-4" />
              <span className="hidden sm:inline">תאריכים</span>
            </TabsTrigger>
            <TabsTrigger value="tags" className="font-body text-xs sm:text-sm gap-1">
              <BookOpen className="h-4 w-4" />
              <span className="hidden sm:inline">תגיות</span>
            </TabsTrigger>
            <TabsTrigger value="articles" className="font-body text-xs sm:text-sm gap-1">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">מאמרים</span>
            </TabsTrigger>
            <TabsTrigger value="sync" className="font-body text-xs sm:text-sm gap-1">
              <RefreshCw className="h-4 w-4" />
              <span className="hidden sm:inline">סנכרון</span>
            </TabsTrigger>
            <TabsTrigger value="subscribers" className="font-body text-xs sm:text-sm gap-1">
              <Mail className="h-4 w-4" />
              <span className="hidden sm:inline">נרשמים</span>
            </TabsTrigger>
            <TabsTrigger value="questions" className="font-body text-xs sm:text-sm gap-1">
              <MessageCircle className="h-4 w-4" />
              <span className="hidden sm:inline">שאלות</span>
            </TabsTrigger>
            <TabsTrigger value="settings" className="font-body text-xs sm:text-sm gap-1">
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">הגדרות</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="videos">
            <VideoManager />
          </TabsContent>

          <TabsContent value="dates">
            <VideoDateManager />
          </TabsContent>

          <TabsContent value="tags">
            <TagManager />
          </TabsContent>

          <TabsContent value="articles" className="space-y-6">
            <ArticleUploadForm />
            <ArticlesList />
          </TabsContent>

          <TabsContent value="sync" className="space-y-6">
            <YouTubeSync />
            <TranscriptFetcher />
            <SummaryGenerator />
          </TabsContent>

          <TabsContent value="subscribers">
            <SubscribersList />
          </TabsContent>

          <TabsContent value="questions">
            <QuestionManager />
          </TabsContent>

          <TabsContent value="settings">
            <SiteSettings />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Admin;

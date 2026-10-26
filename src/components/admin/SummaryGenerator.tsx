import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { FileText, CheckCircle, Loader2, Bot, AlertTriangle, Clock } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

interface JobStatus {
  isRunning: boolean;
  lastLog: {
    ran_at: string;
    status: string;
    total_processed: number;
    error_message: string | null;
  } | null;
}

export function SummaryGenerator() {
  const [generating, setGenerating] = useState(false);
  const [triggeringJob, setTriggeringJob] = useState(false);
  const [result, setResult] = useState<{ processed: number; skipped: number; total: number } | null>(null);
  const queryClient = useQueryClient();

  const { data: stats } = useQuery({
    queryKey: ["summary-stats"],
    queryFn: async () => {
      const { count: total } = await supabase
        .from("videos")
        .select("id", { count: "exact", head: true });
      const { count: withSummary } = await supabase
        .from("videos")
        .select("id", { count: "exact", head: true })
        .not("summary", "is", null);
      return { total: total || 0, withSummary: withSummary || 0 };
    },
    refetchInterval: 30000,
  });

  const { data: jobStatus, refetch: refetchJob } = useQuery<JobStatus>({
    queryKey: ["ai-job-status"],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const resp = await fetch("/api/ai-job-status", {
        headers: session?.access_token ? { "Authorization": `Bearer ${session.access_token}` } : {}
      });
      if (!resp.ok) throw new Error("Failed to fetch job status");
      return await resp.json();
    },
    refetchInterval: 30000,
  });

  const handleGenerate = async (limit: number) => {
    setGenerating(true);
    setResult(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const resp = await fetch("/api/generate-summaries", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          ...(session?.access_token ? { "Authorization": `Bearer ${session.access_token}` } : {})
        },
        body: JSON.stringify({ limit }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "Failed to generate");
      setResult(data);
      queryClient.invalidateQueries({ queryKey: ["summary-stats"] });
      queryClient.invalidateQueries({ queryKey: ["videos"] });
      toast({ title: `סוכמו ${data.processed} שיעורים בהצלחה` });
    } catch (err: any) {
      toast({ title: "שגיאה ביצירת סיכומים", description: err.message, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const handleStartAutoJob = async () => {
    setTriggeringJob(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const resp = await fetch("/api/start-auto-summaries", {
        method: "POST",
        headers: session?.access_token ? { "Authorization": `Bearer ${session.access_token}` } : {}
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "Failed to start job");
      toast({ title: "משימת הרקע הופעלה" });
      refetchJob();
    } catch (err: any) {
      toast({ title: "שגיאה", description: err.message, variant: "destructive" });
    } finally {
      setTriggeringJob(false);
    }
  };

  const missing = stats ? stats.total - stats.withSummary : 0;

  return (
    <div className="space-y-4">
      <Card className="border-accent/20 border-2">
        <CardHeader>
          <CardTitle className="font-display text-lg flex items-center gap-2" dir="rtl">
            <Bot className="h-5 w-5 text-accent" />
            מעקב עבודה אוטומטית (מכסות AI)
          </CardTitle>
          <CardDescription dir="rtl">המערכת מושכת תמלולים אוטומטית עד שמכסת ה-AI נגמרת להיום.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-2 p-3 bg-muted rounded-lg" dir="rtl">
            <div className="flex items-center gap-2">
              <span className="font-semibold font-body">מצב רקע נוכחי:</span>
              {jobStatus?.isRunning ? (
                <span className="text-accent flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin"/> בעבודה...</span>
              ) : (
                <span className="text-muted-foreground">ממתין / סיים</span>
              )}
            </div>
            
            {jobStatus?.lastLog && (
              <>
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4" />
                  <span>ריצה אחרונה: {new Date(jobStatus.lastLog.ran_at).toLocaleString("he-IL")}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span>שיעורים שסוכמו: {jobStatus.lastLog.total_processed}</span>
                </div>
                {jobStatus.lastLog.status === "AI_QUOTA_EXCEEDED" && (
                  <div className="flex items-center gap-2 text-sm text-destructive mt-1 bg-destructive/10 p-2 rounded">
                    <AlertTriangle className="h-4 w-4" />
                    <span>נעצר עקב חריגה ממכסת AI (ימשיך מחר).</span>
                  </div>
                )}
              </>
            )}
            {!jobStatus?.lastLog && !jobStatus?.isRunning && (
              <p className="text-sm text-muted-foreground">טרם רצה משימה.</p>
            )}
          </div>
          
          <Button 
            onClick={handleStartAutoJob} 
            disabled={triggeringJob || jobStatus?.isRunning || missing === 0} 
            className="w-full font-body"
          >
            {triggeringJob ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : <Bot className="h-4 w-4 ml-2" />}
            הפעל סוכן AI הרגע (ירוץ ברקע עד צימוק המכסה)
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-lg flex items-center gap-2" dir="rtl">
            <FileText className="h-5 w-5 text-accent" />
            סיכומי שיעורים (ידני)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {stats && (
            <div className="text-sm text-muted-foreground font-body" dir="rtl">
              <p>{stats.withSummary} מתוך {stats.total} שיעורים מסוכמים</p>
              {missing > 0 && (
                <p className="text-accent font-medium">{missing} שיעורים ממתינים לסיכום</p>
              )}
            </div>
          )}
          <div className="flex gap-2 flex-wrap">
            <Button onClick={() => handleGenerate(5)} disabled={generating || missing === 0} className="font-body" size="sm">
              {generating ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : <FileText className="h-4 w-4 ml-2" />}
              סכם 5 שיעורים
            </Button>
            <Button onClick={() => handleGenerate(10)} disabled={generating || missing === 0} variant="outline" className="font-body" size="sm">
              סכם 10 שיעורים
            </Button>
          </div>
          {result && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground font-body" dir="rtl">
              <CheckCircle className="h-4 w-4 text-green-500" />
              סוכמו {result.processed} שיעורים, דולגו {result.skipped}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

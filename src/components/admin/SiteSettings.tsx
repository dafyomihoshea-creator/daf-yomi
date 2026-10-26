import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import { Settings, Save, Loader2 } from "lucide-react";

export function SiteSettings() {
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: ["site-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("site_settings")
        .select("*");
      if (error) throw error;
      const map: Record<string, string> = {};
      data.forEach((s: any) => { map[s.key] = s.value; });
      return map;
    },
  });

  const [values, setValues] = useState<Record<string, string>>({});

  useEffect(() => {
    if (settings) setValues(settings);
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: async (entries: Record<string, string>) => {
      for (const [key, value] of Object.entries(entries)) {
        const { error } = await supabase
          .from("site_settings")
          .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: "key" });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["site-settings"] });
      toast({ title: "ההגדרות נשמרו בהצלחה" });
    },
    onError: (err: any) => {
      toast({ title: "שגיאה", description: err.message, variant: "destructive" });
    },
  });

  if (isLoading) return <Skeleton className="h-48 w-full" />;

  const fields = [
    { key: "hero_title", label: "כותרת ראשית (Hero)" },
    { key: "hero_subtitle", label: "תיאור משנה" },
    { key: "hero_badge", label: "תג עליון (Badge)" },
    { key: "footer_text", label: "טקסט פוטר" },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display text-lg flex items-center gap-2" dir="rtl">
          <Settings className="h-5 w-5 text-accent" />
          הגדרות אתר
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {fields.map((field) => (
          <div key={field.key}>
            <Label className="font-body text-sm" dir="rtl">{field.label}</Label>
            <Input
              value={values[field.key] || ""}
              onChange={(e) => setValues({ ...values, [field.key]: e.target.value })}
              className="text-foreground mt-1"
              dir="rtl"
            />
          </div>
        ))}
        <Button
          onClick={() => saveMutation.mutate(values)}
          disabled={saveMutation.isPending}
          className="font-body"
        >
          {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : <Save className="h-4 w-4 ml-2" />}
          שמור הגדרות
        </Button>
      </CardContent>
    </Card>
  );
}

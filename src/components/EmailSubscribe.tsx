import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Mail, Check, Rss } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";

export function EmailSubscribe() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const { t, dir } = useLanguage();
  const rssUrl = `/rss.xml`;

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) { toast({ title: t("subscribe.invalid"), variant: "destructive" }); return; }
    setLoading(true);
    try {
      const { error } = await supabase.from("email_subscribers").insert({ email: email.trim() });
      if (error) {
        if (error.code === "23505") toast({ title: t("subscribe.already") });
        else throw error;
      } else { setSubscribed(true); toast({ title: t("subscribe.success") }); }
    } catch { toast({ title: t("subscribe.error"), variant: "destructive" }); }
    finally { setLoading(false); }
  };

  return (
    <div className="bg-card border border-border rounded-xl p-6 max-w-md mx-auto text-center" dir={dir}>
      <Mail className="h-8 w-8 text-accent mx-auto mb-3" />
      <h3 className="font-display text-lg font-bold text-foreground mb-1">{t("subscribe.title")}</h3>
      <p className="text-sm text-muted-foreground font-body mb-4">{t("subscribe.desc")}</p>
      {subscribed ? (
        <div className="flex items-center justify-center gap-2 text-accent font-body"><Check className="h-5 w-5" /><span>{t("subscribe.success")}</span></div>
      ) : (
        <form onSubmit={handleSubscribe} className="flex gap-2">
          <Button type="submit" disabled={loading} className="shrink-0">{loading ? "..." : t("subscribe.button")}</Button>
          <Input type="email" placeholder={t("subscribe.placeholder")} value={email} onChange={(e) => setEmail(e.target.value)} className="font-body text-sm" dir="ltr" />
        </form>
      )}
      <div className="mt-4 pt-3 border-t border-border">
        <a href={rssUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-accent transition-colors font-body">
          <Rss className="h-3.5 w-3.5" />{t("subscribe.rss")}
        </a>
      </div>
    </div>
  );
}

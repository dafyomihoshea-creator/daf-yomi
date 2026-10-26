import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { SEOHead } from "@/components/SEOHead";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { Loader2, LogIn } from "lucide-react";

const Login = () => {
  const navigate = useNavigate();
  const { signIn } = useAuth();
  const { t, dir, lang } = useLanguage();
  const [loading, setLoading] = useState(false);

  const handleGoogle = async () => {
    setLoading(true);
    try {
      await signIn();
      toast({ title: t("login.success") });
      navigate(-1);
    } catch (err: any) {
      if (err?.code !== "auth/popup-closed-by-user") {
        toast({ title: t("login.error"), description: err.message, variant: "destructive" });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <SEOHead title={t("login.title")} path="/login" />
      <Header />
      <div className="container px-4 py-16 flex justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="font-display text-xl text-center" dir={dir}>
              {t("login.title")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4" dir={dir}>
            <p className="text-sm text-muted-foreground font-body text-center">
              {lang === "en"
                ? "Sign in with your Google account to save favorites, playlists, notes and your watch history."
                : "התחברו עם חשבון Google כדי לשמור מועדפים, רשימות השמעה, הערות והיסטוריית צפייה."}
            </p>
            <Button onClick={handleGoogle} className="w-full font-body gap-2" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
              {lang === "en" ? "Sign in with Google" : "התחברות עם Google"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Login;

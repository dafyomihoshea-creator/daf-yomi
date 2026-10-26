import { Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";

export function LanguageToggle() {
  const { lang, setLang } = useLanguage();

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => setLang(lang === "he" ? "en" : "he")}
      className="text-primary-foreground/80 hover:text-primary-foreground hover:bg-primary-foreground/10 font-body gap-1.5"
      title={lang === "he" ? "Switch to English" : "עברית"}
    >
      <Globe className="h-4 w-4" />
      <span className="text-xs">{lang === "he" ? "EN" : "עב"}</span>
    </Button>
  );
}

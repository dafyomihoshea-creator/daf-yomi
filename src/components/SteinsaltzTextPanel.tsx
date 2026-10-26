import { useState } from "react";
import { useSteinsaltzText } from "@/hooks/useSefariaText";
import { useLanguage } from "@/contexts/LanguageContext";
import { numberToHebrewDaf } from "@/lib/masechet-list";
import { BookOpen, ChevronRight, ChevronLeft, ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

interface SteinsaltzTextPanelProps { masechet: string; daf: number; }

export function SteinsaltzTextPanel({ masechet, daf }: SteinsaltzTextPanelProps) {
  const [currentDaf, setCurrentDaf] = useState(daf);
  const { data, isLoading } = useSteinsaltzText(masechet, currentDaf);
  const { t, lang, dir } = useLanguage();
  const hebrewDaf = numberToHebrewDaf(currentDaf);
  const sefariaLink = "https://www.sefaria.org.il/texts/Talmud/Bavli/Modern%20Commentary%20on%20Talmud/Steinsaltz";

  const [prevDaf, setPrevDaf] = useState(daf);
  if (daf !== prevDaf) { setPrevDaf(daf); setCurrentDaf(daf); }

  const dafLabel = lang === "en" ? `Page ${currentDaf}` : hebrewDaf;

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm lg:flex lg:flex-col lg:h-full" dir="rtl">
      <div className="flex items-center justify-between p-4 border-b border-border bg-accent/5 rounded-t-xl">
        <div className="flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-accent" />
          <h3 className="font-display font-bold text-foreground">{lang === "en" ? `Steinsaltz on ${masechet} ${hebrewDaf}` : `ביאור שטיינזלץ, ${masechet} ${hebrewDaf}`}</h3>
          {currentDaf !== daf && (
            <Button variant="ghost" size="sm" onClick={() => setCurrentDaf(daf)} className="text-xs text-accent font-body h-7 px-2">
              {t("talmud.backToLessonPage")} ({numberToHebrewDaf(daf)})
            </Button>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={() => setCurrentDaf((d) => Math.max(2, d - 1))} disabled={currentDaf <= 2} className="h-8 w-8" title={t("talmud.prevPage")}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="text-sm font-body text-muted-foreground min-w-[2rem] text-center">{dafLabel}</span>
          <Button variant="ghost" size="icon" onClick={() => setCurrentDaf((d) => d + 1)} className="h-8 w-8" title={t("talmud.nextPage")}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <a href={sefariaLink} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-accent transition-colors p-2" title={t("talmud.openSefaria")}>
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-accent" />
          <span className="mr-2 text-sm text-muted-foreground font-body">{t("talmud.loading")}</span>
        </div>
      ) : !data?.amudA && !data?.amudB ? (
        <div className="flex items-center justify-center py-16 text-center">
          <div><BookOpen className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" /><p className="text-sm text-muted-foreground font-body">{t("talmud.notFound")}</p></div>
        </div>
      ) : (
        <Tabs defaultValue="amud-a" className="w-full flex-1 flex flex-col min-h-0">
          <TabsList className="mx-4 mt-3 grid grid-cols-2 w-auto">
            <TabsTrigger value="amud-a" className="font-body" disabled={!data?.amudA}>{t("talmud.amudA")}</TabsTrigger>
            <TabsTrigger value="amud-b" className="font-body" disabled={!data?.amudB}>{t("talmud.amudB")}</TabsTrigger>
          </TabsList>
          <TabsContent value="amud-a" className="lg:flex-1 lg:min-h-0 mt-2">
            <div className="p-4 space-y-3 max-h-[500px] lg:max-h-none lg:h-full overflow-y-auto overscroll-contain">
              {data?.amudA?.he.map((segment, i) => (
                <p key={i} className="text-foreground font-body text-sm leading-[2] sefaria-text" dangerouslySetInnerHTML={{ __html: segment }} />
              ))}
            </div>
          </TabsContent>
          <TabsContent value="amud-b" className="lg:flex-1 lg:min-h-0 mt-2">
            <div className="p-4 space-y-3 max-h-[500px] lg:max-h-none lg:h-full overflow-y-auto overscroll-contain">
              {data?.amudB?.he.map((segment, i) => (
                <p key={i} className="text-foreground font-body text-sm leading-[2] sefaria-text" dangerouslySetInnerHTML={{ __html: segment }} />
              ))}
            </div>
          </TabsContent>
        </Tabs>
      )}

      <div className="p-3 border-t border-border text-center rounded-b-xl">
        <p className="text-[10px] text-muted-foreground font-body">
          {t("talmud.source")} <a href="https://www.sefaria.org.il" target="_blank" rel="noopener noreferrer" className="underline hover:text-accent">Sefaria</a> — ביאור שטיינזלץ
        </p>
      </div>
    </div>
  );
}

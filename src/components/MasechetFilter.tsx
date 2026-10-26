import { Link } from "react-router-dom";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import { getMasechetEnglish } from "@/lib/masechet-list";
import { BookOpen, ExternalLink } from "lucide-react";

interface MasechetFilterProps {
  masechtot: Record<string, number>;
  selected: string | null;
  onSelect: (masechet: string | null) => void;
}

export function MasechetFilter({ masechtot, selected, onSelect }: MasechetFilterProps) {
  const sorted = Object.entries(masechtot).sort((a, b) => a[0].localeCompare(b[0], 'he'));
  const { t, dir, lang } = useLanguage();
  const masechetLabel = (heb: string) => lang === "en" ? getMasechetEnglish(heb) : heb;

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <div className="p-4 border-b border-border">
        <h3 className="font-display text-sm font-bold text-foreground flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-accent" />{t("filter.masechtot")}
        </h3>
      </div>
      <ScrollArea className="h-[400px]">
        <div className="p-2">
          <button onClick={() => onSelect(null)} className={cn("w-full text-right px-3 py-2 rounded-md text-sm font-body transition-colors", !selected ? "bg-primary text-primary-foreground" : "hover:bg-muted text-foreground")} dir={dir}>
            {t("filter.all")}
          </button>
          {sorted.map(([masechet, count]) => (
            <div key={masechet} className="flex items-center gap-1">
              <button onClick={() => onSelect(masechet)} className={cn("flex-1 text-right px-3 py-2 rounded-md text-sm font-body transition-colors flex items-center justify-between", selected === masechet ? "bg-primary text-primary-foreground" : "hover:bg-muted text-foreground")} dir={dir}>
                <span>{masechetLabel(masechet)}</span>
                <span className={cn("text-xs", selected === masechet ? "text-primary-foreground/70" : "text-muted-foreground")}>{count}</span>
              </button>
              <Link to={`/masechet/${encodeURIComponent(masechet)}`} className="p-1.5 rounded-md text-muted-foreground hover:text-accent hover:bg-muted transition-colors" title={`${t("common.masechet")} ${masechet}`}>
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

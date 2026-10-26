import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import { numberToHebrewDaf } from "@/lib/masechet-list";
import { Hash } from "lucide-react";

interface DafFilterProps {
  dafim: number[];
  selected: number | null;
  onSelect: (daf: number | null) => void;
}

export function DafFilter({ dafim, selected, onSelect }: DafFilterProps) {
  const { t, dir, lang } = useLanguage();

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <div className="p-4 border-b border-border">
        <h3 className="font-display text-sm font-bold text-foreground flex items-center gap-2">
          <Hash className="h-4 w-4 text-accent" />{t("filter.dafim")}
        </h3>
      </div>
      <ScrollArea className="h-[200px]">
        <div className="p-2">
          <button onClick={() => onSelect(null)} className={cn("w-full text-right px-3 py-2 rounded-md text-sm font-body transition-colors", !selected ? "bg-accent text-accent-foreground" : "hover:bg-muted text-foreground")} dir={dir}>
            {t("filter.allPages")}
          </button>
          {dafim.map((daf) => (
            <button key={daf} onClick={() => onSelect(daf)} className={cn("w-full text-right px-3 py-2 rounded-md text-sm font-body transition-colors", selected === daf ? "bg-accent text-accent-foreground" : "hover:bg-muted text-foreground")} dir={dir}>
              {lang === "en" ? `Page ${daf}` : `דף ${numberToHebrewDaf(daf)}`}
            </button>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

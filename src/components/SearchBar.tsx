import { useState, useRef } from "react";
import { Search, Sparkles, Loader2, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onAiSearch?: (query: string) => void;
  isAiSearching?: boolean;
  placeholder?: string;
}

export function SearchBar({ value, onChange, onAiSearch, isAiSearching, placeholder }: SearchBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { t, dir } = useLanguage();

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && value.trim() && onAiSearch) onAiSearch(value.trim());
  };

  const handleClear = () => { onChange(""); inputRef.current?.focus(); };

  return (
    <div className="relative max-w-md w-full flex gap-2">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          ref={inputRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder || t("search.placeholder")}
          className="pl-10 pr-8 bg-card border-border font-body text-sm text-foreground"
          dir={dir}
        />
        {value && (
          <button onClick={handleClear} className="absolute left-8 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {onAiSearch && (
        <Button onClick={() => value.trim() && onAiSearch(value.trim())} disabled={!value.trim() || isAiSearching} size="sm" variant="outline" className="shrink-0 gap-1.5 font-body bg-accent/10 border-accent/30 text-accent-foreground hover:bg-accent/20">
          {isAiSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          <span className="hidden sm:inline">{t("search.smart")}</span>
        </Button>
      )}
    </div>
  );
}

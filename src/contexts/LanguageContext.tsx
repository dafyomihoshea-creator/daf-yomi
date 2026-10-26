import { createContext, useContext, useState, useCallback, ReactNode, useEffect } from "react";
import { translations, Language, TranslationKey } from "@/lib/translations";

interface LanguageContextType {
  lang: Language;
  setLang: (lang: Language) => void;
  t: (key: TranslationKey) => string;
  isRtl: boolean;
  dir: "rtl" | "ltr";
}

const LanguageContext = createContext<LanguageContextType | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>(() => {
    const saved = localStorage.getItem("site-language");
    return (saved === "en" ? "en" : "he") as Language;
  });

  const setLang = useCallback((newLang: Language) => {
    setLangState(newLang);
    localStorage.setItem("site-language", newLang);
  }, []);

  const t = useCallback((key: TranslationKey): string => {
    return translations[key]?.[lang] || key;
  }, [lang]);

  const isRtl = lang === "he";
  const dir = isRtl ? "rtl" : "ltr";

  // Update document direction
  useEffect(() => {
    document.documentElement.dir = dir;
    document.documentElement.lang = lang;
  }, [dir, lang]);

  return (
    <LanguageContext.Provider value={{ lang, setLang, t, isRtl, dir }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
  return ctx;
}

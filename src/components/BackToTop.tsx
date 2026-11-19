import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

/** Round "back to top" button (bottom right) that appears once the page is scrolled down.
 *  On phones the Gemara / Steinsaltz boxes scroll on their own, so a finger inside them
 *  can't always move the page itself back up. */
export function BackToTop() {
  const [show, setShow] = useState(false);
  const { lang } = useLanguage();
  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 600);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  if (!show) return null;
  const label = lang === "en" ? "Back to top" : "חזרה לראש העמוד";
  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label={label}
      title={label}
      className="fixed bottom-4 right-4 z-40 h-11 w-11 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center border border-border"
    >
      <ArrowUp className="h-5 w-5" />
    </button>
  );
}

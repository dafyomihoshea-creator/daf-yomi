import { useEffect } from "react";
import { SITE_ORIGIN, RABBI } from "@/lib/seo-text";

interface SEOHeadProps {
  title: string;
  description?: string;
  path?: string;
}

export function SEOHead({ title, description, path }: SEOHeadProps) {
  const fullTitle = title.includes("רבינוביץ") ? title : `${title} | ${RABBI}`;
  const desc = description || "שיעורי תורה וגמרא מפי הרב הושע רבינוביץ׳ — לימוד מסודר לפי מסכת ודף";
  // Always point search engines at the site's main address (never the old domain).
  const url = `${SITE_ORIGIN}${path || "/"}`;

  useEffect(() => {
    document.title = fullTitle;

    const setMeta = (attr: string, key: string, content: string) => {
      let el = document.querySelector(`meta[${attr}="${key}"]`);
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute(attr, key);
        document.head.appendChild(el);
      }
      el.setAttribute("content", content);
    };

    setMeta("name", "description", desc);
    setMeta("property", "og:title", fullTitle);
    setMeta("property", "og:description", desc);
    setMeta("property", "og:url", url);
    setMeta("name", "twitter:title", fullTitle);
    setMeta("name", "twitter:description", desc);

    let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.setAttribute("rel", "canonical");
      document.head.appendChild(canonical);
    }
    canonical.setAttribute("href", url);
  }, [fullTitle, desc, url]);

  return null;
}

// Search-engine metadata, written into each page's HTML by the nightly worker so Google sees the right title,
// description, canonical address and structured data for every page — without having to
// run the site's JavaScript.
import { catalog } from "./catalog";
import { config } from "./store";
import { numberToHebrewDaf } from "../src/lib/masechet-list";
import { SITE_NAME, RABBI, DEFAULT_TITLE, DEFAULT_DESC, PAGE_TEXT, lessonWhere, lessonTitle, lessonDescription, lessonPath, masechetTitle, masechetDescription, baseLessonId } from "../src/lib/seo-text";

/** The site's main address (the one that should appear in Google). */
export const SITE_URL = config.siteUrl;

const esc = (s: string) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const jsonLd = (o: any) => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, "\\u003c")}</script>`;

const organization = {
  "@type": "Organization",
  "@id": `${SITE_URL}/#organization`,
  name: SITE_NAME,
  alternateName: [`${SITE_NAME} – ${RABBI}`, "שיעורי הדף היומי של הרב הושע רבינוביץ"],
  url: `${SITE_URL}/`,
  logo: { "@type": "ImageObject", url: `${SITE_URL}/logo.png`, width: 512, height: 512 },
  founder: { "@id": `${SITE_URL}/#rabbi` },
};
const rabbi = {
  "@type": "Person",
  "@id": `${SITE_URL}/#rabbi`,
  name: RABBI,
  alternateName: ["הרב הושע רבינוביץ", "הושע רבינוביץ"],
  jobTitle: "מגיד שיעור דף יומי",
  url: `${SITE_URL}/`,
};
const website = {
  "@type": "WebSite",
  "@id": `${SITE_URL}/#website`,
  name: SITE_NAME,
  alternateName: ["דף יומי – הרב הושע רבינוביץ", "שיעורי הדף היומי"],
  url: `${SITE_URL}/`,
  inLanguage: "he",
  publisher: { "@id": `${SITE_URL}/#organization` },
};

interface PageMeta { title: string; description: string; path: string; image?: string; type?: string; ld: any[]; body: string }

async function metaFor(pathname: string): Promise<PageMeta> {
  const base: PageMeta = {
    title: DEFAULT_TITLE, description: DEFAULT_DESC, path: pathname, ld: [],
    body: `<h1>${esc(SITE_NAME)} – שיעורי הדף היומי מפי ${esc(RABBI)}</h1><p>${esc(DEFAULT_DESC)}</p>`,
  };

  if (pathname === "/") {
    base.ld = [website, organization, rabbi];
    const latest = (await catalog.getAll()).sort((a, b) => String(b.published_at || "").localeCompare(String(a.published_at || ""))).slice(0, 20);
    base.body += `<h2>שיעורים אחרונים</h2><ul>${latest.map(v => `<li><a href="/lesson/${encodeURIComponent(v.youtube_id)}">${esc(v.title)}</a></li>`).join("")}</ul>`;
    return base;
  }

  const lesson = pathname.match(/^\/lesson\/([^/]+)$/);
  if (lesson) {
    const v = await catalog.get(decodeURIComponent(lesson[1]));
    if (!v) return base;
    const where = lessonWhere(v);
    const title = lessonTitle(v);
    const description = lessonDescription(v);
    // A per-daf copy of a lesson points Google at the original lesson page.
    const mainPath = lessonPath(v.youtube_id);
    const videoId = String(v.youtube_id).substring(0, 11);
    const thumb = v.thumbnail_url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
    return {
      title, description, path: mainPath, image: thumb, type: "video.other",
      ld: [{
        "@type": "VideoObject",
        name: v.title,
        description,
        thumbnailUrl: [thumb],
        uploadDate: v.published_at || v.created_at,
        embedUrl: `https://www.youtube.com/embed/${videoId}`,
        url: `${SITE_URL}${mainPath}`,
        inLanguage: "he",
        author: { "@id": `${SITE_URL}/#rabbi` },
        publisher: { "@id": `${SITE_URL}/#organization` },
      }, {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: SITE_NAME, item: `${SITE_URL}/` },
          ...(v.masechet ? [{ "@type": "ListItem", position: 2, name: `מסכת ${v.masechet}`, item: `${SITE_URL}/masechet/${encodeURIComponent(v.masechet)}` }] : []),
          { "@type": "ListItem", position: v.masechet ? 3 : 2, name: where || v.title },
        ],
      }, organization, rabbi],
      body: `<h1>${esc(where || v.title)} – שיעור דף יומי</h1><p>${esc(v.title)}</p><p>${esc(description)}</p>`,
    };
  }

  const masechet = pathname.match(/^\/masechet\/([^/]+)$/);
  if (masechet) {
    const name = decodeURIComponent(masechet[1]);
    const list = (await catalog.getAll()).filter(v => v.masechet === name).sort((a, b) => (a.daf ?? 0) - (b.daf ?? 0));
    if (!list.length) return base;
    return {
      title: masechetTitle(name),
      description: masechetDescription(name, new Set(list.map(v => baseLessonId(v.youtube_id))).size),
      path: pathname,
      ld: [{
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: SITE_NAME, item: `${SITE_URL}/` },
          { "@type": "ListItem", position: 2, name: `מסכת ${name}` },
        ],
      }, organization],
      body: `<h1>מסכת ${esc(name)} – שיעורי דף יומי</h1><ul>${list.slice(0, 200).map(v => `<li><a href="/lesson/${encodeURIComponent(v.youtube_id)}">דף ${esc(numberToHebrewDaf(v.daf))} – ${esc(v.title)}</a></li>`).join("")}</ul>`,
    };
  }

  const pages = PAGE_TEXT;
  if (pages[pathname]) {
    base.title = pages[pathname][0];
    base.description = pages[pathname][1];
    base.ld = [organization];
  }
  return base;
}

/** Fill the page template (dist/index.html) with this page's metadata. */
export async function renderPage(template: string, pathname: string): Promise<string> {
  let m: PageMeta;
  try { m = await metaFor(pathname); } catch { m = { title: DEFAULT_TITLE, description: DEFAULT_DESC, path: pathname, ld: [], body: "" }; }
  const url = `${SITE_URL}${m.path === "/" ? "/" : m.path}`;
  const image = m.image || `${SITE_URL}/logo.png`;
  // app.html (the fallback for addresses without their own file) and 404.html have no address of their own.
  const generic = pathname === "/app" || pathname === "/404";
  const tags = [
    generic ? "" : `<link rel="canonical" href="${esc(url)}" />`,
    pathname === "/404" ? `<meta name="robots" content="noindex" />` : "",
    `<meta property="og:title" content="${esc(m.title)}" />`,
    `<meta property="og:description" content="${esc(m.description)}" />`,
    generic ? "" : `<meta property="og:url" content="${esc(url)}" />`,
    `<meta property="og:image" content="${esc(image)}" />`,
    `<meta property="og:type" content="${m.type || "website"}" />`,
    `<meta name="twitter:title" content="${esc(m.title)}" />`,
    `<meta name="twitter:description" content="${esc(m.description)}" />`,
    `<meta name="twitter:image" content="${esc(image)}" />`,
    m.ld.length ? jsonLd({ "@context": "https://schema.org", "@graph": m.ld }) : "",
  ].filter(Boolean).join("\n    ");
  return template
    .replace(/<title>[^<]*<\/title>/, `<title>${esc(m.title)}</title>`)
    .replace(/<meta name="description" content="[^"]*" \/>/, `<meta name="description" content="${esc(m.description)}" />`)
    .replace(/<meta property="og:type" content="website" \/>\s*/, "")
    .replace("<!--SEO-->", tags)
    .replace("<!--CONTENT-->", m.body);
}

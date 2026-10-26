import { useQuery } from "@tanstack/react-query";

// Map our English masechet names to Sefaria ref names
const SEFARIA_REF_MAP: Record<string, string> = {
  "Brachot": "Berakhot",
  "Shabbat": "Shabbat",
  "Eruvin": "Eruvin",
  "Pesachim": "Pesachim",
  "Shekalim": "Shekalim",
  "Yoma": "Yoma",
  "Sukkah": "Sukkah",
  "Beitzah": "Beitzah",
  "Rosh Hashanah": "Rosh_Hashanah",
  "Taanit": "Taanit",
  "Megillah": "Megillah",
  "Moed Katan": "Moed_Katan",
  "Chagigah": "Chagigah",
  "Yevamot": "Yevamot",
  "Ketubot": "Ketubot",
  "Nedarim": "Nedarim",
  "Nazir": "Nazir",
  "Sotah": "Sotah",
  "Gittin": "Gittin",
  "Kiddushin": "Kiddushin",
  "Bava Kamma": "Bava_Kamma",
  "Bava Metzia": "Bava_Metzia",
  "Bava Batra": "Bava_Batra",
  "Sanhedrin": "Sanhedrin",
  "Makkot": "Makkot",
  "Shevuot": "Shevuot",
  "Avodah Zarah": "Avodah_Zarah",
  "Horayot": "Horayot",
  "Zevachim": "Zevachim",
  "Menachot": "Menachot",
  "Chullin": "Chullin",
  "Bechorot": "Bekhorot",
  "Arachin": "Arakhin",
  "Temurah": "Temurah",
  "Keritot": "Keritot",
  "Meilah": "Meilah",
  "Tamid": "Tamid",
  "Niddah": "Niddah",
};

import { getMasechetEnglish } from "@/lib/masechet-list";

function getSefariaRef(masechetHebrew: string, daf: number, amud: "a" | "b"): string {
  const english = getMasechetEnglish(masechetHebrew);
  const sefariaName = SEFARIA_REF_MAP[english] || english.replace(/ /g, "_");
  return `${sefariaName}.${daf}${amud}`;
}

export function getSefariaLink(masechetHebrew: string, daf: number): string {
  const english = getMasechetEnglish(masechetHebrew);
  const sefariaName = SEFARIA_REF_MAP[english] || english.replace(/ /g, "_");
  return `https://www.sefaria.org.il/${sefariaName}.${daf}a?lang=he`;
}

interface SefariaText {
  he: string[];
  heRef: string;
}

async function fetchSefariaPage(masechetHebrew: string, daf: number, amud: "a" | "b"): Promise<SefariaText | null> {
  const ref = getSefariaRef(masechetHebrew, daf, amud);
  const url = `https://www.sefaria.org.il/api/v3/texts/${ref}?version=source`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    // v3 returns versions array; get Hebrew source text
    const heVersions = data.versions?.filter((v: any) => v.language === "he") || [];
    const heText = heVersions[0]?.text || [];
    return {
      he: Array.isArray(heText) ? heText : [heText],
      heRef: data.heRef || ref,
    };
  } catch {
    return null;
  }
}

async function fetchSteinsaltzPage(masechetHebrew: string, daf: number, amud: "a" | "b"): Promise<SefariaText | null> {
  const english = getMasechetEnglish(masechetHebrew);
  const sefariaName = SEFARIA_REF_MAP[english] || english.replace(/ /g, "_");
  const ref = `Steinsaltz_on_${sefariaName}.${daf}${amud}`;
  
  const url = `https://www.sefaria.org.il/api/v3/texts/${ref}?version=source`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    
    // v3 returns versions array; get Hebrew source text
    const heVersions = data.versions?.filter((v: any) => v.language === "he") || [];
    const heText = heVersions[0]?.text || [];
    
    return {
      he: Array.isArray(heText) ? heText : [heText],
      heRef: data.heRef || ref,
    };
  } catch {
    return null;
  }
}

export function useSefariaText(masechet: string | null, daf: number | null) {
  return useQuery({
    queryKey: ["sefaria", masechet, daf],
    queryFn: async () => {
      if (!masechet || !daf) return null;
      const [amudA, amudB] = await Promise.all([
        fetchSefariaPage(masechet, daf, "a"),
        fetchSefariaPage(masechet, daf, "b"),
      ]);
      return { amudA, amudB };
    },
    enabled: !!masechet && !!daf,
    staleTime: 1000 * 60 * 60,
  });
}

export function useSteinsaltzText(masechet: string | null, daf: number | null) {
  return useQuery({
    queryKey: ["steinsaltz", masechet, daf],
    queryFn: async () => {
      if (!masechet || !daf) return null;
      const [amudA, amudB] = await Promise.all([
        fetchSteinsaltzPage(masechet, daf, "a"),
        fetchSteinsaltzPage(masechet, daf, "b"),
      ]);
      return { amudA, amudB };
    },
    enabled: !!masechet && !!daf,
    staleTime: 1000 * 60 * 60,
  });
}

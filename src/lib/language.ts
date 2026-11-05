import type { LanguageAssessment, WorkLanguage } from "./domain";
export const languageLabels: Record<WorkLanguage, string> = {
  spanish_confirmed: "Español confirmado",
  spanish_likely: "Español probable",
  unknown: "Idioma laboral sin confirmar",
  english_required: "Inglés requerido",
};
export const adLanguageLabels = {
  es: "Español",
  en: "Inglés",
  pt: "Portugués",
  mixed: "Mixto",
  unknown: "Sin determinar",
};

export function detectAdLanguage(
  text: string,
): Pick<LanguageAssessment, "ad_language" | "ad_reason"> {
  const lower = text.toLowerCase();
  const count = (pattern: RegExp) => [...lower.matchAll(pattern)].length;
  const scores = [
    {
      language: "es" as const,
      score: count(
        /\b(el|los|las|del|para|equipo|experiencia|buscamos|desarrollo|requisitos|conocimientos|trabajar|nuestro|nuestra)\b/g,
      ),
    },
    {
      language: "en" as const,
      score: count(
        /\b(the|with|your|you|our|we|skills|experience|requirements|work|team|must|looking)\b/g,
      ),
    },
    {
      language: "pt" as const,
      score: count(
        /\b(você|voce|não|nao|equipe|experiência|conhecimento|trabalhar|estamos|nosso|nossa|requisitos|desenvolvimento)\b/g,
      ),
    },
  ].sort((a, b) => b.score - a.score);
  if (scores[0].score < 4)
    return {
      ad_language: "unknown",
      ad_reason: "Texto insuficiente para reconocer el idioma del anuncio.",
    };
  if (scores[1].score >= 4 && scores[0].score < scores[1].score * 1.5)
    return {
      ad_language: "mixed",
      ad_reason: "El anuncio contiene secciones en más de un idioma.",
    };
  return {
    ad_language: scores[0].language,
    ad_reason:
      "Idioma estimado a partir del texto del anuncio; no determina el idioma del equipo.",
  };
}

export function classifyLanguage(
  text: string,
  applicationLanguage?: string | null,
): LanguageAssessment {
  const segments = text
    .split(/\n|(?<=[.!?])\s+/)
    .map((t) => t.trim())
    .filter(Boolean);
  const spanish: string[] = [],
    likely: string[] = [],
    english: string[] = [];
  for (const segment of segments) {
    const s = segment.slice(0, 600);
    const englishMention = /\b(english|ingl[eé]s)\b/i.test(s);
    const spanishMention = /\b(spanish|espa[nñ]ol|castellano)\b/i.test(s);
    const optional =
      /\b(desirable|desired|nice.to.have|bonus|preferred|plus|deseable|opcional|valorable|no (?:es )?(?:obligatorio|excluyente)|not required)\b/i.test(
        s,
      );
    const documentationOnly =
      /(?:read|reading|leer|lectura|comprensi[oó]n|understand).{0,55}(?:documentaci[oó]n|documentation|technical texts)|(?:documentaci[oó]n|documentation).{0,35}(?:ingl[eé]s|english)/i.test(
        s,
      ) &&
      !/\b(speak|spoken|convers|meetings|reuniones|oral|verbal|daily|diari[oa]|clients|clientes)\b/i.test(
        s,
      );
    if (
      englishMention &&
      !optional &&
      !documentationOnly &&
      /\b(fluent|fluidez|fluido|avanzado|advanced|B2|C1|C2|conversacional|conversation|spoken|speaking|speakers|speaking|oral|verbal|daily|meetings|reuniones|communication|comunicaci[oó]n|client.facing)\b/i.test(
        s,
      )
    )
      english.push(s.slice(0, 300));
    if (
      spanishMention &&
      /\b(team|equipo|trabajo|working|work|comunicaci[oó]n|communication|meetings|reuniones|daily|diari[oa]|speak|hablar|hablante|oral|fluido|fluent|requerido|required|obligatorio)\b/i.test(
        s,
      )
    ) {
      (optional ? likely : spanish).push(s.slice(0, 300));
    }
  }
  const ad = detectAdLanguage(text);
  const base = { ...ad, method: "rules" as const };
  if (english.length && spanish.length)
    return {
      ...base,
      work_language: "unknown",
      confidence: "low",
      reason:
        "Se requieren ambos idiomas o hay señales contradictorias; confirmar la comunicación cotidiana.",
      evidence: [...spanish, ...english].slice(0, 4),
    };
  if (english.length)
    return {
      ...base,
      work_language: "english_required",
      confidence: "high",
      reason:
        "Se exige inglés oral, fluido o para comunicación laboral; confirmar su frecuencia.",
      evidence: english.slice(0, 3),
    };
  if (spanish.length)
    return {
      ...base,
      work_language: "spanish_confirmed",
      confidence: "high",
      reason: "El texto menciona español para trabajar o comunicarse.",
      evidence: spanish.slice(0, 3),
    };
  if (likely.length)
    return {
      ...base,
      work_language: "spanish_likely",
      confidence: "medium",
      reason:
        "Hay indicios explícitos de comunicación en español, sin exigencia confirmada.",
      evidence: likely.slice(0, 3),
    };
  if (applicationLanguage === "es")
    return {
      ...base,
      work_language: "spanish_likely",
      confidence: "low",
      reason:
        "La fuente pide postular en español; es un indicio, no confirma el idioma cotidiano del equipo.",
      evidence: ["Get on Board: lang=es (idioma de postulación)."],
    };
  return {
    ...base,
    work_language: "unknown",
    confidence: "low",
    reason:
      "No hay evidencia suficiente del idioma de comunicación cotidiana. El idioma del anuncio, del país y de la documentación no lo confirma.",
    evidence: [],
  };
}

export function mergeLanguageEvidence(
  fallback: LanguageAssessment,
  evidence: LanguageAssessment[],
): LanguageAssessment {
  const all = [fallback, ...evidence];
  const explicit = all.filter((l) =>
    ["spanish_confirmed", "english_required"].includes(l.work_language),
  );
  if (new Set(explicit.map((l) => l.work_language)).size > 1)
    return {
      ...fallback,
      work_language: "unknown",
      confidence: "low",
      reason:
        "Las fuentes aportan evidencia contradictoria de idioma; confirmar el uso cotidiano.",
      evidence: explicit.flatMap((l) => l.evidence).slice(0, 4),
    };
  return (
    explicit[0] ??
    all.find((l) => l.work_language === "spanish_likely") ??
    fallback
  );
}

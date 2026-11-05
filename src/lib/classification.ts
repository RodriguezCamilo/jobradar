import type { Eligibility, NormalizedJob, Profile } from "./domain";
import searches from "../../config/searches.json";
import { classifyLanguage } from "./language";

type Evidence = Pick<
  NormalizedJob,
  | "title"
  | "description"
  | "location"
  | "countries"
  | "timezone_restrictions"
  | "modality"
  | "source"
>;
const argentina = /\b(argentina|argentin[ae]|AR)\b/i;
const latinAmerica =
  /\b(latam|latin america|latin america[n]?|south america|am[eé]rica latina|sudam[eé]rica)\b/i;
const worldwide =
  /\b(worldwide|world wide|anywhere(?: in the world)?|global|all countries)\b/i;
const excludedCountry =
  /\b(united states|usa|u\.s\.|us only|canada|united kingdom|uk only|europe|european union|emea|apac|india|australia|germany|france|spain|poland|brazil|mexico|colombia|chile|portugal|netherlands|ireland|philippines|pakistan|south africa|new zealand|japan)\b/i;

export function classifyGeography(job: Evidence): {
  eligibility: Eligibility;
  eligibility_reason: string;
} {
  const result = (eligibility: Eligibility, eligibility_reason: string) => ({
    eligibility,
    eligibility_reason,
  });
  const text = job.description;
  const noArgentina =
    /(?:excluding|except|not (?:available|open) (?:in|to)|no se (?:aceptan|contrata)).{0,35}argentina/i.test(
      `${job.location}\n${text}`,
    );
  if (noArgentina)
    return result("descartar", "La oferta excluye explícitamente Argentina.");
  if (job.modality === "onsite") {
    return /\bla plata\b/i.test(job.location)
      ? result(
          "revisar",
          "Presencial en La Plata: evaluar si justifica apartarse de la preferencia remota.",
        )
      : result(
          "descartar",
          "Presencial habitual fuera de La Plata o sin sede local confirmada.",
        );
  }
  if (job.modality === "hybrid") {
    return /\b(caba|buenos aires|capital federal)\b/i.test(
      `${job.location}\n${text}`,
    ) &&
      /(?:[2-5]|two|three|four|five|dos|tres|cuatro|cinco)\s+(?:days|d[ií]as).{0,35}(?:week|semana)|(?:[2-5]|two|three|dos|tres).{0,15}(?:office days|d[ií]as en oficina)/i.test(
        text,
      )
      ? result(
          "descartar",
          "Híbrido en CABA con varios días presenciales semanales.",
        )
      : result(
          "revisar",
          "Modalidad híbrida: confirmar sede y frecuencia presencial.",
        );
  }
  const residence = text.match(
    /(?:must|required to|have to)\s+(?:be\s+)?(?:based|reside|located|live)\s+in\s+([^.;\n]{2,120})/i,
  )?.[1];
  const authorization =
    /(?:must|require[ds]?|mandatory).{0,70}(?:(?:us|u\.s\.|united states) (?:citizenship|citizen|work authori[sz]ation)|authori[sz]ed to work in (?:the )?(?:us|united states|canada|uk))/i.test(
      text,
    );
  if (
    authorization ||
    (residence &&
      excludedCountry.test(residence) &&
      !argentina.test(residence) &&
      !latinAmerica.test(residence) &&
      !worldwide.test(residence))
  ) {
    return result(
      "descartar",
      "La descripción exige residencia o autorización laboral incompatible con Argentina.",
    );
  }
  let geographic: ReturnType<typeof result>;
  if (job.countries !== null) {
    if (job.countries.length === 0)
      geographic = result(
        "aceptable",
        "Himalayas declara alcance mundial mediante locationRestrictions vacío.",
      );
    else if (job.countries.some((c) => argentina.test(c)))
      geographic = result(
        "aceptable",
        "Argentina figura explícitamente entre los países admitidos.",
      );
    else if (job.countries.some((c) => latinAmerica.test(c)))
      geographic = result(
        "revisar",
        "Región LATAM sin lista de países: confirmar que incluya Argentina.",
      );
    else
      return result(
        "descartar",
        `Los países admitidos excluyen Argentina: ${job.countries.join(", ")}.`,
      );
  } else if (argentina.test(job.location))
    geographic = result(
      "aceptable",
      "La ubicación admite explícitamente Argentina.",
    );
  else if (worldwide.test(job.location))
    geographic = result("aceptable", "La fuente declara contratación mundial.");
  else if (latinAmerica.test(job.location))
    geographic = result(
      "aceptable",
      "La fuente admite LATAM/Sudamérica sin exclusiones publicadas para Argentina.",
    );
  else if (excludedCountry.test(job.location))
    return result(
      "descartar",
      `Ubicación restringida: ${job.location}. Argentina no está incluida.`,
    );
  else
    geographic = result(
      "revisar",
      "Remoto sin evidencia geográfica suficiente para confirmar Argentina.",
    );

  if (
    job.timezone_restrictions.length &&
    !job.timezone_restrictions.some(
      (t) => Number(String(t).replace(/UTC|GMT/gi, "")) === searches.utcOffset,
    )
  ) {
    return result(
      "revisar",
      "La restricción horaria no incluye UTC-3; confirmar si se exige residencia u horas de coincidencia.",
    );
  }
  if (
    /(?:must|required|mandatory).{0,70}(?:overlap|business hours|working hours|time ?zone|horario)|(?:work|available).{0,35}(?:PST|EST|CET|pacific time|eastern time)\b|(?:working hours|work hours|horario)\s*:\s*[^\n]{0,40}(?:U\.S\.|\bUS\b|PST|EST|CET|Europe)/i.test(
      text,
    )
  ) {
    return result(
      "revisar",
      "Existen condiciones horarias que requieren confirmar compatibilidad desde UTC-3.",
    );
  }
  return geographic;
}

const technologyPatterns: [string, RegExp][] = [
  ["TypeScript", /\btypescript\b/i],
  ["JavaScript", /\bjavascript\b/i],
  ["React", /\breact(?:\.js)?\b/i],
  ["Next.js", /\bnext\.?js\b/i],
  ["Astro", /\bastro\b/i],
  ["Node.js", /\bnode\.?js\b/i],
  ["Supabase", /\bsupabase\b/i],
  ["PostgreSQL", /\bpostgre(?:sql|s)\b/i],
  ["MongoDB", /\bmongodb\b/i],
  ["Tailwind", /\btailwind\b/i],
  ["Unity", /\bunity(?!\s+catalog)\b/i],
  ["C#", /\bc#|\bcsharp\b/i],
  ["Godot", /\bgodot\b/i],
  ["Unreal", /\bunreal\b/i],
];

/** Replace/extend this evaluator later; geography remains a separate decision. */
export function classifyTechnical(title: string, description: string) {
  const all = `${title}\n${description}`;
  const technologies = technologyPatterns
    .filter(([, pattern]) => pattern.test(all))
    .map(([name]) => name);
  const gameTitle =
    /\b(unity|gameplay|multiplayer|game (?:developer|programmer|engineer)|game (?:tools|engine)|technical game designer|godot|unreal developer)\b/i.test(
      title,
    );
  const engineContext =
    /(?:experience|experiencia|using|conocimiento|proficien|develop|desarroll|game architecture|interactive|gameplay)[^.\n]{0,100}\b(?:unity(?!\s+catalog)|godot)\b|\bunity\s*\(c#\)/i.test(
      description,
    );
  const game =
    gameTitle ||
    (/\b(developer|engineer|programmer|desarrollador)\b/i.test(title) &&
      engineContext);
  const webTitle =
    /\b(full[ -]?stack|front[ -]?end|back[ -]?end|react|next\.?js|node\.?js|typescript|web developer|product engineer)\b/i.test(
      title,
    );
  const softwareTitle =
    /\b(software (?:engineer|developer)|ingeniero de software)\b/i.test(title);
  const webStack = technologies.some((t) =>
    [
      "React",
      "Next.js",
      "Node.js",
      "TypeScript",
      "JavaScript",
      "Astro",
    ].includes(t),
  );
  const web = webTitle || (softwareTitle && (!game || webStack));
  const profiles: Profile[] = [
    ...(web ? ["web" as const] : []),
    ...(game ? ["game_dev" as const] : []),
  ];
  const technical_reasons: string[] = [];
  if (
    /\b(senior|sr\.?|staff|principal|lead|director|head of|architect)\b/i.test(
      title,
    )
  )
    technical_reasons.push(
      "Seniority elevado: revisar responsabilidades concretas.",
    );
  if (/\breact native\b/i.test(title))
    technical_reasons.push(
      "Enfoque móvil con React Native: confirmar experiencia requerida fuera del perfil web.",
    );
  if (/\b(?:[5-9]|1\d)\+?\s*(?:years|años)\b/i.test(description))
    technical_reasons.push(
      "Se mencionan cinco o más años: revisar si son obligatorios.",
    );
  if (game && /\bunreal\b/i.test(all) && /c\+\+|\bAAA\b/.test(all))
    technical_reasons.push(
      "Unreal C++/AAA: especialidad secundaria, requiere revisión.",
    );
  if (web && !webStack)
    technical_reasons.push(
      "El título es afín, pero falta evidencia del stack principal.",
    );
  if (
    /\b(volunteer|unpaid|unremunerated|ad honorem|no remunerad[oa])\b/i.test(
      all,
    )
  )
    technical_reasons.push(
      "Posible oportunidad sin remuneración: confirmar antes de postular.",
    );
  if (game && !technologies.includes("Unity"))
    technical_reasons.push(
      "Game Dev sin Unity confirmado: revisar requisitos del motor.",
    );
  if (game && !gameTitle)
    technical_reasons.push(
      "El título no es específico de videojuegos: confirmar que el uso del motor sea parte central del puesto.",
    );
  return {
    profiles,
    technologies,
    technical_fit: technical_reasons.length
      ? ("revisar" as const)
      : ("compatible" as const),
    technical_reasons,
  };
}

export function classifyJob(job: NormalizedJob): NormalizedJob {
  return {
    ...job,
    ...classifyTechnical(job.title, job.description),
    ...classifyGeography(job),
    language: classifyLanguage(job.description, job.application_language),
  };
}

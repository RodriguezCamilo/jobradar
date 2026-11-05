import candidate from "../../config/candidate.json";
import type { IntelligentAssessment } from "./domain";
const normalize = (value: string) =>
  value
    .toLowerCase()
    .replace(/\b(avanzado|avanzada|advanced)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
const known = new Set(
  [...candidate.web.skills, ...candidate.game_dev.skills].map(normalize),
);
/** A model must not invent a gap in skills explicitly declared in the profile. */
export function reconcileAssessment(
  result: IntelligentAssessment,
): IntelligentAssessment {
  return {
    ...result,
    missing_technologies: result.missing_technologies.filter((value) => {
      const parts = normalize(value)
        .split(/\s*(?:\/|,|\+|&|\by\b|\band\b)\s*/)
        .filter(Boolean);
      return !parts.length || !parts.every((part) => known.has(part));
    }),
  };
}

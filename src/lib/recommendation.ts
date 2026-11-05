import type { Job, LanguageAssessment } from "./domain";
import { mergeLanguageEvidence } from "./language";
export function effectiveLanguage(job: Job): LanguageAssessment {
  const result =
    job.analysis?.current && job.analysis.status === "success"
      ? job.analysis.result
      : null;
  if (!result) return job.language;
  const groq = {
    ...job.language,
    work_language: result.work_language,
    confidence: result.confidence,
    evidence: result.language_evidence,
    reason: result.language_reason,
    method: "groq" as const,
  };
  const merged = mergeLanguageEvidence(groq, [job.language]);
  return merged.work_language === groq.work_language ? groq : merged;
}
export function recommendation(job: Job) {
  const analyzed =
    job.analysis?.current && job.analysis.status === "success"
      ? job.analysis.result
      : null;
  if (job.eligibility === "descartar")
    return {
      label: "Baja afinidad",
      reason: job.eligibility_reason,
      method: "Reglas",
    };
  if (analyzed)
    return {
      label:
        analyzed.recommendation === "priorizar"
          ? "Priorizar"
          : analyzed.recommendation === "revisar"
            ? "Revisar"
            : "Baja afinidad",
      reason: analyzed.explanation,
      method: "Groq",
    };
  const language = effectiveLanguage(job);
  const review =
    job.eligibility === "revisar" ||
    job.technical_fit === "revisar" ||
    ["unknown", "english_required"].includes(language.work_language);
  return {
    label: review ? "Revisar" : "Priorizar",
    reason:
      language.work_language === "english_required"
        ? language.reason
        : job.technical_reasons[0] ||
          (job.eligibility === "revisar"
            ? job.eligibility_reason
            : language.reason),
    method: "Reglas",
  };
}

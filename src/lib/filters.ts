import type { Job, Profile } from "./domain";
import { effectiveLanguage } from "./recommendation";
export interface Filters {
  profile: Profile;
  search: string;
  source: string;
  eligibility: string;
  days: string;
  tracking: string;
  sort: string;
  validity: string;
  language?: "prefer_spanish" | "spanish_only" | "all";
  feedback?: string;
  adLanguages?: string[];
  includeEnglishRequired?: boolean;
}
export function filterJobs(
  jobs: Job[],
  filters: Filters,
  now = Date.now(),
): Job[] {
  return jobs
    .filter((job) => {
      if (!job.profiles.includes(filters.profile)) return false;
      const adGroup = ["es", "en"].includes(job.language.ad_language)
        ? job.language.ad_language
        : "other";
      if (filters.adLanguages && !filters.adLanguages.includes(adGroup))
        return false;
      if (
        filters.includeEnglishRequired === false &&
        effectiveLanguage(job).work_language === "english_required"
      )
        return false;
      if (
        filters.language === "spanish_only" &&
        effectiveLanguage(job).work_language !== "spanish_confirmed"
      )
        return false;
      if (
        filters.feedback &&
        filters.feedback !== "all" &&
        job.feedback.rating !== filters.feedback
      )
        return false;
      if (
        filters.search &&
        !`${job.title} ${job.company}`
          .toLocaleLowerCase()
          .includes(filters.search.trim().toLocaleLowerCase())
      )
        return false;
      if (
        filters.source !== "all" &&
        !job.sources.some((s) => s.source === filters.source)
      )
        return false;
      if (
        filters.eligibility === "potential" &&
        job.eligibility === "descartar"
      )
        return false;
      if (
        !["all", "potential"].includes(filters.eligibility) &&
        job.eligibility !== filters.eligibility
      )
        return false;
      if (filters.tracking === "unseen" && job.tracking.seen_at) return false;
      if (
        !["all", "unseen"].includes(filters.tracking) &&
        job.tracking.status !== filters.tracking
      )
        return false;
      if (
        filters.days !== "all" &&
        (!job.published_at ||
          new Date(job.published_at).getTime() <
            now - Number(filters.days) * 86400000)
      )
        return false;
      if (
        filters.validity === "open" &&
        !["active", "unverified"].includes(job.validity)
      )
        return false;
      if (
        !["all", "open"].includes(filters.validity) &&
        job.validity !== filters.validity
      )
        return false;
      return true;
    })
    .sort((a, b) => {
      if (filters.sort === "fit" || filters.sort === "recommended") {
        const geo = { aceptable: 0, revisar: 1, descartar: 2 };
        const lang = {
          spanish_confirmed: 0,
          spanish_likely: 1,
          unknown: 2,
          english_required: 3,
        };
        const professional = (job: Job) => {
          const result =
            job.analysis?.current && job.analysis.status === "success"
              ? job.analysis.result
              : null;
          return result
            ? { priorizar: 0, revisar: 1, baja_afinidad: 2 }[
                result.recommendation
              ]
            : job.technical_fit === "compatible"
              ? 0
              : 1;
        };
        const validity = { active: 0, unverified: 1, closed: 2, expired: 3 };
        const delta =
          geo[a.eligibility] - geo[b.eligibility] ||
          (filters.language === "all"
            ? 0
            : lang[effectiveLanguage(a).work_language] -
              lang[effectiveLanguage(b).work_language]) ||
          professional(a) - professional(b) ||
          validity[a.validity] - validity[b.validity];
        if (delta) return delta;
        if (
          filters.language !== "all" &&
          effectiveLanguage(a).work_language === "unknown" &&
          effectiveLanguage(b).work_language === "unknown"
        ) {
          const adDelta =
            Number(b.language.ad_language === "es") -
            Number(a.language.ad_language === "es");
          if (adDelta) return adDelta;
        }
        const publishedDelta =
          (b.published_at ? Date.parse(b.published_at) : 0) -
          (a.published_at ? Date.parse(a.published_at) : 0);
        if (publishedDelta) return publishedDelta;
        const feedback = { me_interesa: 0, sin_evaluar: 1, no_encaja: 2 };
        if (feedback[a.feedback.rating] !== feedback[b.feedback.rating])
          return feedback[a.feedback.rating] - feedback[b.feedback.rating];
      }
      const date = (job: Job) =>
        filters.sort === "published"
          ? job.published_at
          : job.first_discovered_at;
      return (
        (date(b) ? new Date(date(b)!).getTime() : 0) -
          (date(a) ? new Date(date(a)!).getTime() : 0) ||
        a.id.localeCompare(b.id)
      );
    });
}

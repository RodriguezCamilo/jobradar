import { z } from "zod";
import config from "../../../config/searches.json";
import type { NormalizedJob } from "../domain";
import { classifyJob } from "../classification";
import { plainText, unixDate } from "../text";
import { ApiError, fetchJson, pause } from "./http";
import type { ConnectorResult, JobConnector } from "./types";

const httpUrl = z.url().refine((v) => /^https?:\/\//.test(v));
const country = z.union([
  z.string(),
  z
    .object({ name: z.string(), alpha2: z.string().optional() })
    .transform((v) => (v.alpha2 === "AR" ? "Argentina" : v.name)),
]);
export const himalayasJobSchema = z.object({
  guid: httpUrl,
  title: z.string().min(1),
  companyName: z.string().min(1),
  description: z.string(),
  applicationLink: httpUrl,
  employmentType: z.string().nullish(),
  minSalary: z.number().nullish(),
  maxSalary: z.number().nullish(),
  salaryPeriod: z.string().nullish(),
  currency: z.string().nullish(),
  locationRestrictions: z.array(country).optional(),
  timezoneRestrictions: z.array(z.union([z.number(), z.string()])).nullish(),
  pubDate: z.number().nullish(),
  expiryDate: z.number().nullish(),
});
export function normalizeHimalayas(raw: unknown): NormalizedJob {
  const j = himalayasJobSchema.parse(raw);
  const countries = j.locationRestrictions ?? null;
  const description = plainText(j.description);
  return classifyJob({
    source: "himalayas",
    external_id: j.guid,
    company: plainText(j.companyName),
    title: plainText(j.title),
    description,
    original_url: j.guid,
    application_url: j.applicationLink,
    published_at: unixDate(j.pubDate),
    publication_note:
      "Himalayas: pubDate representa la última actualización, no necesariamente la publicación inicial.",
    expires_at: unixDate(j.expiryDate),
    employment_type: j.employmentType || null,
    modality: detectModality(description),
    location:
      countries === null
        ? "Remoto; países no informados"
        : countries.length
          ? countries.join(", ")
          : "Worldwide",
    countries,
    timezone_restrictions: j.timezoneRestrictions ?? [],
    salary: {
      min: j.minSalary ?? null,
      max: j.maxSalary ?? null,
      currency: j.currency || null,
      period: j.salaryPeriod || null,
      text: null,
    },
    profiles: [],
    eligibility: "revisar",
    eligibility_reason: "",
    technical_fit: "revisar",
    technical_reasons: [],
    technologies: [],
    validity:
      j.expiryDate && j.expiryDate * 1000 < Date.now() ? "expired" : "active",
  });
}
export function detectModality(description: string): NormalizedJob["modality"] {
  if (
    /\b(?:hybrid (?:role|position|work|schedule)|(?:role|position|work mode|location)\s*:?\s*hybrid)\b/i.test(
      description,
    )
  )
    return "hybrid";
  if (
    /\b(?:on[ -]site (?:role|position|required)|(?:role|position|work mode)\s*:?\s*on[ -]site)\b/i.test(
      description,
    )
  )
    return "onsite";
  return "remote";
}
const envelope = z.object({
  jobs: z.array(z.unknown()),
  totalCount: z.number().optional(),
});
export const himalayas: JobConnector = {
  source: "himalayas",
  async fetchJobs(): Promise<ConnectorResult> {
    const jobs = new Map<string, NormalizedJob>();
    const errors: string[] = [],
      warnings: string[] = [];
    let received = 0,
      complete = true,
      stopped = false;
    let retryAt: string | undefined;
    const terms = [
      ...new Set([...config.profiles.web, ...config.profiles.game_dev]),
    ];
    for (const q of terms) {
      if (stopped) break;
      // AR includes worldwide matches. Global pass also retains LATAM and ambiguous listings.
      for (const scope of [config.country, ""]) {
        if (stopped) break;
        for (let page = 1; page <= config.himalayas.maxPagesPerQuery; page++) {
          const url = new URL("https://himalayas.app/jobs/api/search");
          url.searchParams.set("q", q);
          url.searchParams.set("sort", "recent");
          url.searchParams.set("page", String(page));
          if (scope) url.searchParams.set("country", scope);
          try {
            const headers: Record<string, string> = process.env
              .HIMALAYAS_API_KEY
              ? { Authorization: `Bearer ${process.env.HIMALAYAS_API_KEY}` }
              : {};
            const data = envelope.parse(
              await fetchJson(url.toString(), { headers }),
            );
            received += data.jobs.length;
            if (!data.jobs.length) break;
            for (const raw of data.jobs) {
              try {
                const job = normalizeHimalayas(raw);
                jobs.set(job.external_id, job);
              } catch {
                errors.push(
                  `Registro inválido omitido en búsqueda ${q}, página ${page}.`,
                );
                complete = false;
              }
            }
            if (page === config.himalayas.maxPagesPerQuery) {
              complete = false;
              warnings.push(
                `Búsqueda ${q} (${scope || "global"}) limitada a ${page} páginas; no se presume un inventario completo.`,
              );
            }
          } catch (error) {
            if (error instanceof ApiError && error.retryAt)
              retryAt = error.retryAt;
            errors.push(
              error instanceof Error ? error.message : "Error de Himalayas.",
            );
            complete = false;
            // Do not hammer the service after failure/429; cooldown is recorded by the synchronizer.
            stopped = true;
            break;
          }
          await pause(config.himalayas.requestIntervalMs);
        }
      }
    }
    return {
      jobs: [...jobs.values()],
      received,
      errors,
      warnings,
      complete,
      retryAt,
    };
  },
};

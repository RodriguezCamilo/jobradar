import { z } from "zod";
import type { NormalizedJob } from "../domain";
import { classifyJob } from "../classification";
import { plainText } from "../text";
import { fetchJson } from "./http";
import { detectModality } from "./himalayas";
import type { JobConnector } from "./types";
export const remotiveJobSchema = z.object({
  id: z.number().int(),
  url: z.url().refine((v) => v.startsWith("https://remotive.com/")),
  title: z.string().min(1),
  company_name: z.string().min(1),
  description: z.string(),
  job_type: z.string().nullish(),
  publication_date: z.string().nullish(),
  candidate_required_location: z.string().nullish(),
  salary: z.string().nullish(),
});
export function normalizeRemotive(raw: unknown): NormalizedJob {
  const j = remotiveJobSchema.parse(raw);
  // Remotive returns a timezone-less timestamp. Keep its calendar date rather than invent a precise zone.
  const published =
    j.publication_date?.match(/^\d{4}-\d{2}-\d{2}/)?.[0] ?? null;
  const description = plainText(j.description);
  return classifyJob({
    source: "remotive",
    external_id: String(j.id),
    company: plainText(j.company_name),
    title: plainText(j.title),
    description,
    original_url: j.url,
    application_url: j.url,
    published_at: published ? `${published}T12:00:00.000Z` : null,
    publication_note:
      "Remotive no informa zona horaria; se conserva solo el día y se usa mediodía UTC para ordenar. Feed demorado 24 horas.",
    expires_at: null,
    employment_type: j.job_type || null,
    modality: detectModality(description),
    location:
      j.candidate_required_location?.trim() || "Remoto; ubicación no informada",
    countries: null,
    timezone_restrictions: [],
    salary: {
      min: null,
      max: null,
      currency: null,
      period: null,
      text: j.salary?.trim() || null,
    },
    profiles: [],
    eligibility: "revisar",
    eligibility_reason: "",
    technical_fit: "revisar",
    technical_reasons: [],
    technologies: [],
    validity: "active",
  });
}
export const remotive: JobConnector = {
  source: "remotive",
  async fetchJobs() {
    // One complete public feed per sync; no pagination is documented and no paid inventory is assumed.
    const data = z
      .object({ jobs: z.array(z.unknown()) })
      .parse(await fetchJson("https://remotive.com/api/remote-jobs"));
    const jobs: NormalizedJob[] = [],
      errors: string[] = [];
    for (const raw of data.jobs) {
      try {
        jobs.push(normalizeRemotive(raw));
      } catch {
        errors.push("Registro inválido de Remotive omitido.");
      }
    }
    return {
      jobs,
      received: data.jobs.length,
      errors,
      warnings: [
        "El feed público tiene un retraso de 24 horas y puede contener pocas ofertas.",
      ],
      complete: errors.length === 0,
    };
  },
};

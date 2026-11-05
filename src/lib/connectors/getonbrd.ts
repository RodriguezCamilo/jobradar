import { z } from "zod";
import config from "../../../config/searches.json";
import { classifyJob } from "../classification";
import type { NormalizedJob } from "../domain";
import { plainText, unixDate } from "../text";
import { ApiError, fetchJson, pause } from "./http";
import type { ConnectorResult, JobConnector } from "./types";

const sourceUrl = z.url().refine((v) => {
  const u = new URL(v);
  return (
    u.protocol === "https:" &&
    ["www.getonbrd.com", "getonbrd.com"].includes(u.hostname)
  );
});
export const getonbrdJobSchema = z.object({
  id: z.string().min(1),
  links: z.object({ public_url: sourceUrl }),
  attributes: z.object({
    title: z.string().min(1),
    description: z.string(),
    projects: z.string().nullish(),
    functions: z.string().nullish(),
    desirable: z.string().nullish(),
    benefits: z.string().nullish(),
    remote: z.boolean(),
    remote_modality: z.string(),
    remote_zone: z.string().nullish(),
    countries: z.array(z.string()),
    lang: z.string().nullish(),
    min_salary: z.number().nullish(),
    max_salary: z.number().nullish(),
    published_at: z.number().nullish(),
    company: z.object({
      data: z.object({ attributes: z.object({ name: z.string().min(1) }) }),
    }),
    modality: z
      .object({
        data: z.object({
          attributes: z.object({ name: z.string() }).optional(),
        }),
      })
      .optional(),
  }),
});
export function normalizeGetonbrd(raw: unknown): NormalizedJob {
  const j = getonbrdJobSchema.parse(raw),
    a = j.attributes;
  const description = [
    a.projects,
    a.functions,
    a.description,
    a.desirable ? `Deseables:\n${a.desirable}` : "",
    a.benefits,
  ]
    .filter(Boolean)
    .map((t) => plainText(t!))
    .join("\n\n");
  const countries = a.countries.filter((c) => !/\b(remote|remoto)\b/i.test(c));
  const titleScope = a.title.match(
    /\b(?:LATAM|Latin America|Argentina|Worldwide)\b/i,
  )?.[0];
  const location =
    [
      ...a.countries,
      a.remote_zone?.replaceAll("_", " "),
      !countries.length ? titleScope : null,
    ]
      .filter(Boolean)
      .join(" · ") || "Remoto sin países informados";
  const hybrid =
    /hybrid|partial|h[ií]brid/i.test(a.remote_modality) ||
    /(?:modalidad|trabajo)\s*:?\s*h[ií]brid[oa]/i.test(description);
  return classifyJob({
    source: "getonbrd",
    external_id: j.id,
    title: plainText(a.title),
    company: plainText(a.company.data.attributes.name),
    description,
    original_url: j.links.public_url,
    application_url: j.links.public_url,
    published_at: unixDate(a.published_at),
    publication_note: "Fecha de publicación informada por Get on Board.",
    expires_at: null,
    employment_type: a.modality?.data.attributes?.name ?? null,
    modality: hybrid
      ? "hybrid"
      : a.remote && a.remote_modality !== "no_remote"
        ? "remote"
        : "onsite",
    location,
    countries: countries.length ? countries : null,
    timezone_restrictions: [],
    salary: {
      min: a.min_salary ?? null,
      max: a.max_salary ?? null,
      currency: null,
      period: null,
      text: null,
    },
    profiles: [],
    eligibility: "revisar",
    eligibility_reason: "",
    technical_fit: "revisar",
    technical_reasons: [],
    technologies: [],
    validity: "active",
    application_language:
      a.lang === "es" || a.lang === "en" || a.lang === "pt" ? a.lang : null,
    requirements: {
      required: plainText(a.description),
      desirable: plainText(a.desirable || ""),
    },
  });
}
const envelope = z.object({
  data: z.array(z.unknown()),
  meta: z.object({
    page: z.number().int(),
    total_pages: z.number().int().nonnegative(),
    per_page: z.number().int(),
  }),
});
export const getonbrd: JobConnector = {
  source: "getonbrd",
  async fetchJobs(): Promise<ConnectorResult> {
    const jobs = new Map<string, NormalizedJob>();
    const errors: string[] = [],
      warnings: string[] = [];
    let received = 0,
      complete = true,
      retryAt: string | undefined,
      stop = false;
    for (const query of new Set([
      ...config.profiles.web,
      ...config.profiles.game_dev,
    ])) {
      if (stop) break;
      for (let page = 1; page <= config.getonbrd.maxPagesPerQuery; page++) {
        const url = new URL("https://www.getonbrd.com/api/v0/search/jobs");
        url.searchParams.set("query", query);
        url.searchParams.set("page", String(page));
        url.searchParams.set("per_page", String(config.getonbrd.perPage));
        url.searchParams.append("expand[]", "company");
        url.searchParams.append("expand[]", "modality");
        url.searchParams.set("lang", "en");
        // No country exclusion: local remote Argentina, LATAM and worldwide remain available for evaluation.
        try {
          const response = envelope.parse(await fetchJson(url.toString()));
          if (response.meta.page !== page)
            throw new Error(
              "Get on Board devolvió una página diferente de la solicitada.",
            );
          received += response.data.length;
          for (const raw of response.data) {
            try {
              const job = normalizeGetonbrd(raw);
              jobs.set(job.external_id, job);
            } catch {
              errors.push(
                `Registro inválido omitido (${query}, página ${page}).`,
              );
              complete = false;
            }
          }
          if (!response.data.length || page >= response.meta.total_pages) break;
          if (page === config.getonbrd.maxPagesPerQuery) {
            complete = false;
            warnings.push(
              `Get on Board: ${query} limitado a ${page} páginas de ${response.meta.total_pages}.`,
            );
          }
        } catch (error) {
          errors.push(
            error instanceof Error ? error.message : "Error de Get on Board.",
          );
          if (error instanceof ApiError && error.retryAt)
            retryAt = error.retryAt;
          complete = false;
          stop = true;
          break;
        }
        await pause(config.getonbrd.requestIntervalMs);
      }
      if (!stop) await pause(config.getonbrd.requestIntervalMs);
    }
    warnings.push(
      "Atribución: Get on Board. Los importes numéricos se conservan sin inferir moneda/período ausentes del contrato. Sin límite numérico de consultas publicado en la referencia consultada: sincronización diaria y pedidos espaciados.",
    );
    return {
      jobs: [...jobs.values()],
      received,
      complete,
      errors,
      warnings,
      retryAt,
    };
  },
};

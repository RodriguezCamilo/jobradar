import { createHash } from "node:crypto";
import candidate from "../../config/candidate.json";
import type { NormalizedJob } from "./domain";
export const PROMPT_VERSION = "job-radar-v2.2";
export const DEFAULT_GROQ_MODEL = "openai/gpt-oss-20b";
export const MAX_ANALYSIS_BATCH = 3;
export const getGroqModel = () =>
  process.env.GROQ_MODEL?.trim() || DEFAULT_GROQ_MODEL;
export function analysisDocument(
  job: Pick<
    NormalizedJob,
    | "title"
    | "company"
    | "description"
    | "profiles"
    | "location"
    | "requirements"
    | "application_language"
  >,
) {
  return {
    title: job.title,
    company: job.company,
    profiles: job.profiles,
    location: job.location,
    description: job.description.slice(0, 12000),
    requirements: job.requirements
      ? {
          required: job.requirements.required.slice(0, 3000),
          desirable: job.requirements.desirable.slice(0, 1500),
        }
      : null,
    application_language: job.application_language ?? null,
  };
}
export function analysisHash(job: Parameters<typeof analysisDocument>[0]) {
  // Hash full content as well as the exact bounded request and candidate profile.
  // Tracking, feedback, discovery dates and URLs never affect the cache key.
  return createHash("sha256")
    .update(
      JSON.stringify({
        document: analysisDocument(job),
        fullDescription: job.description,
        candidate,
      }),
    )
    .digest("hex");
}
export { candidate };

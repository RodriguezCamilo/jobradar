import type { NormalizedJob, Job } from "../src/lib/domain";
import { classifyLanguage } from "../src/lib/language";
export function fixture(overrides: Partial<NormalizedJob> = {}): NormalizedJob {
  return {
    source: "himalayas",
    external_id: "test-1",
    title: "React Developer",
    company: "Test company",
    description: "Build software with React and TypeScript.",
    original_url: "https://example.test/jobs/123",
    application_url: "https://example.test/jobs/123?utm_source=api",
    published_at: "2026-11-01T12:00:00.000Z",
    publication_note: null,
    expires_at: null,
    employment_type: "Full Time",
    modality: "remote",
    location: "Argentina",
    countries: ["Argentina"],
    timezone_restrictions: [],
    salary: { min: null, max: null, currency: null, period: null, text: null },
    profiles: ["web"],
    eligibility: "aceptable",
    eligibility_reason: "Argentina permitida.",
    technical_fit: "compatible",
    technical_reasons: [],
    technologies: ["React"],
    validity: "active",
    ...overrides,
  };
}
export function jobFixture(overrides: Partial<Job> = {}): Job {
  const normalized = fixture();
  return {
    ...normalized,
    language: classifyLanguage(normalized.description),
    feedback: { rating: "sin_evaluar", reason: null },
    analysis: null,
    id: "fe2e2a63-7060-4d86-bc3f-46ef529e6402",
    first_discovered_at: "2026-11-04T12:00:00.000Z",
    last_checked_at: "2026-11-04T12:00:00.000Z",
    tracking: { status: "nueva", seen_at: null },
    sources: [
      {
        source: "himalayas",
        external_id: "test-1",
        original_url: normalized.original_url,
        application_url: normalized.application_url,
        validity: "active",
        last_checked_at: "2026-11-04T12:00:00.000Z",
      },
    ],
    ...overrides,
  };
}

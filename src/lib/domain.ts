export const sources = ["himalayas", "remotive"] as const;
export type Source = (typeof sources)[number];
export type Profile = "web" | "game_dev";
export type Eligibility = "aceptable" | "revisar" | "descartar";
export const trackingStates = [
  "nueva",
  "guardada",
  "postulada",
  "en_proceso",
  "rechazada",
  "descartada",
] as const;
export type TrackingState = (typeof trackingStates)[number];
export type Validity = "active" | "unverified" | "closed" | "expired";
export interface NormalizedJob {
  source: Source;
  external_id: string;
  company: string;
  title: string;
  description: string;
  original_url: string;
  application_url: string;
  published_at: string | null;
  publication_note: string | null;
  expires_at: string | null;
  employment_type: string | null;
  modality: "remote" | "hybrid" | "onsite";
  location: string;
  countries: string[] | null;
  timezone_restrictions: (number | string)[];
  salary: {
    min: number | null;
    max: number | null;
    currency: string | null;
    period: string | null;
    text: string | null;
  };
  profiles: Profile[];
  eligibility: Eligibility;
  eligibility_reason: string;
  technical_fit: "compatible" | "revisar";
  technical_reasons: string[];
  technologies: string[];
  validity: Validity;
}
export interface JobSource {
  source: Source;
  external_id: string;
  original_url: string;
  application_url: string;
  validity: Validity;
  last_checked_at: string;
}
export interface Job extends Omit<NormalizedJob, "source" | "external_id"> {
  id: string;
  first_discovered_at: string;
  last_checked_at: string;
  sources: JobSource[];
  tracking: { status: TrackingState; seen_at: string | null };
}
export interface SyncRun {
  source: Source;
  started_at: string;
  finished_at: string | null;
  status: "success" | "partial" | "error" | "cached";
  received: number;
  candidates: number;
  inserted: number;
  errors: string[];
  warnings: string[];
  next_allowed_at: string;
}
export interface RadarData {
  jobs: Job[];
  runs: SyncRun[];
  persistence: "supabase" | "preview";
  error?: string;
}

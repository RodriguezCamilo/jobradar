export const sources = ["himalayas", "remotive", "getonbrd"] as const;
export const sourceNames: Record<Source, string> = {
  himalayas: "Himalayas",
  remotive: "Remotive",
  getonbrd: "Get on Board",
};
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
export const workLanguages = [
  "spanish_confirmed",
  "spanish_likely",
  "unknown",
  "english_required",
] as const;
export type WorkLanguage = (typeof workLanguages)[number];
export interface LanguageAssessment {
  ad_language: "es" | "en" | "pt" | "mixed" | "unknown";
  ad_reason: string;
  work_language: WorkLanguage;
  confidence: "high" | "medium" | "low";
  reason: string;
  evidence: string[];
  method: "rules" | "groq";
}
export const feedbackRatings = [
  "sin_evaluar",
  "me_interesa",
  "no_encaja",
] as const;
export const feedbackReasons = [
  "idioma",
  "experiencia",
  "stack",
  "ubicacion",
  "seniority",
  "remuneracion",
  "otro",
] as const;
export type FeedbackRating = (typeof feedbackRatings)[number];
export type FeedbackReason = (typeof feedbackReasons)[number];
export interface Feedback {
  rating: FeedbackRating;
  reason: FeedbackReason | null;
}
export interface IntelligentAssessment {
  work_language: WorkLanguage;
  confidence: "high" | "medium" | "low";
  language_evidence: string[];
  language_reason: string;
  required: string[];
  desirable: string[];
  seniority: string;
  profiles: Profile[];
  missing_technologies: string[];
  recommendation: "priorizar" | "revisar" | "baja_afinidad";
  explanation: string;
  uncertainty: string[];
}
export interface JobAnalysis {
  status: "pending" | "success" | "error";
  model: string;
  prompt_version: string;
  content_hash: string;
  result: IntelligentAssessment | null;
  input_tokens: number;
  output_tokens: number;
  error: string | null;
  retry_at: string | null;
  updated_at: string;
  current: boolean;
}
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
  language?: LanguageAssessment;
  application_language?: string | null;
  requirements?: { required: string; desirable: string };
}
export interface JobSource {
  source: Source;
  external_id: string;
  original_url: string;
  application_url: string;
  validity: Validity;
  last_checked_at: string;
  language?: LanguageAssessment | null;
}
export interface Job extends Omit<NormalizedJob, "source" | "external_id"> {
  id: string;
  first_discovered_at: string;
  last_checked_at: string;
  sources: JobSource[];
  tracking: { status: TrackingState; seen_at: string | null };
  language: LanguageAssessment;
  feedback: Feedback;
  analysis: JobAnalysis | null;
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
  groq?: {
    configured: boolean;
    model: string;
    maxBatch: number;
    retryAt: string | null;
  };
}

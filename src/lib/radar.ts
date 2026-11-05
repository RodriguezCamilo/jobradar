import "server-only";
import { createHash } from "node:crypto";
import { hasDatabase } from "./database";
import { readSnapshot } from "./cache";
import { listJobs, listRuns } from "./repository";
import type { Job, RadarData } from "./domain";
import { sources } from "./domain";
import { normalizeJobUrl } from "./text";
import { classifyLanguage } from "./language";
import { database } from "./database";
import { getGroqModel, MAX_ANALYSIS_BATCH } from "./analysis-key";

export async function loadRadar(): Promise<RadarData> {
  let error: string | undefined;
  if (hasDatabase()) {
    try {
      const [jobs, runs] = await Promise.all([listJobs(), listRuns()]);
      const control =
        await database()`select retry_at from public.analysis_control where provider='groq'`;
      return {
        jobs,
        runs,
        persistence: "supabase",
        groq: {
          configured: Boolean(process.env.GROQ_API_KEY),
          model: getGroqModel(),
          maxBatch: MAX_ANALYSIS_BATCH,
          retryAt: control[0]?.retry_at
            ? new Date(control[0].retry_at).toISOString()
            : null,
        },
      };
    } catch {
      error =
        "No se pudo leer Supabase. Verificar conexión y migración. La caché se muestra sin seguimiento persistente.";
    }
  }
  const snapshots = (await Promise.all(sources.map(readSnapshot))).filter(
    (v) => v !== null,
  );
  const jobs = new Map<string, Job>();
  for (const snapshot of snapshots) {
    for (const raw of snapshot.jobs.filter((j) => j.profiles.length)) {
      const key =
        normalizeJobUrl(raw.application_url) ||
        `${raw.source}:${raw.external_id}`;
      const source = {
        source: raw.source,
        external_id: raw.external_id,
        original_url: raw.original_url,
        application_url: raw.application_url,
        validity: raw.validity,
        last_checked_at: snapshot.run.started_at,
      };
      const existing = jobs.get(key);
      if (existing) {
        existing.sources.push(source);
        continue;
      }
      jobs.set(key, {
        ...raw,
        id: createHash("sha256").update(key).digest("hex").slice(0, 32),
        first_discovered_at: snapshot.run.started_at,
        last_checked_at: snapshot.run.started_at,
        sources: [source],
        tracking: { status: "nueva", seen_at: null },
        feedback: { rating: "sin_evaluar", reason: null },
        analysis: null,
        language:
          raw.language ??
          classifyLanguage(raw.description, raw.application_language),
      });
    }
  }
  return {
    jobs: [...jobs.values()],
    runs: snapshots.map((s) => s.run),
    persistence: "preview",
    error,
  };
}

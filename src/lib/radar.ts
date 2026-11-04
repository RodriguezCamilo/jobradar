import "server-only";
import { createHash } from "node:crypto";
import { hasDatabase } from "./database";
import { readSnapshot } from "./cache";
import { listJobs, listRuns } from "./repository";
import type { Job, RadarData } from "./domain";
import { sources } from "./domain";
import { normalizeJobUrl } from "./text";

export async function loadRadar(): Promise<RadarData> {
  let error: string | undefined;
  if (hasDatabase()) {
    try {
      const [jobs, runs] = await Promise.all([listJobs(), listRuns()]);
      return { jobs, runs, persistence: "supabase" };
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

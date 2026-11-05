import { mkdir, open, unlink } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import config from "../../config/searches.json";
import { hasDatabase } from "./database";
import type { NormalizedJob, Source, SyncRun } from "./domain";
import { sources } from "./domain";
import { readSnapshot, writeSnapshot } from "./cache";
import { himalayas, normalizeHimalayas } from "./connectors/himalayas";
import { remotive } from "./connectors/remotive";
import { getonbrd } from "./connectors/getonbrd";
import { ApiError, fetchJson, pause } from "./connectors/http";
import {
  ingestJobs,
  markMissing,
  refreshValidity,
  saveRun,
  setSourceValidity,
  sourceHistory,
} from "./repository";

const connectors = { himalayas, remotive, getonbrd };
async function importCandidates(
  source: Source,
  jobs: NormalizedJob[],
  onlyNew = false,
) {
  const known = new Set(
    (await sourceHistory(source)).map((s) => s.external_id),
  );
  return ingestJobs(
    jobs.filter((j) =>
      onlyNew
        ? j.profiles.length && !known.has(j.external_id)
        : j.profiles.length || known.has(j.external_id),
    ),
  );
}

async function checkHimalayas(currentIds: Set<string>, warnings: string[]) {
  const old = (await sourceHistory("himalayas")).filter(
    (j) =>
      !currentIds.has(j.external_id) &&
      !["closed", "expired"].includes(j.validity),
  );
  const candidates = old.slice(0, config.himalayas.maxChecksPerSync);
  for (const job of candidates) {
    try {
      const original = new URL(job.external_id);
      if (
        original.hostname !== "himalayas.app" ||
        !/^\/companies\/[^/]+\/jobs\/[^/]+$/.test(original.pathname)
      )
        continue;
      const headers: Record<string, string> = process.env.HIMALAYAS_API_KEY
        ? { Authorization: `Bearer ${process.env.HIMALAYAS_API_KEY}` }
        : {};
      const raw = await fetchJson(
        `https://himalayas.app/jobs/api${original.pathname}`,
        { headers },
      );
      const data = z.object({ job: z.unknown() }).parse(raw);
      await ingestJobs([normalizeHimalayas(data.job)]);
    } catch (error) {
      if (error instanceof ApiError && error.status === 410)
        await setSourceValidity("himalayas", job.external_id, "closed");
      else if (error instanceof ApiError && error.status === 404)
        await setSourceValidity("himalayas", job.external_id, "unverified");
      else {
        warnings.push(
          "No se pudo completar la comprobación individual de vigencia de Himalayas.",
        );
        break;
      }
    }
    await pause(config.himalayas.requestIntervalMs);
  }
  if (old.length > candidates.length)
    warnings.push(
      `${old.length - candidates.length} ofertas históricas pendientes de verificar en sincronizaciones posteriores.`,
    );
  await refreshValidity();
}

async function synchronizeSource(source: Source): Promise<SyncRun> {
  const prior = await readSnapshot(source);
  const now = new Date().toISOString();
  if (prior && prior.run.next_allowed_at > now) {
    // Cached responses may still be imported after configuring the database or after a DB failure.
    let inserted = 0;
    if (hasDatabase())
      inserted = await importCandidates(source, prior.jobs, true);
    return {
      ...prior.run,
      status:
        prior.run.status === "error" || prior.run.status === "partial"
          ? prior.run.status
          : "cached",
      inserted,
    };
  }
  const next = new Date(
    Date.now() + config[source].minSyncHours * 3600000,
  ).toISOString();
  const run: SyncRun = {
    source,
    started_at: now,
    finished_at: null,
    status: "error",
    received: 0,
    candidates: 0,
    inserted: 0,
    errors: [],
    warnings: [],
    next_allowed_at: next,
  };
  // Persist cooldown before contacting upstream, so restarting the local process cannot bypass it.
  await writeSnapshot(source, { jobs: prior?.jobs ?? [], run });
  let jobs: NormalizedJob[] = prior?.jobs ?? [];
  try {
    const result = await connectors[source].fetchJobs();
    jobs = result.jobs;
    run.received = new Set(jobs.map((j) => j.external_id)).size;
    run.candidates = jobs.filter((j) => j.profiles.length).length;
    run.errors = result.errors;
    run.warnings = result.warnings;
    if (result.retryAt && result.retryAt > run.next_allowed_at)
      run.next_allowed_at = result.retryAt;
    run.status = result.errors.length
      ? jobs.length
        ? "partial"
        : "error"
      : "success";
    // Save fresh external data before database import; a DB problem must not trigger another API fetch.
    await writeSnapshot(source, { jobs, run });
    if (hasDatabase()) {
      run.inserted = await importCandidates(source, jobs);
      if (
        result.complete ||
        (["himalayas", "getonbrd"].includes(source) && !result.errors.length)
      ) {
        await markMissing(
          source,
          jobs.map((j) => j.external_id),
        );
        if (source === "himalayas")
          await checkHimalayas(
            new Set(jobs.map((j) => j.external_id)),
            run.warnings,
          );
      }
    }
  } catch (error) {
    run.status = "error";
    run.errors.push(
      error instanceof Error
        ? error.message.replace(
            /postgres(?:ql)?:\/\/\S+/g,
            "[conexión privada]",
          )
        : "Falló la sincronización.",
    );
    if (
      error instanceof ApiError &&
      error.retryAt &&
      error.retryAt > run.next_allowed_at
    )
      run.next_allowed_at = error.retryAt;
  }
  run.finished_at = new Date().toISOString();
  await writeSnapshot(source, { jobs, run });
  if (hasDatabase()) await saveRun(run);
  return run;
}

export async function synchronize(
  selectedSources: Source[] = [...sources],
): Promise<SyncRun[]> {
  const dir = path.join(process.cwd(), ".cache");
  await mkdir(dir, { recursive: true });
  const lockPath = path.join(dir, "sync.lock");
  // Inter-process lock: prevents duplicate work across Next workers and CLI invocations.
  let handle;
  try {
    handle = await open(lockPath, "wx");
  } catch {
    throw new Error(
      "Ya hay una sincronización en curso. Si el proceso terminó abruptamente, borrar .cache/sync.lock antes de reintentar.",
    );
  }
  try {
    await handle.writeFile(
      JSON.stringify({
        pid: process.pid,
        started_at: new Date().toISOString(),
      }),
    );
    const runs: SyncRun[] = [];
    for (const source of new Set(selectedSources))
      runs.push(await synchronizeSource(source));
    return runs;
  } finally {
    await handle.close();
    await unlink(lockPath);
  }
}

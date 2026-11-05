import { mkdir, writeFile } from "node:fs/promises";
import { synchronize } from "../src/lib/sync";
import { database, hasDatabase } from "../src/lib/database";
import { listJobs, ingestJobs } from "../src/lib/repository";
import { readSnapshot } from "../src/lib/cache";
import { sources } from "../src/lib/domain";

try {
  console.log(
    "Ejecutando sincronización manual; se respetan las ventanas de caché de cada fuente.",
  );
  const runs = await synchronize();
  const snapshots = await Promise.all(sources.map(readSnapshot));
  const jobs = hasDatabase() ? await listJobs() : [];
  let duplicateInsertions: number | null = null;
  let trackingPersisted: boolean | null = null;
  if (hasDatabase()) {
    // Real external records only. A second identical import must insert zero rows.
    duplicateInsertions = await ingestJobs(
      snapshots.flatMap((s) => s?.jobs.filter((j) => j.profiles.length) ?? []),
    );
    if (duplicateInsertions !== 0)
      throw new Error("La segunda importación insertó duplicados.");
    const sql = database();
    if (jobs[0]) {
      // Roll back the personal status probe so verification does not alter the user's choices.
      await sql.begin(async (transaction) => {
        await transaction`update public.job_tracking set status='postulada',seen_at=now() where job_id=${jobs[0].id}`;
        const rows =
          await transaction`select status,seen_at from public.job_tracking where job_id=${jobs[0].id}`;
        trackingPersisted =
          rows[0].status === "postulada" && rows[0].seen_at !== null;
        await transaction.rollback();
      });
      if (!trackingPersisted)
        throw new Error(
          "Falló la lectura del seguimiento escrito en PostgreSQL.",
        );
    }
  }
  const count = {
    webOnly: jobs.filter(
      (j) => j.profiles.length === 1 && j.profiles[0] === "web",
    ).length,
    gameDevOnly: jobs.filter(
      (j) => j.profiles.length === 1 && j.profiles[0] === "game_dev",
    ).length,
    both: jobs.filter((j) => j.profiles.length === 2).length,
    webTab: jobs.filter((j) => j.profiles.includes("web")).length,
    gameDevTab: jobs.filter((j) => j.profiles.includes("game_dev")).length,
    eligibility: Object.fromEntries(
      ["aceptable", "revisar", "descartar"].map((s) => [
        s,
        jobs.filter((j) => j.eligibility === s).length,
      ]),
    ),
  };
  const report = {
    verified_at: new Date().toISOString(),
    persistence: hasDatabase() ? "Supabase PostgreSQL" : "not configured",
    runs,
    count,
    duplicateInsertions,
    trackingPersisted,
  };
  await mkdir("artifacts", { recursive: true });
  await writeFile("artifacts/validation.json", JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (runs.some((r) => r.status === "error" || r.status === "partial"))
    process.exitCode = 1;
} finally {
  if (hasDatabase()) await database().end();
}

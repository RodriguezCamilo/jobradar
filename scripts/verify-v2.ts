import { readFile, writeFile, mkdir } from "node:fs/promises";
import { database } from "../src/lib/database";
import { listJobs } from "../src/lib/repository";
import { effectiveLanguage } from "../src/lib/recommendation";
import { readSnapshot } from "../src/lib/cache";
import { synchronize } from "../src/lib/sync";
const sql = database();
try {
  await mkdir("artifacts", { recursive: true });
  const baseline = await readFile("artifacts/v2-baseline.json", "utf8").catch(
    (error) => {
      if (error.code === "ENOENT") return null;
      throw error;
    },
  );
  const before = baseline ? JSON.parse(baseline) : null;
  const ids = before?.jobs.map((j: { id: string }) => j.id) ?? [];
  const jobs = JSON.parse(
    JSON.stringify(
      await sql`select id,first_discovered_at,original_url,application_url from public.jobs where id=any(${ids}::uuid[]) order by id`,
    ),
  );
  const tracking = JSON.parse(
    JSON.stringify(
      await sql`select * from public.job_tracking where job_id=any(${ids}::uuid[]) order by job_id`,
    ),
  );
  const sourceRows = JSON.parse(
    JSON.stringify(
      await sql`select source,external_id,job_id,original_url,application_url from public.job_sources where job_id=any(${ids}::uuid[]) order by source,external_id`,
    ),
  );
  const checks = {
    existing_offers_preserved: before
      ? JSON.stringify(jobs) === JSON.stringify(before.jobs)
      : null,
    tracking_and_seen_preserved: before
      ? JSON.stringify(tracking) === JSON.stringify(before.tracking)
      : null,
    source_associations_and_urls_preserved: before
      ? JSON.stringify(sourceRows) === JSON.stringify(before.sources)
      : null,
  };
  const all = await listJobs();
  const languageDistribution = Object.fromEntries(
    ["spanish_confirmed", "spanish_likely", "unknown", "english_required"].map(
      (value) => [
        value,
        all.filter((j) => effectiveLanguage(j).work_language === value).length,
      ],
    ),
  );
  const adDistribution = Object.fromEntries(
    ["es", "en", "pt", "mixed", "unknown"].map((value) => [
      value,
      all.filter((j) => j.language.ad_language === value).length,
    ]),
  );
  const source = await readSnapshot("getonbrd");
  const cacheRun = await synchronize(["getonbrd"]);
  const analysis =
    await sql`select model,prompt_version,status,count(*)::int as count,sum(input_tokens)::int as input_tokens,sum(output_tokens)::int as output_tokens from public.job_analyses group by model,prompt_version,status`;
  const report = {
    verified_at: new Date().toISOString(),
    checks,
    getonbrd: {
      ...source?.run,
      cacheCheck: cacheRun[0].status,
      cacheInsertions: cacheRun[0].inserted,
    },
    candidateCount: all.length,
    profiles: {
      webOnly: all.filter(
        (j) => j.profiles.length === 1 && j.profiles[0] === "web",
      ).length,
      gameDevOnly: all.filter(
        (j) => j.profiles.length === 1 && j.profiles[0] === "game_dev",
      ).length,
      both: all.filter((j) => j.profiles.length === 2).length,
    },
    workLanguage: languageDistribution,
    adLanguage: adDistribution,
    geo: Object.fromEntries(
      ["aceptable", "revisar", "descartar"].map((value) => [
        value,
        all.filter((j) => j.eligibility === value).length,
      ]),
    ),
    analysis,
  };
  await writeFile(
    "artifacts/v2-validation.json",
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report, null, 2));
  if (
    Object.values(checks).some((v) => v === false) ||
    cacheRun[0].inserted !== 0
  )
    process.exitCode = 1;
} finally {
  await sql.end();
}

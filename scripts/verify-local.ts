import { database } from "../src/lib/database";
import { mkdir, writeFile } from "node:fs/promises";
import { trackingStates, type RadarData } from "../src/lib/domain";
const base = "http://127.0.0.1:3000";
const sql = database();
let restore: { id: string; status: string; seen_at: string | null } | undefined;
try {
  const initial = await fetch(`${base}/api/jobs`);
  if (!initial.ok) throw new Error("GET /api/jobs falló.");
  const data = (await initial.json()) as RadarData;
  if (data.persistence !== "supabase" || !data.jobs.length)
    throw new Error("No hay datos persistidos para validar.");
  const job =
    data.jobs.find((j) => j.company === "Fluence International, Inc.") ||
    data.jobs[0];
  restore = { id: job.id, ...job.tracking };
  const checks: Record<string, boolean> = {};
  for (const status of trackingStates) {
    const response = await fetch(`${base}/api/jobs/${job.id}`, {
      method: "PATCH",
      headers: { Origin: base, "Content-Type": "application/json" },
      body: JSON.stringify({ status, seen: true }),
    });
    const fresh = (await (await fetch(`${base}/api/jobs`)).json()) as RadarData;
    checks[`status_${status}`] =
      response.ok &&
      fresh.jobs.find((j) => j.id === job.id)?.tracking.status === status;
  }
  const sync = await fetch(`${base}/api/sync`, {
    method: "POST",
    headers: { Origin: base },
  });
  const syncResult = await sync.json();
  checks.cached_sync =
    sync.ok &&
    syncResult.runs.every(
      (r: { status: string; inserted: number }) =>
        r.status === "cached" && r.inserted === 0,
    );
  const afterSync = (await (
    await fetch(`${base}/api/jobs`)
  ).json()) as RadarData;
  checks.import_preserves_tracking =
    afterSync.jobs.find((j) => j.id === job.id)?.tracking.status ===
    "descartada";
  checks.mark_seen = Boolean(
    afterSync.jobs.find((j) => j.id === job.id)?.tracking.seen_at,
  );
  const unauthorized = await fetch(`${base}/api/sync`, {
    method: "POST",
    headers: { Origin: "https://example.test" },
  });
  checks.cross_origin_blocked = unauthorized.status === 403;
  const invalid = await fetch(`${base}/api/jobs/${job.id}`, {
    method: "PATCH",
    headers: { Origin: base, "Content-Type": "application/json" },
    body: JSON.stringify({ status: "invalid" }),
  });
  checks.invalid_status_rejected = invalid.status === 400;
  if (
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  ) {
    const publicRead = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/jobs?select=id&limit=1`,
      { headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY } },
    );
    checks.public_database_access_blocked = !publicRead.ok;
  }
  const report = { verified_at: new Date().toISOString(), checks };
  await mkdir("artifacts", { recursive: true });
  await writeFile(
    "artifacts/local-validation.json",
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report, null, 2));
  if (Object.values(checks).some((passed) => !passed)) process.exitCode = 1;
} finally {
  if (restore)
    await sql`update public.job_tracking set status=${restore.status},seen_at=${restore.seen_at} where job_id=${restore.id}`;
  await sql.end();
}

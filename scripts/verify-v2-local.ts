import { database } from "../src/lib/database";
import { writeFile, mkdir } from "node:fs/promises";
import type { Job, RadarData } from "../src/lib/domain";
const sql = database(),
  base = "http://127.0.0.1:3000";
let id: string | undefined;
let original: Record<string, unknown> | undefined;
try {
  await mkdir("artifacts", { recursive: true });
  const d = (await (await fetch(base + "/api/jobs")).json()) as RadarData;
  const job =
    d.jobs.find(
      (j) =>
        j.sources.some((s) => s.source === "getonbrd") &&
        j.eligibility !== "descartar",
    ) ?? d.jobs[0];
  if (!job) throw Error("Falta la oferta elegida para verificar.");
  id = job.id;
  const prior =
    await sql`select * from public.job_feedback where job_id=${id!}`;
  original = prior[0];
  const before = JSON.stringify(job.tracking);
  const response = await fetch(`${base}/api/jobs/${id}/feedback`, {
    method: "PATCH",
    headers: { Origin: base, "Content-Type": "application/json" },
    body: JSON.stringify({ rating: "me_interesa", reason: "idioma" }),
  });
  const refreshed = await (await fetch(base + "/api/jobs")).json();
  const after = refreshed.jobs.find((j: { id: string }) => j.id === id);
  const exportResponse = await fetch(base + "/api/feedback/export");
  const exported = await exportResponse.json();
  const invalid = await fetch(`${base}/api/jobs/${id}/feedback`, {
    method: "PATCH",
    headers: { Origin: base, "Content-Type": "application/json" },
    body: JSON.stringify({ rating: "unvalidated", reason: "secret" }),
  });
  const crossOrigin = await fetch(base + "/api/analyze", {
    method: "POST",
    headers: {
      Origin: "https://evil.test",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ jobId: id }),
  });
  const checks = {
    feedback_persisted:
      response.ok &&
      after.feedback.rating === "me_interesa" &&
      after.feedback.reason === "idioma",
    tracking_independent: JSON.stringify(after.tracking) === before,
    export_available:
      exportResponse.ok &&
      exported.offers.some(
        (j: { rating: string }) => j.rating === "me_interesa",
      ),
    export_no_descriptions: exported.offers.every(
      (j: Record<string, unknown>) =>
        !("description" in j) &&
        !("GROQ_API_KEY" in j) &&
        Object.keys(j).every((k) =>
          [
            "title",
            "company",
            "url",
            "rating",
            "reason",
            "updated_at",
          ].includes(k),
        ),
    ),
    invalid_feedback_rejected: invalid.status === 400,
    cross_origin_analysis_blocked: crossOrigin.status === 403,
  };
  const cached = [];
  for (const jobId of d.jobs
    .filter((j: Job) => j.analysis?.current && j.analysis.status === "success")
    .slice(0, 2)
    .map((j) => j.id)) {
    const r = await fetch(base + "/api/analyze", {
      method: "POST",
      headers: { Origin: base, "Content-Type": "application/json" },
      body: JSON.stringify({ jobId }),
    });
    const result = await r.json();
    cached.push(r.ok && result.cached === true);
  }
  const report = {
    verified_at: new Date().toISOString(),
    checks: {
      ...checks,
      persistent_analysis_cache: cached.length ? cached.every(Boolean) : null,
    },
    cached_offers_tested: cached.length,
  };
  await writeFile(
    "artifacts/v2-local-validation.json",
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report, null, 2));
  if (Object.values(report.checks).some((v) => v === false))
    process.exitCode = 1;
} finally {
  if (id) {
    if (original)
      await sql`update public.job_feedback set rating=${String(original.rating)},reason=${original.reason as string | null},updated_at=${original.updated_at as Date} where job_id=${id}`;
    else await sql`delete from public.job_feedback where job_id=${id}`;
  }
  await sql.end();
}

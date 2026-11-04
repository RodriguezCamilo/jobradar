import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { fixture } from "./fixtures";
import { normalizeJobUrl } from "../src/lib/text";
import type { NormalizedJob } from "../src/lib/domain";
const pg = new PGlite();
async function ingest(job: NormalizedJob) {
  const result = await pg.query<{ job_id: string; inserted: boolean }>(
    "select * from public.ingest_job($1::jsonb,$2::text[])",
    [
      JSON.stringify(job),
      [normalizeJobUrl(job.application_url)].filter(Boolean),
    ],
  );
  return result.rows[0];
}
beforeAll(async () => {
  await pg.exec("create role anon; create role authenticated;");
  await pg.exec(
    await readFile("supabase/migrations/202611040001_initial.sql", "utf8"),
  );
  await pg.exec(
    await readFile(
      "supabase/migrations/202611040002_refresh_profiles.sql",
      "utf8",
    ),
  );
});
afterAll(() => pg.close());
describe("migración y transacciones PostgreSQL", () => {
  it("reingreso no duplica y conserva seguimiento, visto y fecha de descubrimiento", async () => {
    const job = fixture();
    const first = await ingest(job);
    await pg.query(
      "update public.job_tracking set status='postulada',seen_at=now() where job_id=$1",
      [first.job_id],
    );
    const before = await pg.query<{ first_discovered_at: Date }>(
      "select first_discovered_at from public.jobs where id=$1",
      [first.job_id],
    );
    const second = await ingest({ ...job, title: "Updated React Developer" });
    expect(first.inserted).toBe(true);
    expect(second.inserted).toBe(false);
    expect(second.job_id).toBe(first.job_id);
    const after = await pg.query<{
      first_discovered_at: Date;
      status: string;
      seen_at: Date | null;
      title: string;
    }>(
      "select j.first_discovered_at,t.status,t.seen_at,j.title from public.jobs j join public.job_tracking t on t.job_id=j.id where j.id=$1",
      [first.job_id],
    );
    expect(after.rows[0]).toMatchObject({
      status: "postulada",
      title: "Updated React Developer",
      first_discovered_at: before.rows[0].first_discovered_at,
    });
    expect(after.rows[0].seen_at).not.toBeNull();
  });
  it("misma URL específica en otra fuente se muestra una sola vez", async () => {
    const existing = await ingest(fixture());
    const cross = await ingest(
      fixture({
        source: "remotive",
        external_id: "other-id",
        application_url: "https://example.test/jobs/123?utm_source=remotive",
      }),
    );
    expect(cross.job_id).toBe(existing.job_id);
    expect(cross.inserted).toBe(false);
    const appearances = await pg.query<{ count: number }>(
      "select count(*)::int as count from public.job_sources where job_id=$1",
      [cross.job_id],
    );
    expect(appearances.rows[0].count).toBe(2);
  });
  it("mismo título sin URL común no basta para fusionar", async () => {
    const separate = await ingest(
      fixture({
        external_id: "different-id",
        original_url: "https://example.test/jobs/999",
        application_url: "https://example.test/jobs/999",
      }),
    );
    expect(separate.inserted).toBe(true);
  });
  it("evidencia contradictoria entre fuentes requiere revisión", async () => {
    const row = await ingest(
      fixture({
        source: "remotive",
        external_id: "other-id",
        eligibility: "descartar",
        eligibility_reason: "US only",
      }),
    );
    const result = await pg.query<{ eligibility: string }>(
      "select eligibility from public.jobs where id=$1",
      [row.job_id],
    );
    expect(result.rows[0].eligibility).toBe("revisar");
  });
  it("habilita RLS y no ofrece políticas de acceso público", async () => {
    const result = await pg.query<{ relrowsecurity: boolean }>(
      "select relrowsecurity from pg_class where relname='jobs'",
    );
    expect(result.rows[0].relrowsecurity).toBe(true);
    const policies = await pg.query(
      "select * from pg_policies where tablename='jobs'",
    );
    expect(policies.rows.length).toBe(0);
  });
  it("puede corregir una pertenencia de perfil anterior", async () => {
    const row = await ingest(
      fixture({
        external_id: "recategorized",
        application_url: "https://example.test/jobs/reclassified",
        profiles: ["web", "game_dev"],
      }),
    );
    await ingest(
      fixture({
        external_id: "recategorized",
        application_url: "https://example.test/jobs/reclassified",
        profiles: ["web"],
      }),
    );
    const result = await pg.query<{ profiles: string[] }>(
      "select profiles from public.jobs where id=$1",
      [row.job_id],
    );
    expect(result.rows[0].profiles).toEqual(["web"]);
  });
});

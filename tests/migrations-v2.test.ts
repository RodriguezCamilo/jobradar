import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { describe, it, expect } from "vitest";
import { fixture } from "./fixtures";
describe("migración incremental V2 y datos personales", () => {
  it("conserva datos V1, admite fuente nueva y no pisa feedback/análisis al sincronizar", async () => {
    const pg = new PGlite();
    try {
      await pg.exec(
        "create role anon;create role authenticated;create table public.job_radar_migrations(name text primary key);",
      );
      for (const file of [
        "202611040001_initial",
        "202611040002_refresh_profiles",
      ])
        await pg.exec(
          await readFile(`supabase/migrations/${file}.sql`, "utf8"),
        );
      const payload = fixture();
      const ingested = await pg.query<{ job_id: string }>(
        "select * from public.ingest_job($1::jsonb,$2::text[])",
        [JSON.stringify(payload), []],
      );
      const id = ingested.rows[0].job_id;
      await pg.query(
        "update public.job_tracking set status='postulada',seen_at=now() where job_id=$1",
        [id],
      );
      const before = await pg.query(
        "select j.*,to_jsonb(t) as tracking from public.jobs j join public.job_tracking t on t.job_id=j.id",
      );
      const migration = await readFile(
        "supabase/migrations/202611040003_v2_analysis_feedback.sql",
        "utf8",
      );
      await pg.exec(migration);
      expect(
        (
          await pg.query(
            "select j.*,to_jsonb(t) as tracking from public.jobs j join public.job_tracking t on t.job_id=j.id",
          )
        ).rows,
      ).toEqual(before.rows);
      // Exercise the reversible migration before there are any new-source rows.
      await pg.exec(
        await readFile(
          "supabase/rollbacks/202611040003_v2_analysis_feedback.sql",
          "utf8",
        ),
      );
      expect(
        (
          await pg.query(
            "select j.*,to_jsonb(t) as tracking from public.jobs j join public.job_tracking t on t.job_id=j.id",
          )
        ).rows,
      ).toEqual(before.rows);
      await pg.exec(migration);
      await pg.query(
        "insert into public.job_feedback(job_id,rating,reason) values($1,'no_encaja','idioma')",
        [id],
      );
      await pg.query(
        "insert into public.job_analyses(job_id,content_hash,prompt_version,model,status,result) values($1,'hash','v2','model','success','{}')",
        [id],
      );
      await pg.query("select * from public.ingest_job($1::jsonb,$2::text[])", [
        JSON.stringify(payload),
        [],
      ]);
      expect(
        (
          await pg.query<{ rating: string; reason: string }>(
            "select rating,reason from public.job_feedback where job_id=$1",
            [id],
          )
        ).rows[0],
      ).toEqual({ rating: "no_encaja", reason: "idioma" });
      expect(
        (
          await pg.query<{ status: string }>(
            "select status from public.job_tracking where job_id=$1",
            [id],
          )
        ).rows[0].status,
      ).toBe("postulada");
      expect(
        (await pg.query("select * from public.job_analyses")).rows,
      ).toHaveLength(1);
      await expect(
        pg.query(
          "insert into public.job_analyses(job_id,content_hash,prompt_version,model,status,result) values($1,'hash','v2','model','success','{}')",
          [id],
        ),
      ).rejects.toThrow();
      await pg.query("select * from public.ingest_job($1::jsonb,$2::text[])", [
        JSON.stringify({
          ...payload,
          source: "getonbrd",
          external_id: "new-source",
          application_url: "https://www.getonbrd.com/jobs/test",
        }),
        [],
      ]);
      expect((await pg.query("select * from public.jobs")).rows).toHaveLength(
        2,
      );
      await expect(
        pg.exec(
          await readFile(
            "supabase/rollbacks/202611040003_v2_analysis_feedback.sql",
            "utf8",
          ),
        ),
      ).rejects.toThrow("Get on Board");
      await pg.exec("rollback;");
      expect(
        (await pg.query("select * from public.job_sources")).rows,
      ).toHaveLength(2);
    } finally {
      await pg.close();
    }
  });
});

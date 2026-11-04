import { readFile, readdir } from "node:fs/promises";
import { database } from "../src/lib/database";
const sql = database();
try {
  await sql`create table if not exists public.job_radar_migrations (name text primary key, applied_at timestamptz not null default now())`;
  await sql`alter table public.job_radar_migrations enable row level security`;
  await sql`revoke all on public.job_radar_migrations from anon,authenticated`;
  for (const file of (await readdir("supabase/migrations"))
    .filter((f) => f.endsWith(".sql"))
    .sort()) {
    const name = file.replace(/\.sql$/, "");
    const prior =
      await sql`select name from public.job_radar_migrations where name=${name}`;
    if (prior.length) {
      console.log(`${name}: ya aplicada.`);
      continue;
    }
    if (name.endsWith("_initial")) {
      const existing = await sql`select to_regclass('public.jobs') as jobs`;
      if (existing[0].jobs)
        throw new Error(
          "Ya existe public.jobs; revisar manualmente antes de aplicar la migración.",
        );
    }
    await sql.unsafe(await readFile(`supabase/migrations/${file}`, "utf8"));
    await sql`insert into public.job_radar_migrations(name) values(${name})`;
    console.log(`${name}: aplicada a Supabase PostgreSQL.`);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : "Falló la migración.");
  process.exitCode = 1;
} finally {
  await sql.end();
}

import { database } from "./database";
import type {
  Job,
  JobSource,
  NormalizedJob,
  SyncRun,
  TrackingState,
} from "./domain";
import { normalizeJobUrl } from "./text";

export async function ingestJob(
  job: NormalizedJob,
): Promise<{ id: string; inserted: boolean }> {
  const sql = database();
  const urls = [
    ...new Set(
      [job.original_url, job.application_url]
        .map(normalizeJobUrl)
        .filter((v): v is string => v !== null),
    ),
  ];
  const rows = await sql<
    { job_id: string; inserted: boolean }[]
  >`select * from public.ingest_job(${sql.json(JSON.parse(JSON.stringify(job)))}, ${urls})`;
  return { id: rows[0].job_id, inserted: rows[0].inserted };
}
export async function ingestJobs(jobs: NormalizedJob[]): Promise<number> {
  if (!jobs.length) return 0;
  const sql = database();
  const payload = jobs.map((job) => ({
    job,
    urls: [
      ...new Set(
        [job.original_url, job.application_url]
          .map(normalizeJobUrl)
          .filter((v): v is string => v !== null),
      ),
    ],
  }));
  const result = await sql<
    { inserted: number }[]
  >`select count(*)::integer as inserted from jsonb_array_elements(${sql.json(JSON.parse(JSON.stringify(payload)))}) as item,
    lateral public.ingest_job(item->'job', array(select jsonb_array_elements_text(item->'urls'))) as outcome where outcome.inserted`;
  return result[0].inserted;
}
export async function listJobs(): Promise<Job[]> {
  const sql = database();
  const rows =
    await sql`select j.*, jsonb_build_object('status',t.status,'seen_at',t.seen_at) as tracking,
    (select jsonb_agg(jsonb_build_object('source',s.source,'external_id',s.external_id,
      'original_url',s.original_url,'application_url',s.application_url,'validity',s.validity,'last_checked_at',s.last_checked_at)
      order by s.source) from public.job_sources s where s.job_id=j.id) as sources
    from public.jobs j join public.job_tracking t on t.job_id=j.id where cardinality(j.profiles)>0 order by j.first_discovered_at desc`;
  // PostgreSQL returns Date for timestamps and JSON strings for nested timestamps; serialize consistently.
  return JSON.parse(JSON.stringify(rows)) as Job[];
}
export async function listRuns(): Promise<SyncRun[]> {
  return JSON.parse(
    JSON.stringify(
      await database()`select source,started_at,finished_at,status,received,candidates,inserted,errors,warnings,next_allowed_at from public.sync_runs order by started_at desc limit 20`,
    ),
  ) as SyncRun[];
}
export async function saveRun(run: SyncRun): Promise<void> {
  const sql = database();
  await sql`insert into public.sync_runs ${sql(run)}`;
}
export async function updateTracking(
  id: string,
  status?: TrackingState,
  seen = false,
): Promise<boolean> {
  const sql = database();
  const result =
    await sql`update public.job_tracking set status=coalesce(${status ?? null},status),
    seen_at=case when ${seen} then coalesce(seen_at,now()) else seen_at end, updated_at=now() where job_id=${id} returning job_id`;
  return result.length > 0;
}
export async function sourceHistory(
  source: string,
): Promise<(JobSource & { job_id: string })[]> {
  return JSON.parse(
    JSON.stringify(
      await database()`select source,external_id,job_id,original_url,application_url,validity,last_checked_at from public.job_sources where source=${source} order by last_checked_at asc`,
    ),
  );
}
export async function markMissing(source: string, ids: string[]) {
  const sql = database();
  // Absence in a bounded search or feed is not evidence of closure. Keep history and tracking.
  await sql`update public.job_sources set validity='unverified' where source=${source} and not(external_id=any(${ids})) and validity='active'`;
  await refreshValidity();
}
export async function setSourceValidity(
  source: string,
  id: string,
  validity: string,
) {
  await database()`update public.job_sources set validity=${validity},last_checked_at=now() where source=${source} and external_id=${id}`;
}
export async function refreshValidity() {
  const sql = database();
  await sql`update public.job_sources set validity='expired' where validity in ('active','unverified') and (normalized_payload->>'expires_at')::timestamptz < now()`;
  await sql`update public.jobs j set validity=case
    when exists(select 1 from public.job_sources s where s.job_id=j.id and s.validity='active') then 'active'
    when exists(select 1 from public.job_sources s where s.job_id=j.id and s.validity='unverified') then 'unverified'
    when exists(select 1 from public.job_sources s where s.job_id=j.id and s.validity='closed') then 'closed'
    else 'expired' end`;
}

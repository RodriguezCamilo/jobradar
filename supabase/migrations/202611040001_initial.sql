begin;

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  company text not null,
  title text not null,
  description text not null,
  original_url text not null,
  application_url text not null,
  published_at timestamptz,
  publication_note text,
  expires_at timestamptz,
  first_discovered_at timestamptz not null default now(),
  last_checked_at timestamptz not null default now(),
  employment_type text,
  modality text not null check (modality in ('remote','hybrid','onsite')),
  location text not null,
  countries text[],
  timezone_restrictions jsonb not null default '[]',
  salary jsonb not null default '{}',
  profiles text[] not null check (profiles <@ array['web','game_dev']::text[]),
  eligibility text not null check (eligibility in ('aceptable','revisar','descartar')),
  eligibility_reason text not null,
  technical_fit text not null check (technical_fit in ('compatible','revisar')),
  technical_reasons text[] not null default '{}',
  technologies text[] not null default '{}',
  validity text not null check (validity in ('active','unverified','closed','expired'))
);

create table public.job_sources (
  source text not null check (source in ('himalayas','remotive')),
  external_id text not null,
  job_id uuid not null references public.jobs(id) on delete cascade,
  original_url text not null,
  application_url text not null,
  validity text not null check (validity in ('active','unverified','closed','expired')),
  first_discovered_at timestamptz not null default now(),
  last_checked_at timestamptz not null default now(),
  normalized_payload jsonb not null,
  primary key (source, external_id)
);
create index job_sources_job_idx on public.job_sources(job_id);
create table public.job_links (
  normalized_url text primary key,
  job_id uuid not null references public.jobs(id) on delete cascade
);
create table public.job_tracking (
  job_id uuid primary key references public.jobs(id) on delete cascade,
  status text not null default 'nueva' check (status in ('nueva','guardada','postulada','en_proceso','rechazada','descartada')),
  seen_at timestamptz,
  updated_at timestamptz not null default now()
);
create table public.sync_runs (
  id uuid primary key default gen_random_uuid(),
  source text not null check (source in ('himalayas','remotive')),
  started_at timestamptz not null,
  finished_at timestamptz,
  status text not null check (status in ('success','partial','error','cached')),
  received integer not null default 0,
  candidates integer not null default 0,
  inserted integer not null default 0,
  errors text[] not null default '{}',
  warnings text[] not null default '{}',
  next_allowed_at timestamptz not null
);
create index sync_runs_recent_idx on public.sync_runs(started_at desc);
create index jobs_profiles_idx on public.jobs using gin(profiles);
create index jobs_discovered_idx on public.jobs(first_discovered_at desc);

-- Small personal database: serialize ingestion transactions to make source-ID and
-- URL identity checks atomic even when independent callers race.
create function public.ingest_job(p_job jsonb, p_urls text[])
returns table(job_id uuid, inserted boolean)
language plpgsql set search_path = public, pg_temp as $$
declare
  v_id uuid;
  v_inserted boolean := false;
  v_existing public.jobs;
  v_row public.jobs;
begin
  perform pg_advisory_xact_lock(82547011);
  select s.job_id into v_id from public.job_sources s
    where s.source = p_job->>'source' and s.external_id = p_job->>'external_id';
  if v_id is null then
    select l.job_id into v_id from public.job_links l where l.normalized_url = any(p_urls) limit 1;
  end if;
  if v_id is null then
    v_id := gen_random_uuid();
    v_inserted := true;
    select * into v_row from jsonb_populate_record(null::public.jobs,
      p_job || jsonb_build_object('id',v_id,'first_discovered_at',now(),'last_checked_at',now()));
    insert into public.jobs select v_row.*;
    insert into public.job_tracking(job_id) values(v_id);
  else
    select * into v_existing from public.jobs where id = v_id;
    select * into v_row from jsonb_populate_record(null::public.jobs,
      p_job || jsonb_build_object('id',v_id,'first_discovered_at',v_existing.first_discovered_at,'last_checked_at',now()));
    update public.jobs set
      company=v_row.company,title=v_row.title,description=v_row.description,
      original_url=v_row.original_url,application_url=v_row.application_url,
      published_at=v_row.published_at,publication_note=v_row.publication_note,expires_at=v_row.expires_at,
      last_checked_at=now(),employment_type=v_row.employment_type,modality=v_row.modality,
      location=v_row.location,countries=v_row.countries,timezone_restrictions=v_row.timezone_restrictions,
      salary=v_row.salary,profiles=array(select distinct unnest(v_row.profiles || v_existing.profiles)),
      eligibility=v_row.eligibility,eligibility_reason=v_row.eligibility_reason,
      technical_fit=v_row.technical_fit,technical_reasons=v_row.technical_reasons,
      technologies=v_row.technologies,validity=v_row.validity
      where id=v_id;
  end if;
  insert into public.job_sources(source,external_id,job_id,original_url,application_url,validity,normalized_payload)
    values(p_job->>'source',p_job->>'external_id',v_id,p_job->>'original_url',p_job->>'application_url',p_job->>'validity',p_job)
    on conflict(source,external_id) do update set
      original_url=excluded.original_url,application_url=excluded.application_url,
      validity=excluded.validity,last_checked_at=now(),normalized_payload=excluded.normalized_payload;
  insert into public.job_links(normalized_url,job_id)
    select distinct u,v_id from unnest(p_urls) u on conflict(normalized_url) do nothing;
  -- Contradictory source evidence needs review; never silently choose the most permissive one.
  if (select count(distinct s.normalized_payload->>'eligibility') from public.job_sources s where s.job_id=v_id) > 1 then
    update public.jobs set eligibility='revisar',eligibility_reason='Las fuentes publican condiciones geográficas contradictorias; revisar cada enlace.' where id=v_id;
  end if;
  update public.jobs set validity=case
    when exists(select 1 from public.job_sources s where s.job_id=v_id and s.validity='active') then 'active'
    when exists(select 1 from public.job_sources s where s.job_id=v_id and s.validity='unverified') then 'unverified'
    else v_row.validity end where id=v_id;
  return query select v_id,v_inserted;
end $$;

-- No client access. The local Next.js server connects privately to PostgreSQL.
alter table public.jobs enable row level security;
alter table public.job_sources enable row level security;
alter table public.job_links enable row level security;
alter table public.job_tracking enable row level security;
alter table public.sync_runs enable row level security;
revoke all on public.jobs,public.job_sources,public.job_links,public.job_tracking,public.sync_runs from anon, authenticated;
revoke execute on function public.ingest_job(jsonb,text[]) from public,anon,authenticated;

commit;

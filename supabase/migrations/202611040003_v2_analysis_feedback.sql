begin;
alter table public.job_sources drop constraint job_sources_source_check;
alter table public.job_sources add constraint job_sources_source_check check(source in ('himalayas','remotive','getonbrd'));
alter table public.sync_runs drop constraint sync_runs_source_check;
alter table public.sync_runs add constraint sync_runs_source_check check(source in ('himalayas','remotive','getonbrd'));

create table public.job_feedback (
  job_id uuid primary key references public.jobs(id) on delete cascade,
  rating text not null default 'sin_evaluar' check(rating in ('sin_evaluar','me_interesa','no_encaja')),
  reason text check(reason in ('idioma','experiencia','stack','ubicacion','seniority','remuneracion','otro')),
  updated_at timestamptz not null default now(),
  check(rating <> 'sin_evaluar' or reason is null)
);
create table public.job_analyses (
  job_id uuid not null references public.jobs(id) on delete cascade,
  content_hash text not null,
  prompt_version text not null,
  model text not null,
  status text not null check(status in ('pending','success','error')),
  result jsonb,
  input_tokens integer not null default 0 check(input_tokens>=0),
  output_tokens integer not null default 0 check(output_tokens>=0),
  error text,
  retry_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key(job_id,content_hash,prompt_version,model),
  check(status <> 'success' or result is not null)
);
create table public.analysis_control (
  provider text primary key check(provider='groq'),
  retry_at timestamptz
);
insert into public.analysis_control(provider) values('groq');
create index job_analyses_recent_idx on public.job_analyses(job_id,updated_at desc);
alter table public.job_feedback enable row level security;
alter table public.job_analyses enable row level security;
alter table public.analysis_control enable row level security;
revoke all on public.job_feedback,public.job_analyses,public.analysis_control from anon,authenticated;
commit;

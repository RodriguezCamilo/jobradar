-- MANUAL ONLY. Export feedback/analyses before rollback: dropping their tables
-- discards V2-only data. Existing jobs, source associations and tracking are preserved.
begin;
do $$ begin
  if exists(select 1 from public.job_sources where source='getonbrd') or exists(select 1 from public.sync_runs where source='getonbrd') then
    raise exception 'Hay registros de Get on Board. Conservar la restricción ampliada o exportarlos y decidir su destino antes de volver a V1.';
  end if;
end $$;
drop table public.job_feedback,public.job_analyses,public.analysis_control;
alter table public.job_sources drop constraint job_sources_source_check;
alter table public.job_sources add constraint job_sources_source_check check(source in ('himalayas','remotive'));
alter table public.sync_runs drop constraint sync_runs_source_check;
alter table public.sync_runs add constraint sync_runs_source_check check(source in ('himalayas','remotive'));
delete from public.job_radar_migrations where name='202611040003_v2_analysis_feedback';
commit;

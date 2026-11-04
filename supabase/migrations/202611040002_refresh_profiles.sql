begin;
-- Recompute profile membership from current source evidence, rather than retaining
-- an old classification forever when a source record changes.
create function public.refresh_job_profiles() returns trigger
language plpgsql set search_path=public,pg_temp as $$
begin
  update public.jobs set profiles=array(
    select distinct jsonb_array_elements_text(s.normalized_payload->'profiles')
    from public.job_sources s where s.job_id=new.job_id
  ) where id=new.job_id;
  return new;
end $$;
create trigger job_profiles_after_source_update after insert or update of normalized_payload
  on public.job_sources for each row execute function public.refresh_job_profiles();
revoke execute on function public.refresh_job_profiles() from public,anon,authenticated;
commit;

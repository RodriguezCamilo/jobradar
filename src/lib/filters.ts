import type { Job, Profile } from "./domain";
export interface Filters {
  profile: Profile;
  search: string;
  source: string;
  eligibility: string;
  days: string;
  tracking: string;
  sort: string;
  validity: string;
}
export function filterJobs(
  jobs: Job[],
  filters: Filters,
  now = Date.now(),
): Job[] {
  return jobs
    .filter((job) => {
      if (!job.profiles.includes(filters.profile)) return false;
      if (
        filters.search &&
        !`${job.title} ${job.company}`
          .toLocaleLowerCase()
          .includes(filters.search.trim().toLocaleLowerCase())
      )
        return false;
      if (
        filters.source !== "all" &&
        !job.sources.some((s) => s.source === filters.source)
      )
        return false;
      if (
        filters.eligibility === "potential" &&
        job.eligibility === "descartar"
      )
        return false;
      if (
        !["all", "potential"].includes(filters.eligibility) &&
        job.eligibility !== filters.eligibility
      )
        return false;
      if (filters.tracking === "unseen" && job.tracking.seen_at) return false;
      if (
        !["all", "unseen"].includes(filters.tracking) &&
        job.tracking.status !== filters.tracking
      )
        return false;
      if (
        filters.days !== "all" &&
        (!job.published_at ||
          new Date(job.published_at).getTime() <
            now - Number(filters.days) * 86400000)
      )
        return false;
      if (
        filters.validity === "open" &&
        !["active", "unverified"].includes(job.validity)
      )
        return false;
      if (
        !["all", "open"].includes(filters.validity) &&
        job.validity !== filters.validity
      )
        return false;
      return true;
    })
    .sort((a, b) => {
      if (filters.sort === "fit" && a.technical_fit !== b.technical_fit)
        return a.technical_fit === "compatible" ? -1 : 1;
      const date = (job: Job) =>
        filters.sort === "published"
          ? job.published_at
          : job.first_discovered_at;
      return (
        (date(b) ? new Date(date(b)!).getTime() : 0) -
          (date(a) ? new Date(date(a)!).getTime() : 0) ||
        a.id.localeCompare(b.id)
      );
    });
}

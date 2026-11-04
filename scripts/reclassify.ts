import { classifyJob } from "../src/lib/classification";
import { readSnapshot, writeSnapshot } from "../src/lib/cache";
import { database, hasDatabase } from "../src/lib/database";
import { ingestJobs, sourceHistory } from "../src/lib/repository";
import { sources } from "../src/lib/domain";
try {
  for (const source of sources) {
    const snapshot = await readSnapshot(source);
    if (!snapshot) continue;
    const known = hasDatabase()
      ? new Set((await sourceHistory(source)).map((s) => s.external_id))
      : new Set<string>();
    snapshot.jobs = snapshot.jobs.map(classifyJob);
    snapshot.run.candidates = snapshot.jobs.filter(
      (j) => j.profiles.length,
    ).length;
    await writeSnapshot(source, snapshot);
    if (hasDatabase())
      await ingestJobs(
        snapshot.jobs.filter(
          (j) => j.profiles.length || known.has(j.external_id),
        ),
      );
    console.log(
      `${source}: ${snapshot.run.candidates} candidatas reclasificadas sin consultas externas.`,
    );
  }
} finally {
  if (hasDatabase()) await database().end();
}

import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { NormalizedJob, Source, SyncRun } from "./domain";
const directory = path.join(process.cwd(), ".cache");
export interface Snapshot {
  jobs: NormalizedJob[];
  run: SyncRun;
}
export async function readSnapshot(source: Source): Promise<Snapshot | null> {
  try {
    return JSON.parse(
      await readFile(path.join(directory, `${source}.json`), "utf8"),
    ) as Snapshot;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}
export async function writeSnapshot(source: Source, value: Snapshot) {
  await mkdir(directory, { recursive: true });
  const destination = path.join(directory, `${source}.json`);
  const temp = `${destination}.${process.pid}.tmp`;
  await writeFile(temp, JSON.stringify(value), "utf8");
  await rename(temp, destination);
}

import { beforeEach, describe, expect, it, vi } from "vitest";
import { synchronize } from "../src/lib/sync";
import { readSnapshot } from "../src/lib/cache";
import { sourceHistory, ingestJobs } from "../src/lib/repository";
import { himalayas } from "../src/lib/connectors/himalayas";
import { remotive } from "../src/lib/connectors/remotive";
import type { Source, SyncRun } from "../src/lib/domain";
import { fixture } from "./fixtures";
vi.mock("node:fs/promises", () => ({
  mkdir: vi.fn(),
  open: vi.fn(async () => ({ writeFile: vi.fn(), close: vi.fn() })),
  unlink: vi.fn(),
}));
vi.mock("../src/lib/cache", () => ({
  readSnapshot: vi.fn(),
  writeSnapshot: vi.fn(),
}));
vi.mock("../src/lib/database", () => ({ hasDatabase: () => true }));
vi.mock("../src/lib/repository", () => ({
  sourceHistory: vi.fn(),
  ingestJobs: vi.fn(),
  markMissing: vi.fn(),
  refreshValidity: vi.fn(),
  saveRun: vi.fn(),
  setSourceValidity: vi.fn(),
}));
vi.mock("../src/lib/connectors/himalayas", () => ({
  himalayas: { fetchJobs: vi.fn() },
  normalizeHimalayas: vi.fn(),
}));
vi.mock("../src/lib/connectors/remotive", () => ({
  remotive: { fetchJobs: vi.fn() },
}));
const run = (
  source: Source,
  status: SyncRun["status"] = "success",
): SyncRun => ({
  source,
  started_at: new Date().toISOString(),
  finished_at: new Date().toISOString(),
  next_allowed_at: new Date(Date.now() + 86400000).toISOString(),
  status,
  received: 1,
  candidates: 1,
  inserted: 1,
  errors: status === "error" ? ["HTTP 429"] : [],
  warnings: [],
});
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(readSnapshot).mockImplementation(async (source) => ({
    jobs: [fixture({ source })],
    run: run(source),
  }));
  vi.mocked(sourceHistory).mockResolvedValue([
    {
      source: "himalayas",
      external_id: "test-1",
      job_id: "id",
      original_url: "https://example.test/123",
      application_url: "https://example.test/123",
      validity: "closed",
      last_checked_at: new Date().toISOString(),
    },
  ]);
  vi.mocked(ingestJobs).mockResolvedValue(0);
});
describe("sincronización manual y caché durable", () => {
  it("no consulta las fuentes ni reingresa registros conocidos durante cooldown", async () => {
    const result = await synchronize();
    expect(himalayas.fetchJobs).not.toHaveBeenCalled();
    expect(remotive.fetchJobs).not.toHaveBeenCalled();
    expect(ingestJobs).toHaveBeenCalledTimes(3);
    expect(
      vi.mocked(ingestJobs).mock.calls.every(([jobs]) => jobs.length === 0),
    ).toBe(true);
    expect(result.every((r) => r.status === "cached" && r.inserted === 0)).toBe(
      true,
    );
  });
  it("no disfraza errores previos como una consulta exitosa", async () => {
    vi.mocked(readSnapshot).mockImplementation(async (source) => ({
      jobs: [],
      run: run(source, "error"),
    }));
    const result = await synchronize();
    expect(
      result.every(
        (r) => r.status === "error" && r.errors.includes("HTTP 429"),
      ),
    ).toBe(true);
    expect(himalayas.fetchJobs).not.toHaveBeenCalled();
  });
  it("permite importar la caché al conectar una base vacía", async () => {
    vi.mocked(sourceHistory).mockResolvedValue([]);
    vi.mocked(ingestJobs).mockResolvedValue(1);
    const result = await synchronize();
    expect(result.every((r) => r.inserted === 1)).toBe(true);
    expect(
      vi.mocked(ingestJobs).mock.calls.every(([jobs]) => jobs.length === 1),
    ).toBe(true);
    expect(himalayas.fetchJobs).not.toHaveBeenCalled();
  });
});

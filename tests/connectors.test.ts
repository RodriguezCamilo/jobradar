import { describe, it, expect, vi, beforeEach } from "vitest";
import config from "../config/searches.json";
import { himalayas } from "../src/lib/connectors/himalayas";
import { remotive } from "../src/lib/connectors/remotive";
import { fetchJson, ApiError } from "../src/lib/connectors/http";
vi.mock("../src/lib/connectors/http", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("../src/lib/connectors/http")>();
  return {
    ...original,
    fetchJson: vi.fn(),
    pause: vi.fn().mockResolvedValue(undefined),
  };
});
const raw = {
  guid: "https://himalayas.app/companies/test/jobs/unity-1",
  title: "Unity Developer",
  companyName: "Test",
  description: "Unity C#",
  applicationLink:
    "https://himalayas.app/companies/test/jobs/unity-1?utm_source=api",
  locationRestrictions: [],
};
beforeEach(() => {
  vi.mocked(fetchJson).mockReset();
});
describe("conectores con transporte aislado", () => {
  it("pagina búsquedas hasta página vacía, sin detenerse por una página corta", async () => {
    vi.mocked(fetchJson).mockImplementation(async (url) => ({
      jobs: new URL(url).searchParams.get("page") === "1" ? [raw] : [],
    }));
    const result = await himalayas.fetchJobs();
    expect(result.jobs).toHaveLength(1);
    expect(result.complete).toBe(true);
    const urls = vi.mocked(fetchJson).mock.calls.map(([url]) => new URL(url));
    expect(urls.some((u) => u.searchParams.get("page") === "2")).toBe(true);
    expect(
      urls.some((u) => u.searchParams.get("country") === config.country),
    ).toBe(true);
    expect(urls.some((u) => !u.searchParams.has("country"))).toBe(true);
    expect(urls.every((u) => u.pathname === "/jobs/api/search")).toBe(true);
  });
  it("registra truncamiento y deduplica por GUID entre consultas", async () => {
    vi.mocked(fetchJson).mockResolvedValue({ jobs: [raw] });
    const result = await himalayas.fetchJobs();
    expect(result.jobs).toHaveLength(1);
    expect(result.complete).toBe(false);
    expect(result.warnings.length).toBeGreaterThan(0);
  });
  it("se detiene ante 429 y conserva la fecha de reintento", async () => {
    vi.mocked(fetchJson).mockRejectedValue(
      new ApiError(429, "2026-11-07T00:00:00.000Z", "HTTP 429"),
    );
    const result = await himalayas.fetchJobs();
    expect(fetchJson).toHaveBeenCalledOnce();
    expect(result.errors).toEqual(["HTTP 429"]);
    expect(result.retryAt).toBe("2026-11-07T00:00:00.000Z");
  });
  it("Remotive consulta una sola vez el feed completo y omite registros inválidos", async () => {
    vi.mocked(fetchJson).mockResolvedValue({ jobs: [{ broken: true }] });
    const result = await remotive.fetchJobs();
    expect(fetchJson).toHaveBeenCalledExactlyOnceWith(
      "https://remotive.com/api/remote-jobs",
    );
    expect(result.received).toBe(1);
    expect(result.errors).toHaveLength(1);
    expect(result.complete).toBe(false);
  });
});

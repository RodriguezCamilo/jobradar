import { describe, it, expect, vi, afterEach } from "vitest";
import { filterJobs, type Filters } from "../src/lib/filters";
import { assertLocalRequest } from "../src/lib/security";
import {
  ApiError,
  fetchJson,
  retryAfterDate,
} from "../src/lib/connectors/http";
import { jobFixture } from "./fixtures";
const filters: Filters = {
  profile: "web",
  search: "",
  source: "all",
  eligibility: "all",
  days: "all",
  tracking: "all",
  sort: "published",
  validity: "all",
};
describe("pestañas y filtros", () => {
  const jobs = [
    jobFixture(),
    jobFixture({
      id: "game",
      title: "Unity Developer",
      profiles: ["game_dev"],
    }),
    jobFixture({ id: "both", profiles: ["web", "game_dev"] }),
  ];
  it("cada pestaña incluye el perfil y las oportunidades compartidas", () => {
    expect(filterJobs(jobs, filters).map((j) => j.id)).toEqual([
      "both",
      jobs[0].id,
    ]);
    expect(
      filterJobs(jobs, { ...filters, profile: "game_dev" }).map((j) => j.id),
    ).toEqual(["both", "game"]);
  });
  it("busca empresa/título y filtra estado personal separado de elegibilidad", () => {
    expect(
      filterJobs(jobs, { ...filters, search: "unity", profile: "game_dev" }),
    ).toHaveLength(1);
    expect(
      filterJobs(
        [
          jobFixture({
            eligibility: "descartar",
            tracking: { status: "guardada", seen_at: null },
          }),
        ],
        { ...filters, tracking: "guardada" },
      ),
    ).toHaveLength(1);
  });
});
describe("protección de acciones administrativas", () => {
  it("permite mutaciones locales del mismo origen", () =>
    expect(
      assertLocalRequest(
        new Request("http://127.0.0.1:3000/api/sync", {
          headers: { origin: "http://127.0.0.1:3000" },
        }),
        true,
      ),
    ).toBeNull());
  it.each(["https://evil.test", "null", ""])("rechaza origen %s", (origin) =>
    expect(
      assertLocalRequest(
        new Request("http://localhost:3000/api/sync", { headers: { origin } }),
        true,
      )?.status,
    ).toBe(403),
  );
  it("falla cerrada fuera de localhost", () =>
    expect(
      assertLocalRequest(new Request("https://example.com/api/jobs"))?.status,
    ).toBe(403));
  it("admite el Host local aunque Next canonicalice su URL interna", () =>
    expect(
      assertLocalRequest(
        new Request("http://localhost:3000/api/sync", {
          headers: { host: "127.0.0.1:3000", origin: "http://127.0.0.1:3000" },
        }),
        true,
      ),
    ).toBeNull());
  it("rechaza Host externo aunque la URL interna sea local", () =>
    expect(
      assertLocalRequest(
        new Request("http://localhost:3000/api/sync", {
          headers: { host: "evil.test", origin: "http://evil.test" },
        }),
        true,
      )?.status,
    ).toBe(403));
});
describe("errores de API", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("429 conserva Retry-After sin reintentar en bucle", async () => {
    const fetch = vi.fn().mockResolvedValue(
      new Response("rate limited", {
        status: 429,
        headers: { "Retry-After": "120" },
      }),
    );
    vi.stubGlobal("fetch", fetch);
    await expect(fetchJson("https://example.test")).rejects.toMatchObject({
      status: 429,
      retryAt: expect.any(String),
    });
    expect(fetch).toHaveBeenCalledOnce();
  });
  it("interpreta Retry-After como segundos o fecha HTTP", () => {
    expect(retryAfterDate("120", 0)).toBe("1970-01-01T00:02:00.000Z");
    expect(retryAfterDate("Wed, 04 Nov 2026 12:00:00 GMT", 0)).toBe(
      "2026-11-04T12:00:00.000Z",
    );
  });
  it("errores HTTP no exponen el cuerpo remoto", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("private text", { status: 503 })),
    );
    await expect(fetchJson("https://example.test")).rejects.toBeInstanceOf(
      ApiError,
    );
    await expect(fetchJson("https://example.test")).rejects.toThrow(
      "API HTTP 503",
    );
  });
});

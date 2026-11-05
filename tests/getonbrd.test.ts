import { describe, it, expect, vi, afterEach } from "vitest";
import { normalizeGetonbrd, getonbrd } from "../src/lib/connectors/getonbrd";
import { fetchJson } from "../src/lib/connectors/http";
vi.mock("../src/lib/connectors/http", async (original) => ({
  ...(await original<typeof import("../src/lib/connectors/http")>()),
  fetchJson: vi.fn(),
  pause: vi.fn().mockResolvedValue(undefined),
}));
const raw = {
  id: "react-test",
  links: { public_url: "https://www.getonbrd.com/jobs/react-test" },
  attributes: {
    title: "React Developer",
    description: "React and TypeScript skills. English documentation reading.",
    projects: "We build software.",
    functions: "Build React products.",
    desirable: "Unity",
    remote: true,
    remote_modality: "fully_remote",
    remote_zone: null,
    countries: ["Remote"],
    lang: "es",
    min_salary: 2000,
    max_salary: 3000,
    published_at: 1793797210,
    company: { data: { attributes: { name: "Test company" } } },
  },
};
afterEach(() => vi.mocked(fetchJson).mockReset());
describe("Get on Board", () => {
  it("normaliza campos reales sin inferir geografía/moneda/idioma del equipo", () => {
    const job = normalizeGetonbrd(raw);
    expect(job.source).toBe("getonbrd");
    expect(job.eligibility).toBe("revisar");
    expect(job.application_url).toBe(raw.links.public_url);
    expect(job.salary).toMatchObject({
      min: 2000,
      max: 3000,
      currency: null,
      period: null,
    });
    expect(job.language).toMatchObject({
      work_language: "spanish_likely",
      confidence: "low",
    });
    expect(job.requirements?.desirable).toBe("Unity");
  });
  it("Argentina declarada admite geografía independiente del idioma", () =>
    expect(
      normalizeGetonbrd({
        ...raw,
        attributes: { ...raw.attributes, countries: ["Argentina"], lang: "en" },
      }),
    ).toMatchObject({
      eligibility: "aceptable",
      language: { work_language: "unknown" },
    }));
  it("remoto local de Chile excluye Argentina", () =>
    expect(
      normalizeGetonbrd({
        ...raw,
        attributes: {
          ...raw.attributes,
          remote_modality: "locally_remote",
          countries: ["Chile"],
        },
      }).eligibility,
    ).toBe("descartar"));
  it("rechaza enlaces de otra plataforma o falta de empresa", () => {
    expect(() =>
      normalizeGetonbrd({ ...raw, links: { public_url: "https://evil.test" } }),
    ).toThrow();
    expect(() =>
      normalizeGetonbrd({
        ...raw,
        attributes: { ...raw.attributes, company: { data: { id: 1 } } },
      }),
    ).toThrow();
  });
  it("pagina con meta y deduplica IDs entre términos sin cortar una página corta", async () => {
    vi.mocked(fetchJson).mockImplementation(async (value) => {
      const page = Number(new URL(value).searchParams.get("page"));
      return { data: [raw], meta: { page, total_pages: 2, per_page: 30 } };
    });
    const result = await getonbrd.fetchJobs();
    expect(result.jobs).toHaveLength(1);
    expect(result.errors).toHaveLength(0);
    expect(
      vi
        .mocked(fetchJson)
        .mock.calls.some(
          ([url]) => new URL(url).searchParams.get("page") === "2",
        ),
    ).toBe(true);
    expect(
      vi
        .mocked(fetchJson)
        .mock.calls.every(([url]) => !new URL(url).searchParams.has("remote")),
    ).toBe(true);
  });
  it("detecta paginación repetida y no entra en un bucle", async () => {
    vi.mocked(fetchJson).mockResolvedValue({
      data: [raw],
      meta: { page: 1, total_pages: 2, per_page: 30 },
    });
    const result = await getonbrd.fetchJobs();
    expect(result.errors.join(" ")).toContain("página diferente");
    expect(fetchJson).toHaveBeenCalledTimes(2);
  });
});

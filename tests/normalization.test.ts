import { describe, it, expect } from "vitest";
import { normalizeHimalayas } from "../src/lib/connectors/himalayas";
import { normalizeRemotive } from "../src/lib/connectors/remotive";
import { normalizeJobUrl, plainText } from "../src/lib/text";

const himalayasRaw = {
  guid: "https://himalayas.app/companies/test/jobs/react-1",
  applicationLink:
    "https://himalayas.app/companies/test/jobs/react-1?utm_source=api",
  companyName: "Test",
  title: "React Developer",
  description: "<p>React &amp; TypeScript</p>",
  minSalary: 25,
  maxSalary: 60,
  salaryPeriod: "hourly",
  currency: "USD",
};
describe("contratos externos", () => {
  it("admite países como strings y objetos sin perder enlaces", () => {
    for (const restrictions of [
      ["Argentina"],
      [{ alpha2: "AR", name: "Argentina" }],
    ]) {
      const normalized = normalizeHimalayas({
        ...himalayasRaw,
        locationRestrictions: restrictions,
      });
      expect(normalized.application_url).toBe(himalayasRaw.applicationLink);
      expect(normalized.eligibility).toBe("aceptable");
      expect(normalized.salary.period).toBe("hourly");
      expect(normalized.salary.min).toBe(25);
    }
  });
  it("distingue campo geográfico ausente de array mundial vacío", () => {
    expect(normalizeHimalayas(himalayasRaw).eligibility).toBe("revisar");
    expect(
      normalizeHimalayas({ ...himalayasRaw, locationRestrictions: [] })
        .eligibility,
    ).toBe("aceptable");
  });
  it("Remotive usa su URL original y conserva salario sin inventar moneda", () => {
    const raw = {
      id: 123,
      title: "Unity Developer",
      company_name: "Test",
      url: "https://remotive.com/remote-jobs/test-123",
      description: "Unity",
      salary: "$10-20",
      publication_date: "2026-11-01T10:22:33",
    };
    const normalized = normalizeRemotive(raw);
    expect(normalized.application_url).toBe(raw.url);
    expect(normalized.salary.currency).toBeNull();
    expect(normalized.salary.text).toBe("$10-20");
    expect(normalized.published_at).toBe("2026-11-01T12:00:00.000Z");
    expect(normalized.eligibility).toBe("revisar");
  });
  it("rechaza protocolos inseguros y campos obligatorios ausentes", () => {
    expect(() =>
      normalizeHimalayas({
        ...himalayasRaw,
        applicationLink: "javascript:alert(1)",
      }),
    ).toThrow();
    expect(() => normalizeRemotive({ id: 1 })).toThrow();
  });
  it("HTML se presenta como texto seguro", () => {
    expect(plainText("<script>secret()</script><p>A &amp; B</p>")).toBe(
      "A & B",
    );
  });
});
describe("identidad conservadora por URL", () => {
  it("elimina tracking solo para identidad", () =>
    expect(
      normalizeJobUrl(
        "https://www.example.test/jobs/123/?utm_source=x&gh_src=1#apply",
      ),
    ).toBe("https://example.test/jobs/123"));
  it("conserva IDs de vacante en la query", () =>
    expect(
      normalizeJobUrl("https://example.test/apply?job_id=1&utm_source=x"),
    ).not.toBe(normalizeJobUrl("https://example.test/apply?job_id=2")));
  it("no fusiona páginas genéricas", () => {
    expect(normalizeJobUrl("https://example.test/careers")).toBeNull();
    expect(normalizeJobUrl("https://example.test")).toBeNull();
  });
});

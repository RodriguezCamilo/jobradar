import { describe, it, expect } from "vitest";
import { classifyLanguage, detectAdLanguage } from "../src/lib/language";
import { filterJobs } from "../src/lib/filters";
import { jobFixture } from "./fixtures";
describe("idioma de anuncio y trabajo son independientes", () => {
  it.each([
    [
      "Our team builds software with React. We work and communicate in Spanish daily.",
      "spanish_confirmed",
    ],
    [
      "Buscamos experiencia en React. Inglés fluido obligatorio para reuniones diarias con clientes.",
      "english_required",
    ],
    [
      "Trabajo remoto LATAM. Buscamos experiencia en React para nuestro equipo.",
      "unknown",
    ],
    [
      "English is a plus, not required. Build our React products with the team.",
      "unknown",
    ],
    [
      "Inglés avanzado para lectura de documentación técnica. Trabajo remoto.",
      "unknown",
    ],
    [
      "We require fluent Spanish communication with our team.",
      "spanish_confirmed",
    ],
    ["Spanish speaking preferred for our team.", "spanish_likely"],
    [
      "Nuestro equipo se comunica en español. Fluent English is required for daily meetings.",
      "unknown",
    ],
    ["React, Unity, C#", "unknown"],
  ])("%s", (text, workLanguage) =>
    expect(classifyLanguage(text).work_language).toBe(workLanguage),
  );
  it("detecta texto inglés aunque el trabajo sea español", () => {
    const result = classifyLanguage(
      "Our team builds products with the latest tools. You will work with our engineers. We communicate in Spanish daily.",
    );
    expect(result.ad_language).toBe("en");
    expect(result.work_language).toBe("spanish_confirmed");
  });
  it("idioma de postulación es solo un indicio y no prueba del equipo", () => {
    expect(classifyLanguage("React", "es")).toMatchObject({
      work_language: "spanish_likely",
      confidence: "low",
    });
    expect(classifyLanguage("React", "en").work_language).toBe("unknown");
  });
  it("no deduce idioma del país o la fuente", () =>
    expect(
      classifyLanguage("Argentina LATAM Chile Mexico Remote").work_language,
    ).toBe("unknown"));
  it("no identifica un idioma a partir de texto insuficiente", () =>
    expect(detectAdLanguage("React API SQL").ad_language).toBe("unknown"));
});
describe("orden recomendado", () => {
  const filters = {
    profile: "web" as const,
    search: "",
    source: "all",
    eligibility: "all",
    days: "all",
    tracking: "all",
    sort: "fit",
    validity: "all",
    language: "prefer_spanish" as const,
  };
  const spanish = jobFixture({
    id: "spanish",
    language: classifyLanguage("Nuestro equipo se comunica en español."),
    published_at: "2026-10-01T12:00:00.000Z",
  });
  const english = jobFixture({
    id: "english",
    language: classifyLanguage("Fluent English is required for meetings."),
    published_at: "2026-11-04T12:00:00.000Z",
  });
  const unknown = jobFixture({
    id: "unknown",
    language: classifyLanguage("Remote LATAM"),
    published_at: "2026-11-01T12:00:00.000Z",
  });
  it("prioriza español sin ocultar ambiguas o inglés", () =>
    expect(
      filterJobs([english, unknown, spanish], filters).map((j) => j.id),
    ).toEqual(["spanish", "unknown", "english"]));
  it("geografía tiene precedencia sobre idioma", () =>
    expect(
      filterJobs(
        [spanish, jobFixture({ id: "ar", eligibility: "aceptable" })],
        { ...filters },
        Date.now(),
      )[0].eligibility,
    ).toBe("aceptable"));
  it("solo español confirmado es un filtro explícito", () =>
    expect(
      filterJobs([spanish, unknown, english], {
        ...filters,
        language: "spanish_only",
      }).map((j) => j.id),
    ).toEqual(["spanish"]));
  it("permite publicación reciente sin imponer prioridad de idioma", () =>
    expect(
      filterJobs([spanish, unknown, english], {
        ...filters,
        sort: "published",
      }).map((j) => j.id),
    ).toEqual(["english", "unknown", "spanish"]));
});

import { describe, it, expect } from "vitest";
import { filterJobs } from "../src/lib/filters";
import { classifyLanguage } from "../src/lib/language";
import { jobFixture } from "./fixtures";
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
describe("controles independientes de idioma", () => {
  const spanishAd = jobFixture({
    id: "es-ad",
    language: { ...classifyLanguage("Remote"), ad_language: "es" },
  });
  const englishAd = jobFixture({
    id: "en-ad",
    language: {
      ...classifyLanguage("Nuestro equipo se comunica en español."),
      ad_language: "en",
    },
  });
  it("permite activar y desactivar anuncios en español/inglés", () => {
    expect(
      filterJobs([spanishAd, englishAd], {
        ...filters,
        adLanguages: ["es"],
      }).map((j) => j.id),
    ).toEqual(["es-ad"]);
    expect(
      filterJobs([spanishAd, englishAd], {
        ...filters,
        adLanguages: ["en"],
      }).map((j) => j.id),
    ).toEqual(["en-ad"]);
  });
  it("todos los idiomas pueden desactivarse sin reclasificar una oferta", () => {
    expect(
      filterJobs([spanishAd, englishAd], { ...filters, adLanguages: [] }),
    ).toHaveLength(0);
    expect(spanishAd.language.work_language).toBe("unknown");
  });
  it("el inglés laboral obligatorio tiene un control independiente del anuncio", () => {
    const required = jobFixture({
      id: "required",
      language: {
        ...classifyLanguage("Fluent English required for daily meetings."),
        ad_language: "es",
      },
    });
    expect(
      filterJobs([spanishAd, required], {
        ...filters,
        adLanguages: ["es"],
        includeEnglishRequired: false,
      }).map((j) => j.id),
    ).toEqual(["es-ad"]);
  });
  it("geografía precede al idioma en el orden recomendado", () => {
    const ambiguous = jobFixture({
      ...englishAd,
      id: "ambiguous",
      eligibility: "revisar",
    });
    expect(
      filterJobs([ambiguous, spanishAd], filters).map((j) => j.id),
    ).toEqual(["es-ad", "ambiguous"]);
  });
});

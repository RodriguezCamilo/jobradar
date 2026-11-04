import { describe, it, expect } from "vitest";
import {
  classifyGeography,
  classifyTechnical,
} from "../src/lib/classification";
import { fixture } from "./fixtures";

describe("elegibilidad geográfica separada de afinidad técnica", () => {
  it.each([
    ["Argentina explícita", { countries: ["Argentina"] }, "aceptable"],
    [
      "mundial documentado por Himalayas",
      { countries: [], location: "Worldwide" },
      "aceptable",
    ],
    [
      "Remote no significa mundial",
      { source: "remotive", countries: null, location: "Remote" },
      "revisar",
    ],
    [
      "Remotive mundial",
      { source: "remotive", countries: null, location: "Worldwide" },
      "aceptable",
    ],
    [
      "LATAM",
      { source: "remotive", countries: null, location: "LATAM" },
      "aceptable",
    ],
    [
      "lista excluyente",
      { countries: ["United States", "Canada"] },
      "descartar",
    ],
    [
      "Europa restringida",
      { source: "remotive", countries: null, location: "Europe" },
      "descartar",
    ],
    [
      "mundial excepto Argentina",
      { countries: [], description: "Worldwide except Argentina" },
      "descartar",
    ],
    [
      "autorización obligatoria",
      { countries: [], description: "You must have US work authorization." },
      "descartar",
    ],
    [
      "residencia obligatoria",
      { countries: [], description: "You must be based in Germany." },
      "descartar",
    ],
    [
      "zona horaria ambigua",
      { countries: [], timezone_restrictions: [-8, -7] },
      "revisar",
    ],
    [
      "zona UTC-3",
      { countries: [], timezone_restrictions: [-4, -3] },
      "aceptable",
    ],
    [
      "horario obligatorio",
      { countries: [], description: "You must overlap business hours in PST." },
      "revisar",
    ],
    [
      "horario de EEUU declarado",
      { countries: [], description: "Working Hours: U.S. Business Hours" },
      "revisar",
    ],
    ["presencial CABA", { modality: "onsite", location: "CABA" }, "descartar"],
    [
      "presencial La Plata excepcional",
      { modality: "onsite", location: "La Plata" },
      "revisar",
    ],
    ["híbrido incierto", { modality: "hybrid" }, "revisar"],
    [
      "híbrido CABA tres días",
      {
        modality: "hybrid",
        location: "CABA",
        description: "Three days per week in the office.",
      },
      "descartar",
    ],
  ] as const)("%s", (_label, overrides, expected) => {
    expect(
      classifyGeography(
        fixture({
          ...overrides,
          countries:
            "countries" in overrides
              ? overrides.countries === null
                ? null
                : [...overrides.countries]
              : ["Argentina"],
          timezone_restrictions:
            "timezone_restrictions" in overrides
              ? [...overrides.timezone_restrictions]
              : [],
        }),
      ).eligibility,
    ).toBe(expected);
  });
  it("no descarta por salario ausente ni seniority", () => {
    expect(
      classifyGeography(fixture({ title: "Senior React Developer" }))
        .eligibility,
    ).toBe("aceptable");
    expect(
      classifyTechnical("Senior React Developer", "TypeScript").technical_fit,
    ).toBe("revisar");
  });
});
describe("perfiles determinísticos sin puntuaciones", () => {
  it.each([
    ["React Developer", "React TypeScript", ["web"]],
    ["Unity Gameplay Programmer", "C# Unity Netcode", ["game_dev"]],
    [
      "Full Stack Game Developer",
      "React TypeScript Unity",
      ["web", "game_dev"],
    ],
    ["Freelance Copywriter", "Work alongside the React developers", []],
    ["Machine Learning Engineer", "Python Databricks", []],
    ["Software Engineer", "General software position", ["web"]],
    ["Technical Game Designer", "Unity scripting", ["game_dev"]],
    ["Software Engineer", "Databricks Unity Catalog", ["web"]],
    [
      "React Native Developer",
      "Other roles we recruit: Unity, Python, Data, Scala",
      ["web"],
    ],
    [
      "Full Stack Developer",
      "Develop interactive experiences using Unity (C#)",
      ["web", "game_dev"],
    ],
  ])("%s", (title, description, profiles) =>
    expect(
      classifyTechnical(String(title), String(description)).profiles,
    ).toEqual(profiles),
  );
  it("marca Unreal/AAA para revisar", () =>
    expect(
      classifyTechnical("Gameplay Programmer", "Unreal C++ AAA").technical_fit,
    ).toBe("revisar"));
});

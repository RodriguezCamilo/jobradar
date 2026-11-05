"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowDownWideNarrow,
  ArrowUpRight,
  Bookmark,
  BriefcaseBusiness,
  Check,
  ChevronDown,
  Code2,
  Database,
  Eye,
  Gamepad2,
  Globe2,
  LoaderCircle,
  MapPin,
  Radar,
  RefreshCw,
  Search,
  SlidersHorizontal,
  X,
  Download,
  Sparkles,
} from "lucide-react";
import type {
  Job,
  Profile,
  RadarData,
  TrackingState,
  Feedback,
} from "@/lib/domain";
import { trackingStates, sources, sourceNames } from "@/lib/domain";
import { filterJobs } from "@/lib/filters";
import { JobReview } from "./job-review";
import { ThemeToggle } from "./theme-toggle";

const statusNames: Record<TrackingState, string> = {
  nueva: "Nueva",
  guardada: "Guardada",
  postulada: "Postulada",
  en_proceso: "En proceso",
  rechazada: "Rechazada",
  descartada: "Descartada",
};
const validityNames = {
  active: "Activa en la fuente",
  unverified: "Sin verificar",
  closed: "Cerrada",
  expired: "Vencida",
};
const dateFormat = new Intl.DateTimeFormat("es-AR", {
  day: "numeric",
  month: "short",
  timeZone: "America/Argentina/Buenos_Aires",
});
const timeFormat = new Intl.DateTimeFormat("es-AR", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: "America/Argentina/Buenos_Aires",
});
const date = (value: string | null) =>
  value ? dateFormat.format(new Date(value)) : "Sin fecha";
function locationLabel(job: Job) {
  if (job.countries && job.countries.length > 4)
    return job.countries.includes("Argentina")
      ? `Argentina + ${job.countries.length - 1} países`
      : `${job.countries.length} países · ver restricciones`;
  return job.location;
}

function salaryLabel(job: Job) {
  const salary = job.salary;
  if (salary.text) return salary.text;
  if (salary.min === null && salary.max === null) return "Salario no publicado";
  const range =
    salary.min !== null && salary.max !== null
      ? `${salary.min.toLocaleString("es-AR")} – ${salary.max.toLocaleString("es-AR")}`
      : salary.min !== null
        ? `Desde ${salary.min.toLocaleString("es-AR")}`
        : `Hasta ${salary.max!.toLocaleString("es-AR")}`;
  const period: Record<string, string> = {
    annual: "año",
    monthly: "mes",
    hourly: "hora",
    weekly: "semana",
    fortnightly: "quincena",
  };
  return `${salary.currency || "Moneda no informada"} ${range}${salary.period ? ` / ${period[salary.period] || salary.period}` : ""}`;
}

function Filter({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="filter">
      <span>{label}</span>
      <span className="select-wrap">
        <select value={value} onChange={(e) => onChange(e.target.value)}>
          {children}
        </select>
        <ChevronDown size={13} aria-hidden />
      </span>
    </label>
  );
}

function JobCard({
  job,
  enabled,
  busy,
  update,
  reportError,
  review,
}: {
  job: Job;
  enabled: boolean;
  busy: boolean;
  update: (
    id: string,
    patch: { status?: TrackingState; seen?: boolean },
  ) => Promise<void>;
  reportError: (text: string) => void;
  review: React.ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  const markSeen = () => {
    if (enabled && !job.tracking.seen_at) void update(job.id, { seen: true });
  };
  const badge =
    job.eligibility === "aceptable"
      ? "Aceptable · Argentina"
      : job.eligibility === "revisar"
        ? "Revisar ubicación"
        : "Descartar · ubicación";
  const initials = job.company
    .split(/\s+/)
    .slice(0, 2)
    .map((v) => v[0])
    .join("")
    .toUpperCase();
  return (
    <article className={`job-card ${job.tracking.seen_at ? "seen" : ""}`}>
      <div className="card-heading">
        <div className="company-avatar" aria-hidden>
          {initials}
        </div>
        <div className="job-heading">
          <div className="company-line">
            <span>{job.company}</span>
            {!job.tracking.seen_at && <span className="new-tag">NUEVA</span>}
            {job.profiles.length === 2 && (
              <span className="cross-tag">Web + Game Dev</span>
            )}
          </div>
          <h2>{job.title}</h2>
        </div>
        <button
          className={`icon-button save-button ${job.tracking.status === "guardada" ? "selected" : ""}`}
          disabled={!enabled || busy}
          title={enabled ? "Guardar oferta" : "Requiere Supabase"}
          aria-label={`Guardar ${job.title}`}
          aria-pressed={job.tracking.status === "guardada"}
          onClick={() =>
            void update(job.id, {
              status: job.tracking.status === "guardada" ? "nueva" : "guardada",
            })
          }
        >
          <Bookmark
            size={19}
            fill={job.tracking.status === "guardada" ? "currentColor" : "none"}
          />
        </button>
      </div>
      <div className="job-facts">
        <span title={job.location}>
          <MapPin size={13} />
          {locationLabel(job)}
        </span>
        <span>
          <BriefcaseBusiness size={13} />
          {job.employment_type?.replaceAll("_", " ") || "Tipo no informado"}
        </span>
        <span>{salaryLabel(job)}</span>
      </div>
      <div className="badges">
        <span className={`eligibility ${job.eligibility}`}>
          <span className="dot" />
          {badge}
        </span>
        <span className="technical">
          {job.technical_fit === "compatible"
            ? "Stack afín"
            : "Revisar requisitos"}
        </span>
        {job.validity !== "active" && (
          <span className="validity">{validityNames[job.validity]}</span>
        )}
        {job.technologies.slice(0, 6).map((t) => (
          <span className="tech" key={t}>
            {t}
          </span>
        ))}
      </div>
      <p className="geo-reason">{job.eligibility_reason}</p>
      <p className="excerpt">{job.description.slice(0, 550)}</p>
      {review}
      {expanded && (
        <div className="job-details">
          <h3>Compatibilidad técnica</h3>
          <p>
            {job.technical_reasons.length
              ? job.technical_reasons.join(" ")
              : "Título y tecnologías relacionados con tu perfil. La clasificación no reemplaza la lectura de los requisitos."}
          </p>
          <p>Ubicación publicada: {job.location}.</p>
          <p>
            Modalidad:{" "}
            {job.modality === "remote"
              ? "remoto"
              : job.modality === "hybrid"
                ? "híbrido"
                : "presencial"}
            . Restricciones horarias:{" "}
            {job.timezone_restrictions.length
              ? job.timezone_restrictions.join(", ")
              : "no informadas"}
            .
          </p>
          <h3>Descripción de la oferta</h3>
          <div className="full-description">{job.description}</div>
          <p className="date-note">
            {job.publication_note} Descubierta: {date(job.first_discovered_at)}.
            Última comprobación: {date(job.last_checked_at)}.{" "}
            {validityNames[job.validity]}.
          </p>
          <div className="source-links">
            {job.sources.map((source) => (
              <div key={`${source.source}:${source.external_id}`}>
                <span>
                  Fuente: {sourceNames[source.source]} ·{" "}
                  {validityNames[source.validity]}
                </span>
                <a
                  href={source.original_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={markSeen}
                >
                  Oferta original <ArrowUpRight size={13} />
                </a>
                <a
                  href={source.application_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={markSeen}
                >
                  Postular en {sourceNames[source.source]}{" "}
                  <ArrowUpRight size={13} />
                </a>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="card-footer">
        <div className="source-date">
          <span>
            {job.sources.map((s) => sourceNames[s.source]).join(" + ")}
          </span>
          <span aria-hidden>·</span>
          <span title={job.publication_note || undefined}>
            {date(job.published_at)}
          </span>
          {job.tracking.seen_at && (
            <span className="viewed">
              <Eye size={12} /> Vista
            </span>
          )}
        </div>
        <div className="card-actions">
          <button
            className="text-button details-button"
            aria-expanded={expanded}
            onClick={() => {
              setExpanded(!expanded);
              markSeen();
            }}
          >
            {expanded ? "Menos detalles" : "Ver detalles"}
          </button>
          <label className="sr-only" htmlFor={`status-${job.id}`}>
            Seguimiento de {job.title}
          </label>
          <select
            className="tracking-select"
            id={`status-${job.id}`}
            disabled={!enabled || busy}
            value={job.tracking.status}
            onChange={(e) => {
              const status = e.target.value;
              if (trackingStates.includes(status as TrackingState))
                void update(job.id, { status: status as TrackingState });
              else reportError("Estado inválido.");
            }}
          >
            {trackingStates.map((s) => (
              <option key={s} value={s}>
                {statusNames[s]}
              </option>
            ))}
          </select>
          <a
            className="open-link"
            href={
              job.sources.find((s) => s.validity === "active")
                ?.application_url || job.application_url
            }
            target="_blank"
            rel="noopener noreferrer"
            onClick={markSeen}
          >
            Abrir oferta <ArrowUpRight size={15} />
          </a>
        </div>
      </div>
    </article>
  );
}

export function RadarApp({ initial }: { initial: RadarData }) {
  const [data, setData] = useState(initial);
  const [profile, setProfile] = useState<Profile>("web");
  const [search, setSearch] = useState("");
  const [source, setSource] = useState("all");
  const [eligibility, setEligibility] = useState("potential");
  const [days, setDays] = useState("all");
  const [tracking, setTracking] = useState("all");
  const [sort, setSort] = useState("fit");
  const [validity, setValidity] = useState("open");
  const [language, setLanguage] = useState<
    "prefer_spanish" | "spanish_only" | "all"
  >("prefer_spanish");
  const [feedbackFilter, setFeedbackFilter] = useState("all");
  const [adLanguages, setAdLanguages] = useState(["es", "en", "other"]);
  const [includeEnglishRequired, setIncludeEnglishRequired] = useState(true);
  const [selected, setSelected] = useState<string[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisId, setAnalysisId] = useState<string | null>(null);
  const [analysisProgress, setAnalysisProgress] = useState("");
  const [analysisTokens, setAnalysisTokens] = useState(0);
  const [limit, setLimit] = useState(15);
  const [syncing, setSyncing] = useState(false);
  const [busyIds, setBusyIds] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [showRuns, setShowRuns] = useState(false);
  const enabled = data.persistence === "supabase";
  const filtered = useMemo(
    () =>
      filterJobs(data.jobs, {
        profile,
        search,
        source,
        eligibility,
        days,
        tracking,
        sort,
        validity,
        language,
        feedback: feedbackFilter,
        adLanguages,
        includeEnglishRequired,
      }),
    [
      data.jobs,
      profile,
      search,
      source,
      eligibility,
      days,
      tracking,
      sort,
      validity,
      language,
      feedbackFilter,
      adLanguages,
      includeEnglishRequired,
    ],
  );
  const latestRun = data.runs[0];
  const canAnalyze =
    enabled && Boolean(data.groq?.configured) && !analyzing && !syncing;
  function selectAnalysis(id: string, checked: boolean) {
    if (checked && selected.length >= (data.groq?.maxBatch ?? 3)) {
      setError("Seleccioná hasta tres ofertas por lote.");
      return;
    }
    setSelected((current) =>
      checked
        ? [...new Set([...current, id])]
        : current.filter((v) => v !== id),
    );
  }
  async function feedback(id: string, value: Feedback) {
    setBusyIds((ids) => [...new Set([...ids, id])]);
    setError("");
    try {
      const response = await fetch(`/api/jobs/${id}/feedback`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(value),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error || "No se pudo guardar la evaluación.");
      setData((current) => ({
        ...current,
        jobs: current.jobs.map((job) =>
          job.id === id ? { ...job, feedback: result.feedback } : job,
        ),
      }));
    } catch (error) {
      setError(error instanceof Error ? error.message : "Falló la evaluación.");
    } finally {
      setBusyIds((ids) => ids.filter((v) => v !== id));
    }
  }
  async function analyze(ids: string[]) {
    const bounded = [...new Set(ids)].slice(0, data.groq?.maxBatch ?? 3);
    if (!bounded.length) return;
    setAnalyzing(true);
    setError("");
    setAnalysisTokens(0);
    let completed = 0,
      tokens = 0,
      failed = 0;
    try {
      for (const [index, id] of bounded.entries()) {
        setAnalysisId(id);
        setAnalysisProgress(
          `Analizando ${index + 1} de ${bounded.length}. Solo se envían las ofertas elegidas.`,
        );
        try {
          const response = await fetch("/api/analyze", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ jobId: id }),
          });
          const result = await response.json();
          if (!response.ok) {
            if (result.retryAt)
              setData((d) => ({
                ...d,
                groq: d.groq
                  ? { ...d.groq, retryAt: result.retryAt }
                  : undefined,
              }));
            throw Object.assign(
              new Error(result.error || "Falló el análisis."),
              { stop: [401, 403, 429, 503].includes(response.status) },
            );
          }
          completed++;
          if (!result.cached)
            tokens +=
              result.analysis.input_tokens + result.analysis.output_tokens;
          setAnalysisTokens(tokens);
          setData((current) => ({
            ...current,
            jobs: current.jobs.map((j) =>
              j.id === id ? { ...j, analysis: result.analysis } : j,
            ),
          }));
        } catch (error) {
          failed++;
          setError(error instanceof Error ? error.message : "Falló Groq.");
          if ((error as { stop?: boolean }).stop) break;
        }
      }
    } finally {
      setAnalyzing(false);
      setAnalysisId(null);
      setSelected([]);
      setAnalysisProgress(
        `Lote terminado: ${completed} análisis disponibles, ${failed} errores. ${tokens} tokens consumidos en respuestas válidas; caché sin consumo adicional.`,
      );
      try {
        await refresh();
      } catch {
        setError(
          "El lote terminó, pero no se pudo actualizar la lista. Recargá para leer los resultados guardados.",
        );
      }
    }
  }
  const counts = {
    web: data.jobs.filter((j) => j.profiles.includes("web")).length,
    game_dev: data.jobs.filter((j) => j.profiles.includes("game_dev")).length,
  };
  async function refresh() {
    const response = await fetch("/api/jobs", { cache: "no-store" });
    if (!response.ok) throw new Error("No se pudieron actualizar las ofertas.");
    setData((await response.json()) as RadarData);
  }
  async function sync() {
    setSyncing(true);
    setError("");
    setMessage(
      "Consultando las fuentes. La primera búsqueda puede tardar unos minutos…",
    );
    try {
      const response = await fetch("/api/sync", { method: "POST" });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error || "Falló la sincronización.");
      await refresh();
      const errors = result.runs.some((run: { status: string }) =>
        ["error", "partial"].includes(run.status),
      );
      setMessage(
        errors
          ? "Búsqueda terminada con incidencias. Consultá el registro de fuentes."
          : "Ofertas actualizadas. Se reutiliza la caché de cada fuente mientras esté vigente.",
      );
      setShowRuns(errors);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo sincronizar.");
      setMessage("");
    } finally {
      setSyncing(false);
    }
  }
  async function update(
    id: string,
    patch: { status?: TrackingState; seen?: boolean },
  ) {
    setBusyIds((ids) => [...new Set([...ids, id])]);
    setError("");
    try {
      const response = await fetch(`/api/jobs/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!response.ok)
        throw new Error("No se pudo guardar el seguimiento. Volvé a intentar.");
      setData((current) => ({
        ...current,
        jobs: current.jobs.map((job) =>
          job.id === id
            ? {
                ...job,
                tracking: {
                  status: patch.status ?? job.tracking.status,
                  seen_at: patch.seen
                    ? (job.tracking.seen_at ?? new Date().toISOString())
                    : job.tracking.seen_at,
                },
              }
            : job,
        ),
      }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falló la actualización.");
    } finally {
      setBusyIds((ids) => ids.filter((value) => value !== id));
    }
  }
  function resetFilters() {
    setSearch("");
    setSource("all");
    setEligibility("potential");
    setDays("all");
    setTracking("all");
    setValidity("open");
    setLanguage("prefer_spanish");
    setFeedbackFilter("all");
    setAdLanguages(["es", "en", "other"]);
    setIncludeEnglishRequired(true);
    setLimit(15);
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link className="brand" href="/" aria-label="Job Radar, inicio">
          <span className="brand-icon">
            <Radar size={24} />
          </span>
          job<span className="brand-light">radar</span>
          <span className="beta">LOCAL</span>
        </Link>
        <div className="sidebar-intro">Un buen próximo paso.</div>
        <div className="nav-caption">TU BÚSQUEDA</div>
        <nav aria-label="Búsqueda personal">
          <button
            className={`nav-item ${tracking === "all" ? "active" : ""}`}
            onClick={() => setTracking("all")}
          >
            <Search size={18} />
            Explorar oportunidades
          </button>
          <button
            className={`nav-item ${tracking === "guardada" ? "active" : ""}`}
            onClick={() => setTracking("guardada")}
          >
            <Bookmark size={18} />
            Guardadas
            <span className="nav-count">
              {data.jobs.filter((j) => j.tracking.status === "guardada").length}
            </span>
          </button>
          <button
            className={`nav-item ${tracking === "postulada" ? "active" : ""}`}
            onClick={() => setTracking("postulada")}
          >
            <BriefcaseBusiness size={18} />
            Postuladas
            <span className="nav-count">
              {
                data.jobs.filter((j) => j.tracking.status === "postulada")
                  .length
              }
            </span>
          </button>
        </nav>
        <div className="sidebar-sources">
          <div className="nav-caption">FUENTES CONECTADAS</div>
          {sources.map((s) => {
            const run = data.runs.find((r) => r.source === s);
            return (
              <div className="source-item" key={s}>
                <span
                  className={`source-status ${run && run.status !== "error" ? "online" : ""}`}
                />
                <span>{sourceNames[s]}</span>
                <span className="api-label">API</span>
              </div>
            );
          })}
          <button
            className="source-history"
            onClick={() => setShowRuns(!showRuns)}
          >
            Ver última sincronización <ArrowUpRight size={13} />
          </button>
        </div>
        <div className="sidebar-bottom">
          {enabled && (
            <a className="export-feedback" href="/api/feedback/export" download>
              <Download size={14} />
              Exportar mis evaluaciones
            </a>
          )}
          <div className="location-card">
            <Globe2 size={18} />
            <div>
              <strong>Remoto desde Argentina</strong>
              <span>La Plata · UTC−3</span>
            </div>
          </div>
          <div className="storage-status">
            <Database size={13} />
            {enabled ? "Supabase conectado" : "Vista previa · sin persistencia"}
            <span className={`source-status ${enabled ? "online" : ""}`} />
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <span className="breadcrumb">
            Mi espacio <span>/</span> <strong>Oportunidades</strong>
          </span>
          <div className="topbar-actions">
            <ThemeToggle />
            <span className="personal-label">
              <span className="dot" />
              Búsqueda personal
            </span>
          </div>
        </header>
        <main className="main-content">
          <div className="page-heading">
            <div>
              <div className="eyebrow">MENOS BUSCAR. MÁS ENCONTRAR.</div>
              <h1>
                Tu próxima oportunidad<span>.</span>
              </h1>
              <p>Ofertas reales, reunidas para tus dos perfiles.</p>
            </div>
            <button
              className="primary sync-button"
              onClick={() => void sync()}
              disabled={syncing || analyzing}
            >
              {syncing ? (
                <LoaderCircle size={17} className="spin" />
              ) : (
                <RefreshCw size={17} />
              )}
              {syncing ? "Buscando ofertas…" : "Sincronizar ofertas"}
            </button>
          </div>
          <div className="search-context">
            <span>
              <MapPin size={14} />
              Argentina · LATAM · Worldwide
            </span>
            <span>
              {latestRun?.finished_at
                ? `Última búsqueda: ${timeFormat.format(new Date(latestRun.finished_at))}`
                : "Tu radar está listo para buscar"}
            </span>
          </div>
          {!enabled && (
            <div className="notice warning">
              <Database size={17} />
              <div>
                <strong>Vista previa con datos reales.</strong> Configurá
                DATABASE_URL y ejecutá la migración para guardar ofertas y
                seguimiento. Las acciones personales están deshabilitadas.
              </div>
            </div>
          )}
          {(error || data.error) && (
            <div role="alert" className="notice error">
              <span>{error || data.error}</span>
              <button
                aria-label="Cerrar mensaje"
                onClick={() => {
                  setError("");
                  setData((d) => ({ ...d, error: undefined }));
                }}
              >
                <X size={15} />
              </button>
            </div>
          )}
          {message && (
            <div role="status" className="notice info">
              {syncing ? (
                <LoaderCircle size={16} className="spin" />
              ) : (
                <Check size={16} />
              )}
              <span>{message}</span>
            </div>
          )}
          <div
            className="profile-tabs"
            role="tablist"
            aria-label="Perfiles profesionales"
          >
            <button
              role="tab"
              aria-selected={profile === "web"}
              aria-controls="opportunities-panel"
              id="tab-web"
              className={profile === "web" ? "active" : ""}
              onClick={() => {
                setProfile("web");
                setLimit(15);
              }}
            >
              <Code2 size={18} />
              Web <span>{counts.web}</span>
            </button>
            <button
              role="tab"
              aria-selected={profile === "game_dev"}
              aria-controls="opportunities-panel"
              id="tab-game"
              className={profile === "game_dev" ? "active" : ""}
              onClick={() => {
                setProfile("game_dev");
                setLimit(15);
              }}
            >
              <Gamepad2 size={19} />
              Game Dev <span>{counts.game_dev}</span>
            </button>
            <span className="tabs-note">Dos caminos. Un mismo radar.</span>
          </div>
          <section className="filters-panel" aria-label="Filtros de ofertas">
            <div className="search-row">
              <label className="search-box">
                <Search size={17} />
                <span className="sr-only">Buscar por título o empresa</span>
                <input
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setLimit(15);
                  }}
                  placeholder="Buscar por título o empresa…"
                />
                {search && (
                  <button
                    aria-label="Borrar búsqueda"
                    onClick={() => setSearch("")}
                  >
                    <X size={15} />
                  </button>
                )}
              </label>
              <span className="filter-hint">
                <SlidersHorizontal size={15} /> Afiná tu búsqueda
              </span>
            </div>
            <div className="language-switches">
              <fieldset>
                <legend>Idioma del anuncio</legend>
                {[
                  { key: "es", label: "Español" },
                  { key: "en", label: "Inglés" },
                  { key: "other", label: "Otros / sin determinar" },
                ].map((option) => (
                  <label key={option.key}>
                    <input
                      type="checkbox"
                      checked={adLanguages.includes(option.key)}
                      onChange={(e) => {
                        setAdLanguages((current) =>
                          e.target.checked
                            ? [...new Set([...current, option.key])]
                            : current.filter((v) => v !== option.key),
                        );
                        setLimit(15);
                      }}
                    />
                    {option.label}
                  </label>
                ))}
              </fieldset>
              <label className="english-work-toggle">
                <input
                  type="checkbox"
                  checked={includeEnglishRequired}
                  onChange={(e) => setIncludeEnglishRequired(e.target.checked)}
                />
                Incluir inglés laboral obligatorio
              </label>
              <p>
                El idioma del anuncio y el de comunicación del equipo se filtran
                por separado.
              </p>
            </div>
            <div className="filters-row">
              <Filter label="Fuente" value={source} onChange={setSource}>
                <option value="all">Todas las fuentes</option>
                <option value="himalayas">Himalayas</option>
                <option value="remotive">Remotive</option>
                <option value="getonbrd">Get on Board</option>
              </Filter>
              <Filter
                label="Elegibilidad geográfica"
                value={eligibility}
                onChange={setEligibility}
              >
                <option value="potential">Aceptable + revisar</option>
                <option value="all">Todas</option>
                <option value="aceptable">Aceptable</option>
                <option value="revisar">Revisar</option>
                <option value="descartar">Descartar</option>
              </Filter>
              <Filter label="Publicación" value={days} onChange={setDays}>
                <option value="all">Cualquier fecha</option>
                <option value="7">Últimos 7 días</option>
                <option value="30">Últimos 30 días</option>
                <option value="90">Últimos 90 días</option>
              </Filter>
              <Filter
                label="Seguimiento"
                value={tracking}
                onChange={setTracking}
              >
                <option value="all">Todos los estados</option>
                <option value="unseen">Sin ver</option>
                {trackingStates.map((s) => (
                  <option key={s} value={s}>
                    {statusNames[s]}
                  </option>
                ))}
              </Filter>
              <Filter label="Vigencia" value={validity} onChange={setValidity}>
                <option value="open">Activas + sin verificar</option>
                <option value="all">Incluir históricas</option>
                <option value="active">Activas</option>
                <option value="unverified">Sin verificar</option>
                <option value="closed">Cerradas</option>
                <option value="expired">Vencidas</option>
              </Filter>
              <Filter
                label="Idioma laboral"
                value={language}
                onChange={(value) => setLanguage(value as typeof language)}
              >
                <option value="prefer_spanish">Priorizar español</option>
                <option value="spanish_only">Solo español confirmado</option>
                <option value="all">Todos los idiomas</option>
              </Filter>
              <Filter
                label="Mi evaluación"
                value={feedbackFilter}
                onChange={setFeedbackFilter}
              >
                <option value="all">Todas</option>
                <option value="sin_evaluar">Sin evaluar</option>
                <option value="me_interesa">Me interesa</option>
                <option value="no_encaja">No encaja</option>
              </Filter>
            </div>
          </section>
          <section
            className="analysis-toolbar"
            aria-label="Análisis manual de ofertas"
          >
            <div>
              <h2>
                <Sparkles
                  size={14}
                  style={{ display: "inline", verticalAlign: "middle" }}
                />{" "}
                Análisis opcional con Groq
              </h2>
              <p>
                {data.groq?.configured
                  ? `${data.groq.model} · Hasta ${data.groq.maxBatch} ofertas por lote`
                  : "Groq no está configurado. Las reglas siguen funcionando."}
              </p>
              <p>
                El orden recomendado prioriza geografía, español y afinidad. Las
                ofertas ambiguas siguen visibles.
              </p>
            </div>
            <div className="analysis-toolbar-actions">
              {enabled && (
                <a
                  className="export-feedback mobile-export"
                  href="/api/feedback/export"
                  download
                >
                  <Download size={14} />
                  Exportar evaluaciones
                </a>
              )}
              <button
                className="secondary"
                disabled={!canAnalyze || !selected.length}
                onClick={() => void analyze(selected)}
              >
                Analizar seleccionadas ({selected.length})
              </button>
              <button
                className="secondary"
                disabled={!canAnalyze}
                onClick={() =>
                  void analyze(
                    filtered
                      .filter(
                        (j) =>
                          j.eligibility !== "descartar" &&
                          j.feedback.rating !== "no_encaja" &&
                          !(
                            j.analysis?.current &&
                            j.analysis.status === "success"
                          ),
                      )
                      .slice(0, 3)
                      .map((j) => j.id),
                  )
                }
              >
                Analizar hasta 3 candidatas
              </button>
            </div>
            {analysisProgress && (
              <p className="analysis-progress" role="status" aria-live="polite">
                {analysisProgress}
                {analyzing ? ` · ${analysisTokens} tokens confirmados` : ""}
              </p>
            )}
            {data.groq?.retryAt && (
              <p className="analysis-error">
                Límite de Groq: reintentar después de{" "}
                {timeFormat.format(new Date(data.groq.retryAt))}.
              </p>
            )}
          </section>
          {showRuns && (
            <section className="sync-log">
              <div className="log-title">
                <h2>Registro de sincronización</h2>
                <button
                  className="icon-button"
                  onClick={() => setShowRuns(false)}
                  aria-label="Cerrar registro"
                >
                  <X size={16} />
                </button>
              </div>
              {!data.runs.length && <p>Todavía no se ejecutaron búsquedas.</p>}
              {data.runs.slice(0, 6).map((run, i) => (
                <div
                  className="run"
                  key={`${run.source}-${run.started_at}-${i}`}
                >
                  <strong>{sourceNames[run.source]}</strong>
                  <span>
                    {run.status} · {run.received} ofertas únicas recibidas ·{" "}
                    {run.candidates} candidatas · {run.inserted} nuevas
                  </span>
                  <small>
                    Consulta: {timeFormat.format(new Date(run.started_at))}.
                    Próxima consulta externa:{" "}
                    {timeFormat.format(new Date(run.next_allowed_at))}.
                  </small>
                  {run.errors.map((e, i) => (
                    <p className="log-error" key={i}>
                      {e}
                    </p>
                  ))}
                  {run.warnings.length > 0 && (
                    <details>
                      <summary>{run.warnings.length} observaciones</summary>
                      {run.warnings.map((w, i) => (
                        <p key={i}>{w}</p>
                      ))}
                    </details>
                  )}
                </div>
              ))}
            </section>
          )}
          <div className="results-toolbar">
            <span>
              <strong>{filtered.length}</strong> oportunidades{" "}
              <span className="muted">
                para {profile === "web" ? "Web" : "Game Dev"}
              </span>
            </span>
            <label className="sort-control">
              <ArrowDownWideNarrow size={14} />
              <span className="sr-only">Ordenar ofertas</span>
              <select value={sort} onChange={(e) => setSort(e.target.value)}>
                <option value="fit">Orden recomendado</option>
                <option value="discovered">Descubiertas recientemente</option>
                <option value="published">Publicadas recientemente</option>
              </select>
            </label>
          </div>
          <section
            id="opportunities-panel"
            role="tabpanel"
            aria-labelledby={profile === "web" ? "tab-web" : "tab-game"}
            className="job-list"
          >
            {filtered.slice(0, limit).map((job) => (
              <JobCard
                key={job.id}
                job={job}
                enabled={enabled}
                busy={busyIds.includes(job.id)}
                update={update}
                reportError={setError}
                review={
                  <JobReview
                    job={job}
                    enabled={enabled}
                    busy={busyIds.includes(job.id)}
                    canAnalyze={canAnalyze}
                    analyzing={analysisId === job.id}
                    selected={selected.includes(job.id)}
                    onSelect={selectAnalysis}
                    onAnalyze={(ids) => void analyze(ids)}
                    onFeedback={(id, value) => void feedback(id, value)}
                  />
                }
              />
            ))}
            {filtered.length === 0 && (
              <div className="empty-state">
                <div className="empty-icon">
                  <Radar size={32} />
                </div>
                <h2>
                  {data.jobs.length
                    ? "Probá ampliar la búsqueda"
                    : "Tu próxima oportunidad empieza acá"}
                </h2>
                <p>
                  {data.jobs.length
                    ? "No hay ofertas con estos filtros. Podés cambiar de perfil o revisar las restricciones."
                    : "Sincronizá para traer oportunidades reales de Himalayas, Remotive y Get on Board."}
                </p>
                <button
                  className="secondary"
                  onClick={() =>
                    data.jobs.length ? resetFilters() : void sync()
                  }
                  disabled={syncing}
                >
                  {data.jobs.length
                    ? "Restablecer filtros"
                    : "Buscar oportunidades"}
                </button>
              </div>
            )}
          </section>
          {filtered.length > limit && (
            <button
              className="load-more secondary"
              onClick={() => setLimit((l) => l + 15)}
            >
              Mostrar más oportunidades <ChevronDown size={15} />
            </button>
          )}
          <footer className="main-footer">
            <span>
              La elegibilidad orienta. Confirmá los requisitos antes de
              postular.
            </span>
            <span>
              Datos de{" "}
              <a
                href="https://himalayas.app"
                target="_blank"
                rel="noopener noreferrer"
              >
                Himalayas
              </a>{" "}
              y{" "}
              <a
                href="https://remotive.com"
                target="_blank"
                rel="noopener noreferrer"
              >
                Remotive
              </a>
              {" y "}
              <a
                href="https://www.getonbrd.com"
                target="_blank"
                rel="noopener noreferrer"
              >
                Get on Board
              </a>
              .
            </span>
          </footer>
        </main>
      </div>
    </div>
  );
}

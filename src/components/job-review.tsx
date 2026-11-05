"use client";
import { Sparkles, Check, X, Languages } from "lucide-react";
import type { Feedback, Job } from "@/lib/domain";
import { feedbackReasons } from "@/lib/domain";
import { languageLabels, adLanguageLabels } from "@/lib/language";
import { effectiveLanguage, recommendation } from "@/lib/recommendation";
export const reasonLabels = {
  idioma: "Idioma",
  experiencia: "Experiencia insuficiente",
  stack: "Stack incompatible",
  ubicacion: "Modalidad o ubicación",
  seniority: "Seniority",
  remuneracion: "Remuneración",
  otro: "Otro",
};
const ratingLabels = {
  sin_evaluar: "Sin evaluar",
  me_interesa: "Me interesa",
  no_encaja: "No encaja",
};
export function JobReview({
  job,
  enabled,
  busy,
  canAnalyze,
  analyzing,
  selected,
  onSelect,
  onAnalyze,
  onFeedback,
}: {
  job: Job;
  enabled: boolean;
  busy: boolean;
  canAnalyze: boolean;
  analyzing: boolean;
  selected: boolean;
  onSelect: (id: string, checked: boolean) => void;
  onAnalyze: (ids: string[]) => void;
  onFeedback: (id: string, value: Feedback) => void;
}) {
  const language = effectiveLanguage(job),
    rec = recommendation(job);
  const current = job.analysis?.current ? job.analysis : null;
  const result = current?.status === "success" ? current.result : null;
  const confidence = { high: "alta", medium: "media", low: "baja" };
  const analyzable =
    job.eligibility !== "descartar" &&
    ["active", "unverified"].includes(job.validity);
  return (
    <div className="job-review">
      <div className="language-line">
        <span className={`language-badge ${language.work_language}`}>
          <Languages size={13} />
          {languageLabels[language.work_language]}
        </span>
        <span className="ad-language">
          Anuncio: {adLanguageLabels[job.language.ad_language]}
        </span>
        <span className="confidence">
          Confianza {confidence[language.confidence]}
        </span>
      </div>
      <p className="recommendation-reason">
        <strong>
          {rec.label} · {rec.method}
        </strong>{" "}
        {rec.reason}
      </p>
      <details className="review-details">
        <summary>Evidencia de idioma y recomendación</summary>
        <p>{language.reason}</p>
        {language.evidence.length ? (
          <ul>
            {language.evidence.map((e, i) => (
              <li key={i}>
                <q>{e}</q>
              </li>
            ))}
          </ul>
        ) : (
          <p>Sin evidencia textual suficiente del idioma laboral.</p>
        )}
        <p className="date-note">
          {job.language.ad_reason} Idioma para postular:{" "}
          {job.application_language || "no informado"}. Evaluación de idioma por{" "}
          {language.method === "groq" ? "Groq" : "reglas"}.
        </p>
        {result && (
          <div className="analysis-result">
            <h3>Análisis de Groq</h3>
            <p>
              <strong>Seniority:</strong> {result.seniority}
            </p>
            <p>
              <strong>Perfiles afines:</strong>{" "}
              {result.profiles.join(", ") || "sin afinidad confirmada"}
            </p>
            <p>
              <strong>Obligatorios:</strong>{" "}
              {result.required.join("; ") || "No determinados."}
            </p>
            <p>
              <strong>Deseables:</strong>{" "}
              {result.desirable.join("; ") || "No determinados."}
            </p>
            <p>
              <strong>Tecnologías por cubrir:</strong>{" "}
              {result.missing_technologies.join(", ") ||
                "Ninguna identificada; no garantiza dominio de todos los requisitos."}
            </p>
            {result.uncertainty.length > 0 && (
              <p>
                <strong>Incertidumbre:</strong> {result.uncertainty.join(" ")}
              </p>
            )}
            <p className="date-note">
              {current!.model} ·{" "}
              {current!.input_tokens + current!.output_tokens} tokens ·{" "}
              {current!.prompt_version}. No cambia seguimiento ni elegibilidad.
            </p>
          </div>
        )}
      </details>
      <div className="analysis-actions">
        <label className="analysis-selection">
          <input
            type="checkbox"
            checked={selected}
            disabled={!enabled || !analyzable || analyzing}
            onChange={(e) => onSelect(job.id, e.target.checked)}
            aria-label={`Seleccionar para analizar ${job.title}`}
          />
          Seleccionar
        </label>
        <span className="analysis-state">
          {analyzing
            ? "Analizando…"
            : result
              ? "Analizada con Groq"
              : current?.status === "error"
                ? "Error en análisis"
                : current?.status === "pending"
                  ? "Análisis pendiente"
                  : job.analysis
                    ? "Análisis anterior · requiere actualización"
                    : "Sin analizar · reglas activas"}
        </span>
        <button
          className="text-button analyze-one"
          disabled={!canAnalyze || analyzing || !analyzable}
          onClick={() => onAnalyze([job.id])}
        >
          <Sparkles size={13} />
          {result ? "Verificar caché" : "Analizar con Groq"}
        </button>
      </div>
      {current?.status === "error" && (
        <p className="analysis-error" role="status">
          {current.error}
          {current.retry_at
            ? ` Reintento a partir de ${new Date(current.retry_at).toLocaleTimeString("es-AR", { timeZone: "America/Argentina/Buenos_Aires", hourCycle: "h23" })}.`
            : ""}
        </p>
      )}
      <details className="feedback-panel">
        <summary>
          Mi evaluación: <strong>{ratingLabels[job.feedback.rating]}</strong>
          {job.feedback.reason ? ` · ${reasonLabels[job.feedback.reason]}` : ""}
        </summary>
        <div className="feedback-buttons">
          <button
            className="secondary"
            disabled={!enabled || busy}
            aria-pressed={job.feedback.rating === "me_interesa"}
            onClick={() =>
              onFeedback(job.id, {
                rating: "me_interesa",
                reason: job.feedback.reason,
              })
            }
          >
            <Check size={13} />
            Me interesa
          </button>
          <button
            className="secondary"
            disabled={!enabled || busy}
            aria-pressed={job.feedback.rating === "no_encaja"}
            onClick={() =>
              onFeedback(job.id, {
                rating: "no_encaja",
                reason: job.feedback.reason,
              })
            }
          >
            <X size={13} />
            No encaja
          </button>
          <button
            className="text-button"
            disabled={!enabled || busy}
            onClick={() =>
              onFeedback(job.id, { rating: "sin_evaluar", reason: null })
            }
          >
            Sin evaluar
          </button>
          <label>
            Motivo opcional
            <select
              aria-label={`Motivo de evaluación de ${job.title}`}
              disabled={
                !enabled || busy || job.feedback.rating === "sin_evaluar"
              }
              value={job.feedback.reason ?? ""}
              onChange={(e) =>
                onFeedback(job.id, {
                  rating: job.feedback.rating,
                  reason: (e.target.value || null) as Feedback["reason"],
                })
              }
            >
              <option value="">Sin motivo</option>
              {feedbackReasons.map((reason) => (
                <option key={reason} value={reason}>
                  {reasonLabels[reason]}
                </option>
              ))}
            </select>
          </label>
        </div>
      </details>
    </div>
  );
}

import "server-only";
import { database } from "./database";
import { listJobs } from "./repository";
import { analysisHash, getGroqModel, PROMPT_VERSION } from "./analysis-key";
import { AnalysisFailure, requestGroq } from "./groq";
import type { JobAnalysis } from "./domain";
import { reconcileAssessment } from "./assessment-guard";
export async function analyzeJob(
  id: string,
): Promise<{ analysis: JobAnalysis; cached: boolean }> {
  const sql = database(),
    model = getGroqModel();
  const job = (await listJobs()).find((j) => j.id === id);
  if (!job)
    throw new AnalysisFailure(
      "Oferta inexistente o fuera de los perfiles.",
      404,
    );
  if (
    job.eligibility === "descartar" ||
    !["active", "unverified"].includes(job.validity)
  )
    throw new AnalysisFailure(
      "Analizar solo candidatas potencialmente relevantes y vigentes.",
      400,
    );
  const hash = analysisHash(job);
  const existing =
    await sql`select * from public.job_analyses where job_id=${id} and content_hash=${hash} and prompt_version=${PROMPT_VERSION} and model=${model}`;
  if (existing[0]?.status === "success")
    return {
      analysis: {
        ...JSON.parse(JSON.stringify(existing[0])),
        result: reconcileAssessment(existing[0].result),
        current: true,
      },
      cached: true,
    };
  if (!process.env.GROQ_API_KEY)
    throw new AnalysisFailure(
      "Groq no está configurado; las reglas siguen disponibles.",
      503,
    );
  const control =
    await sql`select retry_at from public.analysis_control where provider='groq'`;
  if (control[0]?.retry_at && new Date(control[0].retry_at) > new Date())
    throw new AnalysisFailure(
      "Groq está en espera por límite de uso.",
      429,
      new Date(control[0].retry_at).toISOString(),
    );
  const claim =
    await sql`insert into public.job_analyses(job_id,content_hash,prompt_version,model,status)
    values(${id},${hash},${PROMPT_VERSION},${model},'pending') on conflict(job_id,content_hash,prompt_version,model)
    do update set status='pending',error=null,updated_at=now() where
      (job_analyses.status='error' and (job_analyses.retry_at is null or job_analyses.retry_at<=now())) or
      (job_analyses.status='pending' and job_analyses.updated_at<now()-interval '3 minutes') returning job_id`;
  if (!claim.length)
    throw new AnalysisFailure(
      "Ya hay un análisis en curso o pendiente de reintento para esta oferta.",
      409,
    );
  try {
    const { result, usage } = await requestGroq(job, model);
    await sql`update public.job_analyses set status='success',result=${sql.json(result)},input_tokens=${usage.input},output_tokens=${usage.output},error=null,retry_at=null,updated_at=now() where job_id=${id} and content_hash=${hash} and prompt_version=${PROMPT_VERSION} and model=${model}`;
    const analysis = {
      status: "success" as const,
      model,
      prompt_version: PROMPT_VERSION,
      content_hash: hash,
      result,
      input_tokens: usage.input,
      output_tokens: usage.output,
      error: null,
      retry_at: null,
      updated_at: new Date().toISOString(),
      current: true,
    };
    return { analysis, cached: false };
  } catch (error) {
    const failure =
      error instanceof AnalysisFailure
        ? error
        : new AnalysisFailure("No se pudo guardar/completar el análisis.");
    await sql`update public.job_analyses set status='error',error=${failure.message},input_tokens=${failure.usage.input},output_tokens=${failure.usage.output},retry_at=${failure.retryAt},updated_at=now() where job_id=${id} and content_hash=${hash} and prompt_version=${PROMPT_VERSION} and model=${model}`;
    if (failure.retryAt)
      await sql`update public.analysis_control set retry_at=greatest(retry_at,${failure.retryAt}::timestamptz) where provider='groq'`;
    throw failure;
  }
}

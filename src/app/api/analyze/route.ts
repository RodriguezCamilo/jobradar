import { z } from "zod";
import { analyzeJob } from "@/lib/analysis-service";
import { AnalysisFailure } from "@/lib/groq";
import { assertLocalRequest } from "@/lib/security";
export const runtime = "nodejs";
export async function POST(request: Request) {
  const blocked = assertLocalRequest(request, true);
  if (blocked) return blocked;
  try {
    const input = z
      .object({ jobId: z.uuid() })
      .strict()
      .safeParse(await request.json());
    if (!input.success)
      return Response.json(
        { error: "Seleccioná una oferta válida." },
        { status: 400 },
      );
    return Response.json(await analyzeJob(input.data.jobId));
  } catch (error) {
    const failure =
      error instanceof AnalysisFailure
        ? error
        : new AnalysisFailure(
            "No se pudo analizar la oferta; revisar Supabase y la configuración de Groq.",
          );
    return Response.json(
      { error: failure.message, retryAt: failure.retryAt },
      {
        status:
          failure.status >= 400 && failure.status < 600 ? failure.status : 502,
      },
    );
  }
}

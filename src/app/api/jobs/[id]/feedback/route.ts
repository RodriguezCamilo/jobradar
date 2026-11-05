import { z } from "zod";
import { assertLocalRequest } from "@/lib/security";
import { feedbackRatings, feedbackReasons } from "@/lib/domain";
import { saveFeedback } from "@/lib/repository";
export const runtime = "nodejs";
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const blocked = assertLocalRequest(request, true);
  if (blocked) return blocked;
  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success)
    return Response.json({ error: "ID inválido." }, { status: 400 });
  try {
    const input = z
      .object({
        rating: z.enum(feedbackRatings),
        reason: z.enum(feedbackReasons).nullable().default(null),
      })
      .strict()
      .safeParse(await request.json());
    if (!input.success)
      return Response.json(
        { error: "Evaluación o motivo inválidos." },
        { status: 400 },
      );
    const feedback = {
      ...input.data,
      reason: input.data.rating === "sin_evaluar" ? null : input.data.reason,
    };
    return (await saveFeedback(id, feedback))
      ? Response.json({ feedback })
      : Response.json({ error: "Oferta inexistente." }, { status: 404 });
  } catch {
    return Response.json(
      { error: "No se pudo guardar la evaluación." },
      { status: 500 },
    );
  }
}

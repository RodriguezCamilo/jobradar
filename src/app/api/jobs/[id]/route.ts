import { z } from "zod";
import { hasDatabase } from "@/lib/database";
import { updateTracking } from "@/lib/repository";
import { trackingStates } from "@/lib/domain";
import { assertLocalRequest } from "@/lib/security";
export const runtime = "nodejs";
const inputSchema = z
  .object({
    status: z.enum(trackingStates).optional(),
    seen: z.boolean().optional(),
  })
  .strict()
  .refine((v) => v.status !== undefined || v.seen === true);
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const blocked = assertLocalRequest(request, true);
  if (blocked) return blocked;
  if (!hasDatabase())
    return Response.json(
      { error: "Configurar Supabase para persistir el seguimiento." },
      { status: 503 },
    );
  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success)
    return Response.json({ error: "ID inválido." }, { status: 400 });
  if (Number(request.headers.get("content-length") || 0) > 2048)
    return Response.json(
      { error: "Entrada demasiado grande." },
      { status: 413 },
    );
  try {
    const input = inputSchema.safeParse(await request.json());
    if (!input.success)
      return Response.json(
        { error: "Estado o entrada inválida." },
        { status: 400 },
      );
    const updated = await updateTracking(
      id,
      input.data.status,
      input.data.seen ?? false,
    );
    return updated
      ? Response.json({ ok: true })
      : Response.json({ error: "Oferta inexistente." }, { status: 404 });
  } catch {
    return Response.json(
      { error: "No se pudo guardar el cambio." },
      { status: 500 },
    );
  }
}

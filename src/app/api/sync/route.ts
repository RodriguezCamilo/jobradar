import { synchronize } from "@/lib/sync";
import { assertLocalRequest } from "@/lib/security";
export const runtime = "nodejs";
export async function POST(request: Request) {
  const blocked = assertLocalRequest(request, true);
  if (blocked) return blocked;
  try {
    return Response.json({ runs: await synchronize() });
  } catch {
    return Response.json(
      {
        error:
          "No se pudo sincronizar. Comprobar conexión, migración o una sincronización en curso.",
      },
      { status: 409 },
    );
  }
}

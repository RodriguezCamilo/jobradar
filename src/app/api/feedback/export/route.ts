import { assertLocalRequest } from "@/lib/security";
import { exportFeedback } from "@/lib/repository";
export const runtime = "nodejs";
export async function GET(request: Request) {
  const blocked = assertLocalRequest(request);
  if (blocked) return blocked;
  try {
    return Response.json(
      {
        version: 1,
        exported_at: new Date().toISOString(),
        offers: await exportFeedback(),
      },
      {
        headers: {
          "Content-Disposition":
            'attachment; filename="job-radar-feedback.json"',
          "Cache-Control": "no-store",
        },
      },
    );
  } catch {
    return Response.json(
      { error: "No se pudo exportar el resumen." },
      { status: 500 },
    );
  }
}

import { loadRadar } from "@/lib/radar";
import { assertLocalRequest } from "@/lib/security";
export const runtime = "nodejs";
export async function GET(request: Request) {
  const blocked = assertLocalRequest(request);
  if (blocked) return blocked;
  return Response.json(await loadRadar(), {
    headers: { "Cache-Control": "no-store" },
  });
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public retryAt: string | null,
    message: string,
  ) {
    super(message);
  }
}
export function retryAfterDate(value: string | null, now = Date.now()): string {
  const milliseconds =
    value && /^\d+$/.test(value)
      ? now + Number(value) * 1000
      : Date.parse(value || "");
  return new Date(
    Number.isFinite(milliseconds)
      ? Math.max(milliseconds, now + 1000)
      : now + 60000,
  ).toISOString();
}
export async function fetchJson(
  url: string,
  init: RequestInit = {},
): Promise<unknown> {
  const response = await fetch(url, {
    ...init,
    cache: "no-store",
    signal: AbortSignal.timeout(20000),
    headers: {
      Accept: "application/json",
      "User-Agent": "JobRadar/0.1 (personal local job search)",
      ...init.headers,
    },
  });
  if (!response.ok) {
    const retryAt =
      response.status === 429
        ? retryAfterDate(response.headers.get("retry-after"))
        : null;
    // Do not echo response bodies or authorization headers into logs.
    throw new ApiError(
      response.status,
      retryAt,
      `API HTTP ${response.status}${retryAt ? `; reintentar después de ${retryAt}` : ""}`,
    );
  }
  return response.json();
}
export const pause = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

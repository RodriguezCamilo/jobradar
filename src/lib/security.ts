export function assertLocalRequest(
  request: Request,
  mutation = false,
): Response | null {
  // Next's internal URL can canonicalize 127.0.0.1 to localhost. Validate the
  // incoming Host and compare Origin against that exact local authority.
  const internalUrl = new URL(request.url);
  let url: URL;
  try {
    url = request.headers.get("host")
      ? new URL(`${internalUrl.protocol}//${request.headers.get("host")}`)
      : internalUrl;
  } catch {
    return Response.json({ error: "Host inválido." }, { status: 403 });
  }
  if (!["127.0.0.1", "localhost", "[::1]"].includes(url.hostname))
    return Response.json(
      {
        error:
          "MVP habilitado solo en localhost. Se requiere autenticación antes de desplegar.",
      },
      { status: 403 },
    );
  const origin = request.headers.get("origin");
  if ((mutation && origin !== url.origin) || (origin && origin !== url.origin))
    return Response.json({ error: "Origen no autorizado." }, { status: 403 });
  if (request.headers.get("sec-fetch-site") === "cross-site")
    return Response.json(
      { error: "Solicitud externa rechazada." },
      { status: 403 },
    );
  return null;
}

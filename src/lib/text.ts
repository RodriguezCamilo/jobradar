import he from "he";

export function plainText(html: string): string {
  return he
    .decode(
      html
        .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
        .replace(/<\/(p|div|h[1-6]|li)>|<br\s*\/?\s*>/gi, "\n")
        .replace(/<[^>]*>/g, " "),
    )
    .replace(/[\t ]+/g, " ")
    .replace(/\n\s*\n/g, "\n")
    .trim();
}

/** Identity only. Never use this value as the actual Apply URL. */
export function normalizeJobUrl(raw: string): string | null {
  try {
    const url = new URL(raw);
    if (!["https:", "http:"].includes(url.protocol)) return null;
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) {
      if (/^(utm_.+|ref|referrer|source|gh_src|fbclid|gclid)$/i.test(key))
        url.searchParams.delete(key);
    }
    url.hostname = url.hostname.toLowerCase().replace(/^www\./, "");
    url.pathname = url.pathname.replace(/\/+$/, "") || "/";
    // Bare home/careers URLs are insufficient evidence that two jobs are identical.
    if (/^\/(careers?|jobs?|apply)?\/?$/i.test(url.pathname) && !url.search)
      return null;
    url.searchParams.sort();
    return url.toString();
  } catch {
    return null;
  }
}

export function unixDate(value: number | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value * 1000);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

const FALLBACK = "/dashboard";

export function isSafeInternalPath(value: string) {
  if (!value.startsWith("/") || value.length > 2_048) return false;
  if (/[\0\r\n\t\\]/.test(value) || value.includes("://")) return false;
  try {
    const origin = "https://dingodocs.invalid";
    const url = new URL(value, origin);
    return (
      url.origin === origin &&
      !url.username &&
      !url.password &&
      url.pathname.startsWith("/") &&
      !url.pathname.startsWith("//")
    );
  } catch {
    return false;
  }
}

export function safeInternalPath(
  value: string | null | undefined,
  fallback = FALLBACK,
) {
  if (!value || !isSafeInternalPath(value)) return fallback;
  const origin = "https://dingodocs.invalid";
  const url = new URL(value, origin);
  return `${url.pathname}${url.search}${url.hash}`;
}

export function redactHeaders(headers: Record<string, any>) {
  const h = { ...headers };
  const redactList = ["authorization","x-api-key","cookie","x-apim-secret"];
  for (const k of Object.keys(h)) if (redactList.includes(k.toLowerCase())) h[k] = "***REDACTED***";
  return h;
}

const configuredApiUrl = process.env.NEXT_PUBLIC_API_URL;

export function getPublicApiUrl() {
  if (!configuredApiUrl) {
    throw new Error("NEXT_PUBLIC_API_URL is not configured");
  }
  const url = new URL(configuredApiUrl);
  if (url.protocol !== "https:" && url.hostname !== "127.0.0.1" && url.hostname !== "localhost") {
    throw new Error("NEXT_PUBLIC_API_URL must use HTTPS outside local development");
  }
  return url.toString().replace(/\/$/, "");
}

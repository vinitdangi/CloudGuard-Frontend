export function resolveApiBaseUrl({
  isProduction,
  browserOrigin,
  configuredBaseUrl,
}) {
  if (isProduction && browserOrigin) return browserOrigin;
  return configuredBaseUrl?.trim() ?? "";
}

export function apiProxyDestination(configuredBaseUrl) {
  const origin = configuredBaseUrl?.trim().replace(/\/+$/, "");
  if (!origin) return [];
  return [{ source: "/api/:path*", destination: `${origin}/api/:path*` }];
}

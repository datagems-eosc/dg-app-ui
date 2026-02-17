export function getRcaiBackendUrl(): string {
  return process.env.NEXT_PUBLIC_RCAI_BACKEND_URL || "http://localhost:8000";
}

export function getRcaiBackendWebSocketUrl(): string {
  return (
    process.env.NEXT_PUBLIC_RCAI_BACKEND_WEBSOCKET_URL || "ws://localhost:8000"
  );
}

function normalizeBaseUrl(raw: string): URL {
  const url = new URL(raw);
  // Normalize pathname to no trailing slash except root
  if (url.pathname.length > 1 && url.pathname.endsWith("/")) {
    url.pathname = url.pathname.replace(/\/+$/, "");
  }
  return url;
}

export function buildRcaiApiUrl(pathWithinRcai: string): string {
  const base = normalizeBaseUrl(getRcaiBackendUrl());

  const normalizedPath = pathWithinRcai.startsWith("/")
    ? pathWithinRcai
    : `/${pathWithinRcai}`;

  // Allow NEXT_PUBLIC_RCAI_BACKEND_URL to be either:
  // - http(s)://host:port
  // - http(s)://host:port/rapidcore_ai
  // - http(s)://host:port/<some-prefix>/rapidcore_ai
  const hasRapidcorePrefix = base.pathname.endsWith("/rapidcore_ai");

  const basePathPrefix = base.pathname === "/" ? "" : base.pathname;
  const rcaiPrefixPath = hasRapidcorePrefix
    ? basePathPrefix
    : `${basePathPrefix}/rapidcore_ai`;

  const finalPath = `${rcaiPrefixPath}${normalizedPath}`.replace(/\/+/g, "/");
  const url = new URL(base.toString());
  url.pathname = finalPath;
  return url.toString();
}

export function buildRcaiWebSocketUrl(token: string): string {
  const base = normalizeBaseUrl(getRcaiBackendWebSocketUrl());

  // Allow NEXT_PUBLIC_RCAI_BACKEND_WEBSOCKET_URL to be either:
  // - ws(s)://host:port
  // - ws(s)://host:port/ws/chat/
  const path = base.pathname || "/";
  const hasWsChat = /(^|\/)ws\/chat\/?$/.test(path);

  const wsPath = hasWsChat ? "/ws/chat/" : "/ws/chat/";
  base.pathname = wsPath;
  base.searchParams.set("token", token);

  return base.toString();
}

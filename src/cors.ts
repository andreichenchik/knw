import type { MiddlewareHandler } from "hono";

/** Adds exact-origin CORS headers when CORS_ORIGINS is configured. */
export function allowlistCors(allowedOrigins: string[]): MiddlewareHandler {
  const allowed = new Set(allowedOrigins);

  return async (c, next) => {
    const origin = c.req.header("Origin");
    const isAllowedOrigin = origin !== undefined && allowed.has(origin);

    if (isAllowedOrigin) {
      setCorsHeaders(c, origin);
    }

    if (c.req.method === "OPTIONS" && isAllowedOrigin) {
      return c.body(null, 204);
    }

    await next();
  };
}

function setCorsHeaders(
  c: Parameters<MiddlewareHandler>[0],
  origin: string
): void {
  c.header("Access-Control-Allow-Origin", origin);
  c.header("Vary", "Origin");
  c.header("Access-Control-Allow-Methods", "GET,POST,DELETE,OPTIONS");
  c.header("Access-Control-Allow-Headers", "Authorization,Content-Type");
}

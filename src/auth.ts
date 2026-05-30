import type { MiddlewareHandler } from "hono";
import { UnauthorizedError } from "./errors";

/** Requires `Authorization: Bearer <token>` for protected API routes. */
export function bearerAuth(apiToken: string): MiddlewareHandler {
  return async (c, next) => {
    const authorization = c.req.header("Authorization");
    if (authorization !== `Bearer ${apiToken}`) {
      throw new UnauthorizedError();
    }
    await next();
  };
}

import { Hono } from "hono";
import { bearerAuth } from "./auth";
import { allowlistCors } from "./cors";
import type { FactResult } from "./domain/facts";
import {
  AppError,
  errorResponse,
  ReadinessError,
  ValidationError,
} from "./errors";

export interface FactsApi {
  /** Deletes a fact by UUID and returns whether it existed. */
  delete(id: string): Promise<boolean>;

  /** Retrieves facts ordered by rerank score descending. */
  retrieve(query: unknown, limit?: unknown): Promise<FactResult[]>;
  /** Stores facts and returns generated UUIDs. */
  store(facts: unknown): Promise<string[]>;
}

export interface HealthCheck {
  /** Verifies the database schema is ready to serve traffic. */
  check(): Promise<void>;
}

export interface AppDependencies {
  apiToken: string;
  corsOrigins: string[];
  facts: FactsApi;
  health: HealthCheck;
}

/** Creates the Hono application with route wiring and middleware. */
export function createApp(deps: AppDependencies): Hono {
  const app = new Hono();

  app.use("*", allowlistCors(deps.corsOrigins));

  app.get("/health", async (c) => {
    try {
      await deps.health.check();
      return c.json({ ok: true });
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new ReadinessError("Database readiness check failed");
    }
  });

  app.use("*", bearerAuth(deps.apiToken));

  app.post("/facts", async (c) => {
    const body = await readJson(c.req.raw);
    if (!isRecord(body)) {
      throw new ValidationError("request body must be an object");
    }

    const ids = await deps.facts.store(body.facts);
    return c.json({ ids });
  });

  app.post("/search", async (c) => {
    const body = await readJson(c.req.raw);
    if (!isRecord(body)) {
      throw new ValidationError("request body must be an object");
    }

    const results = await deps.facts.retrieve(body.query, body.limit);
    return c.json({ results });
  });

  app.delete("/facts/:id", async (c) => {
    const deleted = await deps.facts.delete(c.req.param("id"));
    return c.json({ deleted });
  });

  app.notFound((c) =>
    c.json(errorResponse("not_found", "Route not found"), 404)
  );

  app.onError((error, c) => {
    if (error instanceof AppError) {
      return c.json(errorResponse(error.code, error.message), error.status);
    }

    console.error(error);
    return c.json(
      errorResponse("internal_error", "Unexpected internal error"),
      500
    );
  });

  return app;
}

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new ValidationError("request body must be valid JSON");
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

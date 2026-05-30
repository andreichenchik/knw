import { describe, expect, it } from "bun:test";
import { createApp, type FactsApi } from "../src/app";
import { ValidationError } from "../src/errors";

const token = "secret";

describe("HTTP app", () => {
  it("serves health without auth", async () => {
    let checked = false;
    const app = createApp({
      apiToken: token,
      corsOrigins: [],
      facts: factsApi(),
      health: {
        check: () => {
          checked = true;
          return Promise.resolve();
        },
      },
    });

    const res = await app.request("/health");

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(checked).toBe(true);
  });

  it("returns 503 when health readiness fails", async () => {
    const app = createApp({
      apiToken: token,
      corsOrigins: [],
      facts: factsApi(),
      health: {
        check: () => Promise.reject(new Error("down")),
      },
    });

    const res = await app.request("/health");

    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({
      error: {
        code: "readiness_failure",
        message: "Database readiness check failed",
      },
    });
  });

  it("requires bearer auth on protected routes", async () => {
    const app = createApp({
      apiToken: token,
      corsOrigins: [],
      facts: factsApi(),
      health: okHealth(),
    });

    const missing = await app.request("/facts", { method: "POST", body: "{}" });
    const wrong = await app.request("/facts", {
      method: "POST",
      headers: { Authorization: "Bearer wrong" },
      body: "{}",
    });

    expect(missing.status).toBe(401);
    expect(wrong.status).toBe(401);
  });

  it("stores facts, searches, and deletes through the API", async () => {
    const app = createApp({
      apiToken: token,
      corsOrigins: [],
      facts: factsApi({
        store: (facts) => {
          expect(facts).toEqual(["a"]);
          return Promise.resolve(["550e8400-e29b-41d4-a716-446655440000"]);
        },
        retrieve: (query, limit) => {
          expect(query).toBe("a");
          expect(limit).toBe(1);
          return Promise.resolve([{ content: "a", id: "id", score: 0.75 }]);
        },
        delete: (id) =>
          Promise.resolve(id === "550e8400-e29b-41d4-a716-446655440000"),
      }),
      health: okHealth(),
    });

    const headers = authHeaders();
    const created = await app.request("/facts", {
      method: "POST",
      headers,
      body: JSON.stringify({ facts: ["a"] }),
    });
    const searched = await app.request("/search", {
      method: "POST",
      headers,
      body: JSON.stringify({ query: "a", limit: 1 }),
    });
    const deleted = await app.request(
      "/facts/550e8400-e29b-41d4-a716-446655440000",
      {
        method: "DELETE",
        headers,
      }
    );

    expect(created.status).toBe(200);
    expect(await created.json()).toEqual({
      ids: ["550e8400-e29b-41d4-a716-446655440000"],
    });
    expect(await searched.json()).toEqual({
      results: [{ id: "id", content: "a", score: 0.75 }],
    });
    expect(await deleted.json()).toEqual({ deleted: true });
  });

  it("returns structured 400 errors for invalid JSON/body", async () => {
    const app = createApp({
      apiToken: token,
      corsOrigins: [],
      facts: factsApi(),
      health: okHealth(),
    });

    const invalidJson = await app.request("/facts", {
      method: "POST",
      headers: authHeaders(),
      body: "{",
    });
    const invalidBody = await app.request("/facts", {
      method: "POST",
      headers: authHeaders(),
      body: "[]",
    });

    expect(invalidJson.status).toBe(400);
    expect(invalidBody.status).toBe(400);
  });

  it("handles CORS only for configured exact origins before auth", async () => {
    const app = createApp({
      apiToken: token,
      corsOrigins: ["https://app.example.com"],
      facts: factsApi(),
      health: okHealth(),
    });

    const allowed = await app.request("/facts", {
      method: "OPTIONS",
      headers: { Origin: "https://app.example.com" },
    });
    const disallowed = await app.request("/facts", {
      method: "OPTIONS",
      headers: { Origin: "https://other.example.com" },
    });

    expect(allowed.status).toBe(204);
    expect(allowed.headers.get("Access-Control-Allow-Origin")).toBe(
      "https://app.example.com"
    );
    expect(disallowed.status).toBe(401);
    expect(disallowed.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });

  it("does not emit CORS headers when disabled", async () => {
    const app = createApp({
      apiToken: token,
      corsOrigins: [],
      facts: factsApi(),
      health: okHealth(),
    });

    const res = await app.request("/health", {
      headers: { Origin: "https://app.example.com" },
    });

    expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });

  it("returns structured 404 responses", async () => {
    const app = createApp({
      apiToken: token,
      corsOrigins: [],
      facts: factsApi(),
      health: okHealth(),
    });

    const res = await app.request("/missing", { headers: authHeaders() });

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({
      error: { code: "not_found", message: "Route not found" },
    });
  });
});

function factsApi(overrides: Partial<FactsApi> = {}): FactsApi {
  return {
    delete: () => Promise.resolve(false),
    retrieve: () => Promise.resolve([]),
    store: () => Promise.reject(new ValidationError("not implemented")),
    ...overrides,
  };
}

function okHealth() {
  return { check: () => Promise.resolve() };
}

function authHeaders() {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

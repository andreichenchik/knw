import { ValidationError } from "./errors";

export interface ValidationConfig {
  candidateK: number;
  maxFactChars: number;
  maxFactsPerRequest: number;
  resultK: number;
}

export interface SearchRequest {
  limit: number;
  query: string;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Validates, trims, and returns facts that are safe to embed and store. */
export function validateFactsInput(
  value: unknown,
  config: ValidationConfig
): string[] {
  if (!Array.isArray(value)) {
    throw new ValidationError("facts must be an array");
  }

  if (value.length < 1 || value.length > config.maxFactsPerRequest) {
    throw new ValidationError(
      `facts length must be between 1 and ${config.maxFactsPerRequest}`
    );
  }

  const seen = new Set<string>();
  const facts: string[] = [];

  for (const fact of value) {
    if (typeof fact !== "string") {
      throw new ValidationError("each fact must be a string");
    }

    const normalized = fact.trim();
    if (!normalized) {
      throw new ValidationError("facts must not be empty");
    }

    if (normalized.length > config.maxFactChars) {
      throw new ValidationError(
        `each fact must be at most ${config.maxFactChars} characters`
      );
    }

    if (seen.has(normalized)) {
      throw new ValidationError(
        "duplicate facts are not allowed within one request"
      );
    }

    seen.add(normalized);
    facts.push(normalized);
  }

  return facts;
}

/** Validates, trims, and returns a search query plus resolved result limit. */
export function validateSearchInput(
  body: unknown,
  config: ValidationConfig
): SearchRequest {
  if (!isRecord(body)) {
    throw new ValidationError("request body must be an object");
  }

  if (typeof body.query !== "string") {
    throw new ValidationError("query must be a string");
  }

  const query = body.query.trim();
  if (!query) {
    throw new ValidationError("query must not be empty");
  }

  const limit = body.limit === undefined ? config.resultK : body.limit;
  if (
    typeof limit !== "number" ||
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > config.candidateK
  ) {
    throw new ValidationError(
      `limit must be an integer between 1 and ${config.candidateK}`
    );
  }

  return { query, limit };
}

/** Returns true when value is a syntactically valid UUID string. */
export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

export function assertUuid(value: string): void {
  if (!isUuid(value)) {
    throw new ValidationError("id must be a valid UUID");
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

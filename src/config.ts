import { ValidationError } from "./errors";

export interface AppConfig {
  apiToken: string;
  candidateK: number;
  corsOrigins: string[];
  databaseUrl: string;
  embedDim: number;
  embedModel: string;
  maxFactChars: number;
  maxFactsPerRequest: number;
  queryModel: string;
  rerankModel: string;
  resultK: number;
  voyageApiKey: string;
}

const DEFAULTS = {
  embedModel: "voyage-4",
  queryModel: "voyage-4-lite",
  rerankModel: "rerank-2.5-lite",
  embedDim: 1024,
  candidateK: 50,
  resultK: 10,
  maxFactsPerRequest: 100,
  maxFactChars: 2000,
} as const;

/** Parses environment variables and applies SPEC defaults. */
export function parseConfig(
  env: Record<string, string | undefined>
): AppConfig {
  const databaseUrl = required(env.DATABASE_URL, "DATABASE_URL");
  const voyageApiKey = required(env.VOYAGE_API_KEY, "VOYAGE_API_KEY");
  const apiToken = required(env.API_TOKEN, "API_TOKEN");
  const candidateK = positiveInt(
    env.CANDIDATE_K,
    "CANDIDATE_K",
    DEFAULTS.candidateK
  );
  const resultK = positiveInt(env.RESULT_K, "RESULT_K", DEFAULTS.resultK);

  if (resultK > candidateK) {
    throw new ValidationError(
      "RESULT_K must be less than or equal to CANDIDATE_K"
    );
  }

  return {
    databaseUrl,
    voyageApiKey,
    apiToken,
    embedModel: env.EMBED_MODEL?.trim() || DEFAULTS.embedModel,
    queryModel: env.QUERY_MODEL?.trim() || DEFAULTS.queryModel,
    rerankModel: env.RERANK_MODEL?.trim() || DEFAULTS.rerankModel,
    embedDim: positiveInt(env.EMBED_DIM, "EMBED_DIM", DEFAULTS.embedDim),
    candidateK,
    resultK,
    maxFactsPerRequest: positiveInt(
      env.MAX_FACTS_PER_REQUEST,
      "MAX_FACTS_PER_REQUEST",
      DEFAULTS.maxFactsPerRequest
    ),
    maxFactChars: positiveInt(
      env.MAX_FACT_CHARS,
      "MAX_FACT_CHARS",
      DEFAULTS.maxFactChars
    ),
    corsOrigins: parseCorsOrigins(env.CORS_ORIGINS),
  };
}

function required(value: string | undefined, name: string): string {
  const normalized = value?.trim();
  if (!normalized) {
    throw new ValidationError(`${name} is required`);
  }
  return normalized;
}

function positiveInt(
  value: string | undefined,
  name: string,
  fallback: number
): number {
  if (value === undefined || value.trim() === "") {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new ValidationError(`${name} must be a positive integer`);
  }
  return parsed;
}

function parseCorsOrigins(value: string | undefined): string[] {
  if (!value?.trim()) {
    return [];
  }
  return value
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

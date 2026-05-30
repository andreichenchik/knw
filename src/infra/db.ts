import postgres from "postgres";
import { ReadinessError, ValidationError } from "../errors";

export type Sql = ReturnType<typeof postgres>;

const VECTOR_TYPE_PATTERN = /^vector\((\d+)\)$/;

/** Opens a postgres.js connection pool for the injected DATABASE_URL. */
export function createSql(databaseUrl: string): Sql {
  return postgres(databaseUrl, { max: 5 });
}

/** Ensures pgvector and the isolated `knw.fact` table exist with the expected dimension. */
export async function ensureSchema(sql: Sql, embedDim: number): Promise<void> {
  if (!Number.isInteger(embedDim) || embedDim <= 0) {
    throw new ValidationError("EMBED_DIM must be a positive integer");
  }

  await sql`CREATE EXTENSION IF NOT EXISTS vector`;
  await sql`CREATE SCHEMA IF NOT EXISTS knw`;
  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS knw.fact (
      id UUID PRIMARY KEY,
      content TEXT NOT NULL,
      embedding VECTOR(${embedDim}) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await assertVectorDimension(sql, embedDim);

  await sql`
    CREATE INDEX IF NOT EXISTS fact_embedding_hnsw
    ON knw.fact USING hnsw (embedding vector_cosine_ops)
  `;
}

/** Performs the readiness read used by `/health`. */
export async function healthRead(sql: Sql): Promise<void> {
  try {
    await sql`SELECT id FROM knw.fact LIMIT 1`;
  } catch (error) {
    throw new ReadinessError(
      error instanceof Error ? error.message : "Database readiness check failed"
    );
  }
}

async function assertVectorDimension(
  sql: Sql,
  embedDim: number
): Promise<void> {
  const rows = await sql<{ type: string }[]>`
    SELECT format_type(a.atttypid, a.atttypmod) AS type
    FROM pg_attribute a
    WHERE a.attrelid = 'knw.fact'::regclass
      AND a.attname = 'embedding'
      AND NOT a.attisdropped
  `;
  const type = rows[0]?.type;
  const match = VECTOR_TYPE_PATTERN.exec(type ?? "");

  if (!match || Number(match[1]) !== embedDim) {
    throw new Error(
      `knw.fact.embedding dimension mismatch: expected vector(${embedDim}), found ${type}`
    );
  }
}

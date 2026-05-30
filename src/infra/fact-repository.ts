import type {
  FactCandidate,
  FactRepository,
  StoredFact,
} from "../domain/facts";
import type { Sql } from "./db";
import { toVectorLiteral } from "./vector";

/** Postgres/pgvector implementation of fact persistence and ANN lookup. */
export class PostgresFactRepository implements FactRepository {
  private readonly sql: Sql;

  constructor(sql: Sql) {
    this.sql = sql;
  }

  async insertMany(facts: StoredFact[]): Promise<void> {
    if (facts.length === 0) {
      return;
    }

    const contents = facts.map((fact) => fact.content);
    const embeddings = facts.map((fact) => toVectorLiteral(fact.embedding));
    const ids = facts.map((fact) => fact.id);

    await this.sql`
      INSERT INTO knw.fact (id, content, embedding)
      SELECT id, content, embedding::vector
      FROM UNNEST(${ids}::uuid[], ${contents}::text[], ${embeddings}::text[]) AS rows(id, content, embedding)
    `;
  }

  async searchByEmbedding(
    embedding: number[],
    limit: number
  ): Promise<FactCandidate[]> {
    const rows = await this.sql<FactCandidate[]>`
      SELECT id::text AS id, content
      FROM knw.fact
      ORDER BY embedding <=> ${toVectorLiteral(embedding)}::vector
      LIMIT ${limit}
    `;
    return rows.map((row) => ({ id: row.id, content: row.content }));
  }

  async delete(id: string): Promise<boolean> {
    const rows = await this.sql<{ id: string }[]>`
      DELETE FROM knw.fact
      WHERE id = ${id}::uuid
      RETURNING id::text AS id
    `;
    return rows.length > 0;
  }
}

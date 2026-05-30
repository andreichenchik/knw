import { randomUUID } from "node:crypto";
import {
  assertUuid,
  type ValidationConfig,
  validateFactsInput,
  validateSearchInput,
} from "../validation";

export interface FactResult {
  content: string;
  id: string;
  score: number;
}

export interface StoredFact {
  content: string;
  embedding: number[];
  id: string;
}

export interface FactCandidate {
  content: string;
  id: string;
}

export interface RerankResult {
  index: number;
  relevanceScore: number;
}

export interface FactRepository {
  /** Deletes one fact by ID and returns whether a row was removed. */
  delete(id: string): Promise<boolean>;

  /** Inserts already-normalized facts with application-generated IDs and embeddings. */
  insertMany(facts: StoredFact[]): Promise<void>;

  /** Returns ANN candidates ordered by vector distance from best to worst. */
  searchByEmbedding(
    embedding: number[],
    limit: number
  ): Promise<FactCandidate[]>;
}

export interface RetrievalModel {
  /** Embeds facts for persistent storage in the document vector space. */
  embedDocuments(facts: string[]): Promise<number[][]>;

  /** Embeds a user query in the query vector space. */
  embedQuery(query: string): Promise<number[]>;

  /** Reranks candidate document text against the original query. */
  rerank(
    query: string,
    documents: string[],
    topK: number
  ): Promise<RerankResult[]>;
}

/** Stores, retrieves, and deletes atomic facts using vector search plus reranking. */
export class FactsService {
  private readonly config: ValidationConfig;
  private readonly model: RetrievalModel;
  private readonly repository: FactRepository;

  constructor(
    repository: FactRepository,
    model: RetrievalModel,
    config: ValidationConfig
  ) {
    this.repository = repository;
    this.model = model;
    this.config = config;
  }

  async store(factsInput: unknown): Promise<string[]> {
    const facts = validateFactsInput(factsInput, this.config);
    const embeddings = await this.model.embedDocuments(facts);

    const rows = facts.map((content, index) => ({
      id: randomUUID(),
      content,
      embedding: embeddings[index],
    }));

    await this.repository.insertMany(rows);
    return rows.map((row) => row.id);
  }

  async retrieve(
    queryInput: unknown,
    limitInput?: unknown
  ): Promise<FactResult[]> {
    const { query, limit } = validateSearchInput(
      { query: queryInput, limit: limitInput },
      this.config
    );
    const embedding = await this.model.embedQuery(query);
    const candidates = await this.repository.searchByEmbedding(
      embedding,
      this.config.candidateK
    );

    if (candidates.length === 0) {
      return [];
    }

    const reranked = await this.model.rerank(
      query,
      candidates.map((candidate) => candidate.content),
      candidates.length
    );

    return reranked
      .map((result) => ({ result, candidate: candidates[result.index] }))
      .filter(
        (entry): entry is { result: RerankResult; candidate: FactCandidate } =>
          Boolean(entry.candidate)
      )
      .sort((a, b) => b.result.relevanceScore - a.result.relevanceScore)
      .slice(0, limit)
      .map(({ result, candidate }) => ({
        id: candidate.id,
        content: candidate.content,
        score: result.relevanceScore,
      }));
  }

  delete(id: string): Promise<boolean> {
    assertUuid(id);
    return this.repository.delete(id);
  }
}

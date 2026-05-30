import type { RerankResult, RetrievalModel } from "../domain/facts";
import { ExternalServiceError } from "../errors";

export interface VoyageClientConfig {
  apiKey: string;
  embedDim: number;
  embedModel: string;
  queryModel: string;
  rerankModel: string;
}

type Fetcher = (
  url: string,
  init?: RequestInit
) => Promise<Response> | Response;

/** Direct REST client for Voyage embeddings and reranking. */
export class VoyageClient implements RetrievalModel {
  private readonly config: VoyageClientConfig;
  private readonly fetcher: Fetcher;

  constructor(config: VoyageClientConfig, fetcher: Fetcher = fetch) {
    this.config = config;
    this.fetcher = fetcher;
  }

  embedDocuments(facts: string[]): Promise<number[][]> {
    return this.embed(facts, this.config.embedModel, "document");
  }

  async embedQuery(query: string): Promise<number[]> {
    const embeddings = await this.embed(
      [query],
      this.config.queryModel,
      "query"
    );
    return embeddings[0];
  }

  async rerank(
    query: string,
    documents: string[],
    topK: number
  ): Promise<RerankResult[]> {
    const json = await this.postJson("https://api.voyageai.com/v1/rerank", {
      query,
      documents,
      model: this.config.rerankModel,
      top_k: topK,
    });

    const results = readArrayField(json, ["results", "data"]);
    return results.map((item) => {
      if (
        !isRecord(item) ||
        typeof item.index !== "number" ||
        typeof item.relevance_score !== "number"
      ) {
        throw new ExternalServiceError("Voyage rerank response was malformed");
      }
      return { index: item.index, relevanceScore: item.relevance_score };
    });
  }

  private async embed(
    input: string[],
    model: string,
    inputType: "document" | "query"
  ): Promise<number[][]> {
    const json = await this.postJson("https://api.voyageai.com/v1/embeddings", {
      input,
      model,
      input_type: inputType,
    });

    const embeddings = parseEmbeddings(json);
    for (const embedding of embeddings) {
      if (embedding.length !== this.config.embedDim) {
        throw new ExternalServiceError(
          `Voyage embedding dimension mismatch: expected ${this.config.embedDim}, received ${embedding.length}`
        );
      }
    }
    return embeddings;
  }

  private async postJson(url: string, body: unknown): Promise<unknown> {
    let response: Response;
    try {
      response = await this.fetcher(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
    } catch (error) {
      throw new ExternalServiceError(
        error instanceof Error ? error.message : "Voyage API request failed"
      );
    }

    if (!response.ok) {
      throw new ExternalServiceError(
        `Voyage API failed with status ${response.status}`
      );
    }

    try {
      return await response.json();
    } catch {
      throw new ExternalServiceError("Voyage API returned invalid JSON");
    }
  }
}

function parseEmbeddings(json: unknown): number[][] {
  if (isRecord(json) && Array.isArray(json.embeddings)) {
    return assertEmbeddings(json.embeddings);
  }

  const data = isRecord(json) ? json.data : undefined;
  if (Array.isArray(data)) {
    return assertEmbeddings(
      data.map((item) => (isRecord(item) ? item.embedding : undefined))
    );
  }

  if (isRecord(data) && Array.isArray(data.embedding)) {
    return assertEmbeddings([data.embedding]);
  }

  throw new ExternalServiceError("Voyage embeddings response was malformed");
}

function assertEmbeddings(value: unknown[]): number[][] {
  return value.map((embedding) => {
    if (
      !Array.isArray(embedding) ||
      embedding.some((item) => typeof item !== "number")
    ) {
      throw new ExternalServiceError(
        "Voyage embeddings response was malformed"
      );
    }
    return embedding;
  });
}

function readArrayField(json: unknown, fields: string[]): unknown[] {
  if (!isRecord(json)) {
    throw new ExternalServiceError("Voyage response was malformed");
  }

  for (const field of fields) {
    const value = json[field];
    if (Array.isArray(value)) {
      return value;
    }
  }

  throw new ExternalServiceError("Voyage response was malformed");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

import { describe, expect, it } from "bun:test";
import {
  type FactRepository,
  FactsService,
  type RetrievalModel,
  type StoredFact,
} from "../src/domain/facts";
import { ValidationError } from "../src/errors";

const UUID_LIKE_PATTERN = /^[0-9a-f-]{36}$/;

const config = {
  candidateK: 5,
  maxFactChars: 20,
  maxFactsPerRequest: 3,
  resultK: 2,
};

describe("FactsService", () => {
  it("normalizes facts, embeds as documents, inserts rows, and returns UUIDs", async () => {
    const inserted: StoredFact[] = [];
    const model: RetrievalModel = {
      embedDocuments: (facts) =>
        Promise.resolve(facts.map((_, index) => [index, index + 1])),
      embedQuery: () => Promise.resolve([0]),
      rerank: () => Promise.resolve([]),
    };
    const service = new FactsService(repository({ inserted }), model, config);

    const ids = await service.store([" alpha ", "beta"]);

    expect(ids).toHaveLength(2);
    expect(ids[0]).toMatch(UUID_LIKE_PATTERN);
    expect(inserted.map((row) => row.content)).toEqual(["alpha", "beta"]);
    expect(inserted.map((row) => row.embedding)).toEqual([
      [0, 1],
      [1, 2],
    ]);
  });

  it("rejects duplicate normalized facts before embedding or insertion", async () => {
    let embedCalled = false;
    const model: RetrievalModel = {
      embedDocuments: () => {
        embedCalled = true;
        return Promise.resolve([]);
      },
      embedQuery: () => Promise.resolve([0]),
      rerank: () => Promise.resolve([]),
    };
    const service = new FactsService(repository(), model, config);

    await expect(service.store(["same", " same "])).rejects.toBeInstanceOf(
      ValidationError
    );
    expect(embedCalled).toBe(false);
  });

  it("retrieves candidates, reranks them, and returns the requested limit", async () => {
    const model: RetrievalModel = {
      embedDocuments: () => Promise.resolve([]),
      embedQuery: (query) => {
        expect(query).toBe("meaning");
        return Promise.resolve([0.4, 0.5]);
      },
      rerank: (query, documents, topK) => {
        expect(query).toBe("meaning");
        expect(documents).toEqual(["low", "high", "middle"]);
        expect(topK).toBe(3);
        return Promise.resolve([
          { index: 1, relevanceScore: 0.9 },
          { index: 2, relevanceScore: 0.5 },
          { index: 0, relevanceScore: 0.1 },
        ]);
      },
    };
    const service = new FactsService(
      repository({
        candidates: [
          { content: "low", id: "a" },
          { content: "high", id: "b" },
          { content: "middle", id: "c" },
        ],
      }),
      model,
      config
    );

    const results = await service.retrieve(" meaning ", 2);

    expect(results).toEqual([
      { content: "high", id: "b", score: 0.9 },
      { content: "middle", id: "c", score: 0.5 },
    ]);
  });

  it("validates search limits against CANDIDATE_K", async () => {
    const service = new FactsService(repository(), emptyModel(), config);

    await expect(service.retrieve("query", 6)).rejects.toBeInstanceOf(
      ValidationError
    );
  });

  it("validates UUIDs before deleting", () => {
    const service = new FactsService(repository(), emptyModel(), config);

    expect(() => service.delete("not-a-uuid")).toThrow(ValidationError);
  });
});

function repository(
  overrides: Partial<{
    candidates: { content: string; id: string }[];
    inserted: StoredFact[];
  }> = {}
): FactRepository {
  return {
    delete: () => Promise.resolve(true),
    insertMany: (facts) => {
      overrides.inserted?.push(...facts);
      return Promise.resolve();
    },
    searchByEmbedding: () => Promise.resolve(overrides.candidates ?? []),
  };
}

function emptyModel(): RetrievalModel {
  return {
    embedDocuments: () => Promise.resolve([]),
    embedQuery: () => Promise.resolve([]),
    rerank: () => Promise.resolve([]),
  };
}

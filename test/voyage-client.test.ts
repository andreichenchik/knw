import { describe, expect, it } from "bun:test";
import { ExternalServiceError } from "../src/errors";
import { VoyageClient } from "../src/infra/voyage-client";

const baseConfig = {
  apiKey: "voyage-key",
  embedModel: "voyage-4",
  queryModel: "voyage-4-lite",
  rerankModel: "rerank-2.5-lite",
  embedDim: 2,
};

describe("VoyageClient", () => {
  it("embeds documents with document input_type", async () => {
    const bodies: unknown[] = [];
    const client = new VoyageClient(baseConfig, (_url, init) => {
      bodies.push(JSON.parse(String(init?.body)));
      return Response.json({ data: [{ embedding: [0.1, 0.2] }] });
    });

    const embeddings = await client.embedDocuments(["fact"]);

    expect(embeddings).toEqual([[0.1, 0.2]]);
    expect(bodies).toEqual([
      { input: ["fact"], model: "voyage-4", input_type: "document" },
    ]);
  });

  it("embeds queries with query input_type", async () => {
    const bodies: unknown[] = [];
    const client = new VoyageClient(baseConfig, (_url, init) => {
      bodies.push(JSON.parse(String(init?.body)));
      return Response.json({ embeddings: [[0.3, 0.4]] });
    });

    const embedding = await client.embedQuery("question");

    expect(embedding).toEqual([0.3, 0.4]);
    expect(bodies).toEqual([
      { input: ["question"], model: "voyage-4-lite", input_type: "query" },
    ]);
  });

  it("reranks and maps Voyage response fields", async () => {
    const client = new VoyageClient(baseConfig, (_url, init) => {
      expect(JSON.parse(String(init?.body))).toEqual({
        query: "q",
        documents: ["a", "b"],
        model: "rerank-2.5-lite",
        top_k: 2,
      });
      return Response.json({ results: [{ index: 1, relevance_score: 0.9 }] });
    });

    await expect(client.rerank("q", ["a", "b"], 2)).resolves.toEqual([
      { index: 1, relevanceScore: 0.9 },
    ]);
  });

  it("surfaces Voyage failures as ExternalServiceError", async () => {
    const client = new VoyageClient(
      baseConfig,
      () => new Response("bad", { status: 500 })
    );

    await expect(client.embedDocuments(["fact"])).rejects.toBeInstanceOf(
      ExternalServiceError
    );
  });

  it("rejects embedding dimension mismatches", async () => {
    const client = new VoyageClient(baseConfig, () =>
      Response.json({ data: [{ embedding: [1] }] })
    );

    await expect(client.embedDocuments(["fact"])).rejects.toBeInstanceOf(
      ExternalServiceError
    );
  });
});

# Integrations

This project depends on external services for embeddings and reranking.

## Voyage AI

`knw` uses Voyage AI for:

- document embeddings when facts are stored;
- query embeddings when `/search` is called;
- reranking pgvector candidates before returning search results.

### API key

Create `VOYAGE_API_KEY` in the [Voyage dashboard API keys page](https://dashboard.voyageai.com/organization/api-keys) with **Create new secret key**.

Set it locally in `.env`:

```env
VOYAGE_API_KEY=your-voyage-api-key
```

Set it on Dokku:

```sh
dokku config:set knw VOYAGE_API_KEY="your-voyage-api-key"
```

Keep this key server-side only. Do not expose it to browser clients.

### Default models

The service defaults are:

| Env var | Default | Purpose |
| --- | --- | --- |
| `EMBED_MODEL` | `voyage-4` | Embeds facts for storage. |
| `QUERY_MODEL` | `voyage-4-lite` | Embeds search queries. |
| `RERANK_MODEL` | `rerank-2.5-lite` | Reranks candidate facts. |
| `EMBED_DIM` | `1024` | Vector dimension stored in Postgres. |

`EMBED_DIM` must match the document embedding model output dimension. Changing it for an existing table requires re-embedding stored facts.

### Free usage

At the time of writing, the default models are covered by Voyage free usage:

| Model | Used for | Free usage |
| --- | --- | --- |
| `voyage-4` | document embeddings | 200 million tokens |
| `voyage-4-lite` | query embeddings | 200 million tokens |
| `rerank-2.5-lite` | reranking | 200 million tokens |

See [Voyage pricing](https://docs.voyageai.com/docs/pricing) for current pricing and free-token details.

### Rate limits and billing

Before adding a payment method, free-trial rate limits are low: **3 RPM** and **10K TPM**. This is enough for a quick smoke test, but repeated searches can hit rate limits.

To move past free-trial limits, add billing in the Voyage dashboard. In practice, this may require an initial **$5 credit purchase/top-up**. After billing is enabled, the account moves to usage tier 1 and the free tokens still apply.

Tier 1 limits for the default models are:

| Model | Tier 1 TPM | Tier 1 RPM |
| --- | ---: | ---: |
| `voyage-4` | 8,000,000 | 2,000 |
| `voyage-4-lite` | 16,000,000 | 2,000 |
| `rerank-2.5-lite` | 4,000,000 | 2,000 |

See [Voyage rate limits](https://docs.voyageai.com/docs/rate-limits) for current limits and tier rules.

### Operational notes

- Batch fact insertion is more rate-limit friendly than sending one fact per request.
- `/search` uses both query embedding and reranking, so one search can consume more than one Voyage request.
- If you see rate-limit errors during manual testing, wait for the rate-limit window to reset or enable billing before continuing.

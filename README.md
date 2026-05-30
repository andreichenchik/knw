# knw

Bun + Hono facts retrieval service.

## Install

```sh
bun install
```

## Run locally

```sh
bun run dev
```

The service exports a Bun server on port `80` for Dokku.

## Deploy to Dokku

See [DOKKU.md](./DOKKU.md) for a fresh Dokku deployment with PostgreSQL and pgvector.

## Integrations

See [INTEGRATIONS.md](./INTEGRATIONS.md) for Voyage AI API key setup, default embedding/rerank models, free usage, billing, and rate limits.

## Check and test

```sh
bun run check
bun test
```

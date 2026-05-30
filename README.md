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

## Install the skill

After deploying the service, give your agent access to it by installing the bundled `knw` skill with [`npx skills`](https://skills.sh/):

```sh
npx skills add https://github.com/andreichenchik/knw --skill knw -y
```

Create `.env` beside the installed `SKILL.md` from `.env.example` and set `KNW_ENDPOINT` and `KNW_API_KEY`.

## Check and test

```sh
bun run check
bun test
```

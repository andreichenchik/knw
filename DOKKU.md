# Dokku deployment

This guide describes a fresh Dokku setup for `knw` with PostgreSQL and pgvector.

## Prerequisites

- A Dokku host with Docker installed.
- The Dokku Postgres plugin installed.
- A Voyage API key for embeddings and reranking. See [INTEGRATIONS.md](./INTEGRATIONS.md#voyage-ai).
- Git access from your local machine to the Dokku app remote.

Install the Postgres plugin if it is not installed yet:

```sh
sudo dokku plugin:install https://github.com/dokku/dokku-postgres.git postgres
```

## Create the app

```sh
dokku apps:create knw
```

## Create PostgreSQL with pgvector

Use the `pgvector/pgvector` image instead of the default Postgres image. For a new production database, prefer a stable Postgres major version such as Postgres 17:

```sh
dokku postgres:create knw-db \
  --image "pgvector/pgvector" \
  --image-version "pg17"
```

For stricter reproducibility, pin the pgvector version as well:

```sh
dokku postgres:create knw-db \
  --image "pgvector/pgvector" \
  --image-version "0.8.2-pg17"
```

The `pg17` tag receives pgvector updates for Postgres 17. The `0.8.2-pg17` tag keeps both the pgvector and Postgres major version explicit.

Link the database to the app:

```sh
dokku postgres:link knw-db knw
```

Dokku sets `DATABASE_URL` on the app when the database is linked.

## Configure app environment

See [INTEGRATIONS.md](./INTEGRATIONS.md#voyage-ai) for Voyage API key setup, default models, free usage, billing, and rate limits.

Set the required secrets:

```sh
dokku config:set knw \
  VOYAGE_API_KEY="your-voyage-api-key" \
  API_TOKEN="your-client-api-token"
```

Optional configuration can be set when the defaults are not appropriate:

```sh
dokku config:set knw \
  EMBED_MODEL="voyage-4" \
  QUERY_MODEL="voyage-4-lite" \
  RERANK_MODEL="rerank-2.5-lite" \
  EMBED_DIM="1024" \
  CANDIDATE_K="50" \
  RESULT_K="10" \
  MAX_FACTS_PER_REQUEST="100" \
  MAX_FACT_CHARS="2000"
```

Set CORS origins only if browser clients need cross-origin access:

```sh
dokku config:set knw CORS_ORIGINS="https://example.com,https://app.example.com"
```

## Deploy

Add the Dokku remote locally:

```sh
git remote add dokku dokku@your-dokku-host:knw
```

Deploy:

```sh
git push dokku main
```

## Schema initialization

No manual SQL step is required for a fresh deployment. On startup, the service runs:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
CREATE SCHEMA IF NOT EXISTS knw;
```

It also creates the `knw.fact` table and the HNSW vector index if they do not exist.

The `pgvector/pgvector` image is still required: it installs the pgvector extension files into Postgres. `CREATE EXTENSION IF NOT EXISTS vector` only enables that installed extension inside the database.

## Verify

Check the app logs:

```sh
dokku logs knw --tail
```

Check the app process:

```sh
dokku ps:report knw
```

Check the linked database URL:

```sh
dokku config:get knw DATABASE_URL
```

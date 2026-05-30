import { createApp } from "./app";
import { parseConfig } from "./config";
import { FactsService } from "./domain/facts";
import { createSql, ensureSchema, healthRead } from "./infra/db";
import { PostgresFactRepository } from "./infra/fact-repository";
import { VoyageClient } from "./infra/voyage-client";

const config = parseConfig(process.env);
const sql = createSql(config.databaseUrl);

await ensureSchema(sql, config.embedDim);

const facts = new FactsService(
  new PostgresFactRepository(sql),
  new VoyageClient({
    apiKey: config.voyageApiKey,
    embedModel: config.embedModel,
    queryModel: config.queryModel,
    rerankModel: config.rerankModel,
    embedDim: config.embedDim,
  }),
  config
);

const app = createApp({
  apiToken: config.apiToken,
  corsOrigins: config.corsOrigins,
  facts,
  health: { check: () => healthRead(sql) },
});

export default {
  port: 80,
  fetch: app.fetch,
};

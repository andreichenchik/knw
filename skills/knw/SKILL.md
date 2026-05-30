---
name: knw
description: Save and recall useful facts. Use when information should be remembered for later or relevant saved knowledge may help answer a request.
---

# knw

Use the bundled Python CLI to access the knw facts retrieval service. The service matches saved facts against a search query, so both facts and queries should carry enough context to stand on their own.

## Write Good Facts

Store atomic, self-contained facts. Each fact should express one useful idea and remain understandable without the surrounding conversation.

- Include the subject explicitly instead of relying on pronouns or implied context.
- Split unrelated details into separate facts.
- Preserve qualifiers that affect meaning, such as environment, project, person, or date.

Prefer `"The knw service is deployed in the eu-west-1 region."` over `"It is in eu-west-1."`

## Search With Context

Use search before answering when saved knowledge may be relevant. Include the relevant context from the user's request in the query so it can align well with self-contained facts. Do not search with vague fragments when the subject is known.

Prefer `"Which region hosts the knw service?"` over `"Which region?"`

## Configure

Create `.env` beside this `SKILL.md` from `.env.example` and set the service endpoint and API key. Do not print or expose the API key.

## Run

Invoke the script relative to this skill directory:

```sh
uv run scripts/knw.py health
uv run scripts/knw.py store "The knw service is deployed in the eu-west-1 region."
uv run scripts/knw.py search "Which region hosts the knw service?" --limit 5
uv run scripts/knw.py delete "550e8400-e29b-41d4-a716-446655440000"
```

Use `store` with multiple arguments to save several facts in one request. Read JSON from stdout. When a command fails, read the structured JSON error from stderr and report the failure without exposing credentials.

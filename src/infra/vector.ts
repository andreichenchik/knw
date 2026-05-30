import { ValidationError } from "../errors";

/** Serializes an embedding so pgvector can consume it as a `vector` value. */
export function toVectorLiteral(embedding: number[]): string {
  if (!Array.isArray(embedding) || embedding.length === 0) {
    throw new ValidationError("embedding must be a non-empty number array");
  }

  for (const value of embedding) {
    if (!Number.isFinite(value)) {
      throw new ValidationError("embedding must contain only finite numbers");
    }
  }

  return `[${embedding.join(",")}]`;
}

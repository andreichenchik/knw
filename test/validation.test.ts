import { describe, expect, it } from "bun:test";
import { ValidationError } from "../src/errors";
import {
  isUuid,
  validateFactsInput,
  validateSearchInput,
} from "../src/validation";

const config = {
  maxFactsPerRequest: 2,
  maxFactChars: 5,
  candidateK: 3,
  resultK: 2,
};

describe("validation", () => {
  it("validates and trims facts", () => {
    expect(validateFactsInput([" a ", "bb"], config)).toEqual(["a", "bb"]);
  });

  it("rejects invalid fact batches", () => {
    expect(() => validateFactsInput([], config)).toThrow(ValidationError);
    expect(() => validateFactsInput(["a", "b", "c"], config)).toThrow(
      ValidationError
    );
    expect(() => validateFactsInput([""], config)).toThrow(ValidationError);
    expect(() => validateFactsInput(["abcdef"], config)).toThrow(
      ValidationError
    );
    expect(() => validateFactsInput(["a", " a "], config)).toThrow(
      ValidationError
    );
    expect(() => validateFactsInput(["a", 1], config)).toThrow(ValidationError);
  });

  it("validates search input and applies default limit", () => {
    expect(validateSearchInput({ query: " q " }, config)).toEqual({
      query: "q",
      limit: 2,
    });
    expect(validateSearchInput({ query: "q", limit: 3 }, config)).toEqual({
      query: "q",
      limit: 3,
    });
  });

  it("rejects invalid search input", () => {
    expect(() => validateSearchInput({ query: "" }, config)).toThrow(
      ValidationError
    );
    expect(() => validateSearchInput({ query: "q", limit: 0 }, config)).toThrow(
      ValidationError
    );
    expect(() => validateSearchInput({ query: "q", limit: 4 }, config)).toThrow(
      ValidationError
    );
    expect(() =>
      validateSearchInput({ query: "q", limit: 1.5 }, config)
    ).toThrow(ValidationError);
  });

  it("checks UUID syntax", () => {
    expect(isUuid("550e8400-e29b-41d4-a716-446655440000")).toBe(true);
    expect(isUuid("not-a-uuid")).toBe(false);
  });
});

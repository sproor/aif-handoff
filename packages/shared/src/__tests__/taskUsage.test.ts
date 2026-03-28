import { describe, expect, it } from "vitest";
import { parseTaskTokenUsage } from "../taskUsage.js";

describe("taskUsage", () => {
  it("normalizes snake_case and camelCase usage fields", () => {
    const snake = parseTaskTokenUsage({
      input_tokens: 10,
      output_tokens: 5,
      cache_read_input_tokens: 2,
      cache_creation_input_tokens: 3,
      total_cost_usd: 0.25,
    });
    expect(snake).toEqual({ input: 15, output: 5, total: 20, costUsd: 0.25 });

    const camel = parseTaskTokenUsage({
      inputTokens: 7,
      outputTokens: 4,
      cacheReadInputTokens: 1,
      cacheCreationInputTokens: 2,
      totalCostUsd: 0.1,
    });
    expect(camel).toEqual({ input: 10, output: 4, total: 14, costUsd: 0.1 });
  });

  it("handles invalid values safely", () => {
    const parsed = parseTaskTokenUsage({
      input_tokens: -1,
      output_tokens: Number.NaN,
      cache_read_input_tokens: "oops",
      total_cost_usd: -10,
    });
    expect(parsed).toEqual({ input: 0, output: 0, total: 0, costUsd: 0 });
  });
});

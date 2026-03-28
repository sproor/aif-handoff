import { describe, it, expect, vi } from "vitest";

// Mock the claude-agent-sdk query function
const mockQueryResults: Array<{
  type: string;
  subtype?: string;
  result?: string;
  usage?: Record<string, number>;
  total_cost_usd?: number;
}> = [];

vi.mock("@anthropic-ai/claude-agent-sdk", () => ({
  query: vi.fn(async function* () {
    for (const msg of mockQueryResults) {
      yield msg;
    }
  }),
}));

vi.mock("@aif/data", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@aif/data")>();
  return {
    ...actual,
    incrementTaskTokenUsage: vi.fn(),
  };
});

vi.mock("../hooks.js", () => ({
  getClaudePath: () => "/usr/local/bin/claude",
}));

import { evaluateReviewCommentsForAutoMode } from "../reviewGate.js";

describe("evaluateReviewCommentsForAutoMode", () => {
  const baseInput = {
    taskId: "test-task-1",
    projectRoot: "/tmp/test-project",
    reviewComments: "## Code Review\n\nLooks good, no issues found.",
  };

  it("returns success when agent responds with SUCCESS", async () => {
    mockQueryResults.length = 0;
    mockQueryResults.push({
      type: "result",
      subtype: "success",
      result: "SUCCESS",
      usage: { input_tokens: 100, output_tokens: 10 },
      total_cost_usd: 0.001,
    });

    const result = await evaluateReviewCommentsForAutoMode(baseInput);
    expect(result).toEqual({ status: "success" });
  });

  it("returns request_changes when agent responds with fixes", async () => {
    mockQueryResults.length = 0;
    mockQueryResults.push({
      type: "result",
      subtype: "success",
      result: "- Fix missing error handling in api.ts\n- Add input validation",
      usage: { input_tokens: 100, output_tokens: 20 },
      total_cost_usd: 0.002,
    });

    const result = await evaluateReviewCommentsForAutoMode(baseInput);
    expect(result.status).toBe("request_changes");
    if (result.status === "request_changes") {
      expect(result.fixes).toContain("Fix missing error handling");
      expect(result.fixes).toContain("Add input validation");
    }
  });

  it("handles null reviewComments", async () => {
    mockQueryResults.length = 0;
    mockQueryResults.push({
      type: "result",
      subtype: "success",
      result: "SUCCESS",
      usage: { input_tokens: 50, output_tokens: 5 },
      total_cost_usd: 0.0005,
    });

    const result = await evaluateReviewCommentsForAutoMode({
      ...baseInput,
      reviewComments: null,
    });
    expect(result).toEqual({ status: "success" });
  });

  it("throws on non-success subtype", async () => {
    mockQueryResults.length = 0;
    mockQueryResults.push({
      type: "result",
      subtype: "error",
      result: "",
      usage: { input_tokens: 50, output_tokens: 5 },
      total_cost_usd: 0.0005,
    });

    await expect(evaluateReviewCommentsForAutoMode(baseInput)).rejects.toThrow(
      "Review auto-check failed",
    );
  });

  it("throws on empty response", async () => {
    mockQueryResults.length = 0;
    mockQueryResults.push({
      type: "result",
      subtype: "success",
      result: "   ",
      usage: { input_tokens: 50, output_tokens: 5 },
      total_cost_usd: 0.0005,
    });

    await expect(evaluateReviewCommentsForAutoMode(baseInput)).rejects.toThrow(
      "Review auto-check returned empty response",
    );
  });

  it("treats free-form prose (no bullets) as success to avoid false rework", async () => {
    mockQueryResults.length = 0;
    mockQueryResults.push({
      type: "result",
      subtype: "success",
      result: "The code looks good overall but could use some minor improvements in naming.",
      usage: { input_tokens: 100, output_tokens: 20 },
      total_cost_usd: 0.002,
    });

    const result = await evaluateReviewCommentsForAutoMode(baseInput);
    expect(result).toEqual({ status: "success" });
  });

  it("treats mixed prose+bullets as success because format is invalid", async () => {
    mockQueryResults.length = 0;
    mockQueryResults.push({
      type: "result",
      subtype: "success",
      result:
        "Here are the issues:\n- Fix missing null check\nSome extra commentary\n- Add error handling",
      usage: { input_tokens: 100, output_tokens: 30 },
      total_cost_usd: 0.003,
    });

    const result = await evaluateReviewCommentsForAutoMode(baseInput);
    expect(result).toEqual({ status: "success" });
  });

  it("is case-insensitive for SUCCESS token", async () => {
    mockQueryResults.length = 0;
    mockQueryResults.push({
      type: "result",
      subtype: "success",
      result: "success",
      usage: { input_tokens: 50, output_tokens: 5 },
      total_cost_usd: 0.0005,
    });

    const result = await evaluateReviewCommentsForAutoMode(baseInput);
    expect(result).toEqual({ status: "success" });
  });
});

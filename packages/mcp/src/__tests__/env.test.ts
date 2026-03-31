import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock getEnv before importing
vi.mock("@aif/shared", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@aif/shared")>();
  return {
    ...actual,
    getEnv: () => ({
      API_BASE_URL: "http://test:3009",
      DATABASE_URL: ":memory:",
      PORT: 3009,
    }),
  };
});

const { loadMcpEnv } = await import("../env.js");

describe("loadMcpEnv", () => {
  beforeEach(() => {
    delete process.env.MCP_RATE_LIMIT_READ_RPM;
    delete process.env.MCP_RATE_LIMIT_WRITE_RPM;
    delete process.env.MCP_RATE_LIMIT_READ_BURST;
    delete process.env.MCP_RATE_LIMIT_WRITE_BURST;
  });

  it("returns default rate limit values", () => {
    const env = loadMcpEnv();
    expect(env.rateLimitReadRpm).toBe(120);
    expect(env.rateLimitWriteRpm).toBe(30);
    expect(env.rateLimitReadBurst).toBe(10);
    expect(env.rateLimitWriteBurst).toBe(5);
  });

  it("reads API URL from shared env", () => {
    const env = loadMcpEnv();
    expect(env.apiUrl).toBe("http://test:3009");
  });

  it("reads custom rate limits from env vars", () => {
    process.env.MCP_RATE_LIMIT_READ_RPM = "200";
    process.env.MCP_RATE_LIMIT_WRITE_RPM = "50";
    process.env.MCP_RATE_LIMIT_READ_BURST = "20";
    process.env.MCP_RATE_LIMIT_WRITE_BURST = "8";

    const env = loadMcpEnv();
    expect(env.rateLimitReadRpm).toBe(200);
    expect(env.rateLimitWriteRpm).toBe(50);
    expect(env.rateLimitReadBurst).toBe(20);
    expect(env.rateLimitWriteBurst).toBe(8);
  });
});

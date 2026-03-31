import { logger, getEnv } from "@aif/shared";

const log = logger("mcp:env");

export interface McpEnv {
  /** API server URL for WebSocket broadcast (from shared env) */
  apiUrl: string;
  /** Rate limit: requests per minute for read tools */
  rateLimitReadRpm: number;
  /** Rate limit: requests per minute for write tools */
  rateLimitWriteRpm: number;
  /** Rate limit: burst size for read tools */
  rateLimitReadBurst: number;
  /** Rate limit: burst size for write tools */
  rateLimitWriteBurst: number;
}

/**
 * Load MCP-specific environment config.
 * DB connection uses the shared getDb() from @aif/shared/server (same as api/agent).
 * API_BASE_URL comes from the shared env.
 */
export function loadMcpEnv(): McpEnv {
  const sharedEnv = getEnv();

  const env: McpEnv = {
    apiUrl: sharedEnv.API_BASE_URL,
    rateLimitReadRpm: parseInt(process.env.MCP_RATE_LIMIT_READ_RPM || "120", 10),
    rateLimitWriteRpm: parseInt(process.env.MCP_RATE_LIMIT_WRITE_RPM || "30", 10),
    rateLimitReadBurst: parseInt(process.env.MCP_RATE_LIMIT_READ_BURST || "10", 10),
    rateLimitWriteBurst: parseInt(process.env.MCP_RATE_LIMIT_WRITE_BURST || "5", 10),
  };

  log.info(
    {
      apiUrl: env.apiUrl,
      rateLimitReadRpm: env.rateLimitReadRpm,
      rateLimitWriteRpm: env.rateLimitWriteRpm,
    },
    "MCP environment loaded",
  );

  return env;
}

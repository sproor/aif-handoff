import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RateLimiter } from "../middleware/rateLimit.js";

export interface ToolContext {
  rateLimiter: RateLimiter;
}

/**
 * Tool registration helper. Each tool module exports a `register` function
 * that takes the MCP server and context to register its tool.
 */
export type ToolRegistrar = (server: McpServer, context: ToolContext) => void;

import { logger } from "@aif/shared";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadMcpEnv } from "./env.js";
import { RateLimiter } from "./middleware/rateLimit.js";
import type { ToolContext } from "./tools/index.js";
import { register as registerListTasks } from "./tools/listTasks.js";
import { register as registerGetTask } from "./tools/getTask.js";
import { register as registerSearchTasks } from "./tools/searchTasks.js";
import { register as registerListProjects } from "./tools/listProjects.js";
import { register as registerCreateTask } from "./tools/createTask.js";
import { register as registerUpdateTask } from "./tools/updateTask.js";
import { register as registerSyncStatus } from "./tools/syncStatus.js";
import { register as registerPushPlan } from "./tools/pushPlan.js";
import { register as registerAnnotatePlan } from "./tools/annotatePlan.js";

const log = logger("mcp");

async function main() {
  const env = loadMcpEnv();

  const server = new McpServer(
    {
      name: "handoff-mcp",
      version: "0.1.0",
    },
    {
      capabilities: {
        tools: {},
      },
    },
  );

  // Initialize rate limiter
  const rateLimiter = new RateLimiter(
    { rpm: env.rateLimitReadRpm, burst: env.rateLimitReadBurst },
    { rpm: env.rateLimitWriteRpm, burst: env.rateLimitWriteBurst },
  );

  const context: ToolContext = { rateLimiter };

  log.info(
    {
      transport: "stdio",
      readRpm: env.rateLimitReadRpm,
      writeRpm: env.rateLimitWriteRpm,
    },
    "MCP server starting",
  );

  // Register read-only tools
  registerListTasks(server, context);
  registerGetTask(server, context);
  registerSearchTasks(server, context);
  registerListProjects(server, context);

  // Register write tools
  registerCreateTask(server, context);
  registerUpdateTask(server, context);
  registerSyncStatus(server, context);
  registerPushPlan(server, context);
  registerAnnotatePlan(server, context);

  const transport = new StdioServerTransport();
  await server.connect(transport);

  log.info("MCP server connected via stdio transport");
}

main().catch((error) => {
  log.error({ error: error instanceof Error ? error.message : String(error) }, "MCP server failed to start");
  process.exit(1);
});

export { loadMcpEnv } from "./env.js";
export { RateLimiter } from "./middleware/rateLimit.js";
export { toMcpError, rateLimitError, validationError } from "./middleware/errorHandler.js";
export type { ToolContext, ToolRegistrar } from "./tools/index.js";

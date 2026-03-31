import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { logger } from "@aif/shared";
import { findTaskById, toTaskResponse } from "@aif/data";
import type { ToolContext } from "./index.js";
import { rateLimitError, toMcpError } from "../middleware/errorHandler.js";

const log = logger("mcp:tool:get-task");

export function register(server: McpServer, context: ToolContext): void {
  server.tool(
    "handoff_get_task",
    "Get a single task by ID with full detail",
    {
      taskId: z.string().uuid().describe("Task ID to retrieve"),
    },
    async (args) => {
      try {
        if (!context.rateLimiter.check("handoff_get_task", "read")) {
          throw rateLimitError("handoff_get_task");
        }

        log.debug({ taskId: args.taskId }, "handoff_get_task called");

        const row = findTaskById(args.taskId);

        if (!row) {
          log.warn({ taskId: args.taskId }, "Task not found");
          return {
            content: [{ type: "text" as const, text: JSON.stringify({ error: "Task not found", taskId: args.taskId }) }],
            isError: true,
          };
        }

        const result = toTaskResponse(row);

        log.info({ taskId: args.taskId }, "handoff_get_task completed");

        return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
      } catch (error) {
        throw toMcpError(error);
      }
    },
  );
}

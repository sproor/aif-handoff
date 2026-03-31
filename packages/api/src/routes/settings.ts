import { Hono } from "hono";
import { readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { logger, findMonorepoRoot, getEnv } from "@aif/shared";

const log = logger("api:settings");

const CLAUDE_CONFIG_PATH = join(homedir(), ".claude.json");
const MCP_SERVER_NAME = "handoff";

/** Handoff monorepo root — where packages/mcp lives */
const MONOREPO_ROOT = findMonorepoRoot(import.meta.dirname);

interface ClaudeConfig {
  mcpServers?: Record<string, unknown>;
  [key: string]: unknown;
}

async function readClaudeConfig(): Promise<ClaudeConfig> {
  try {
    const raw = await readFile(CLAUDE_CONFIG_PATH, "utf-8");
    return JSON.parse(raw) as ClaudeConfig;
  } catch {
    return {};
  }
}

async function writeClaudeConfig(config: ClaudeConfig): Promise<void> {
  await writeFile(CLAUDE_CONFIG_PATH, JSON.stringify(config, null, 2) + "\n", "utf-8");
}

function buildMcpServerEntry() {
  return {
    command: "npx",
    args: ["tsx", join(MONOREPO_ROOT, "packages/mcp/src/index.ts")],
    env: {
      DATABASE_URL: getEnv().DATABASE_URL,
    },
  };
}

export const settingsRoutes = new Hono();

/** Check if handoff MCP server is configured globally */
settingsRoutes.get("/mcp", async (c) => {
  const config = await readClaudeConfig();
  const servers = config.mcpServers ?? {};
  const installed = MCP_SERVER_NAME in servers;

  log.info({ installed }, "MCP status checked");

  return c.json({
    installed,
    serverName: MCP_SERVER_NAME,
    config: installed ? servers[MCP_SERVER_NAME] : null,
  });
});

/** Install handoff MCP server to global Claude config */
settingsRoutes.post("/mcp/install", async (c) => {
  try {
    const config = await readClaudeConfig();
    if (!config.mcpServers) {
      config.mcpServers = {};
    }

    config.mcpServers[MCP_SERVER_NAME] = buildMcpServerEntry();
    await writeClaudeConfig(config);

    log.info({ monorepoRoot: MONOREPO_ROOT }, "MCP server installed to global Claude config");

    return c.json({ success: true, serverName: MCP_SERVER_NAME });
  } catch (error) {
    log.error({ error: error instanceof Error ? error.message : String(error) }, "Failed to install MCP");
    return c.json({ error: "Failed to install MCP server" }, 500);
  }
});

/** Remove handoff MCP server from global Claude config */
settingsRoutes.delete("/mcp", async (c) => {
  try {
    const config = await readClaudeConfig();
    if (config.mcpServers && MCP_SERVER_NAME in config.mcpServers) {
      delete config.mcpServers[MCP_SERVER_NAME];
      await writeClaudeConfig(config);
      log.info("MCP server removed from global Claude config");
    }
    return c.json({ success: true });
  } catch (error) {
    log.error({ error: error instanceof Error ? error.message : String(error) }, "Failed to remove MCP");
    return c.json({ error: "Failed to remove MCP server" }, 500);
  }
});

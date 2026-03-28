import cron from "node-cron";
import { getDb, getEnv, logger } from "@aif/shared";
import { pollAndProcess } from "./coordinator.js";
import { flushAllActivityQueues } from "./hooks.js";

const log = logger("agent");

// Validate env (ANTHROPIC_API_KEY is optional — Agent SDK uses ~/.claude/ auth)
const env = getEnv();

// Ensure DB is ready
getDb();

const intervalMs = env.POLL_INTERVAL_MS;
const intervalSeconds = Math.max(Math.floor(intervalMs / 1000), 10);

// Convert to cron expression (every N seconds)
const cronExpr = `*/${intervalSeconds} * * * * *`;

log.info({ intervalMs, intervalSeconds, cronExpr }, "Agent coordinator starting");

let isProcessing = false;

cron.schedule(cronExpr, async () => {
  if (isProcessing) {
    log.debug("Previous poll cycle still running, skipping");
    return;
  }

  isProcessing = true;
  try {
    await pollAndProcess();
  } catch (err) {
    log.error({ err }, "Unexpected error in poll cycle");
  } finally {
    isProcessing = false;
  }
});

log.info("Agent coordinator is running. Press Ctrl+C to stop.");

// ---------------------------------------------------------------------------
// Graceful shutdown: flush buffered activity logs before exit
// ---------------------------------------------------------------------------
function onShutdown(signal: string): void {
  log.info({ signal }, "Shutdown signal received — flushing activity queues");
  try {
    flushAllActivityQueues();
    log.info("Shutdown flush complete");
  } catch (err) {
    log.error({ err }, "Error during shutdown flush");
  }
  process.exit(0);
}

process.on("SIGINT", () => onShutdown("SIGINT"));
process.on("SIGTERM", () => onShutdown("SIGTERM"));

// Best-effort flush on normal exit (e.g. uncaught exception after handler)
process.on("beforeExit", () => {
  log.debug("beforeExit — flushing remaining activity queues");
  flushAllActivityQueues();
});

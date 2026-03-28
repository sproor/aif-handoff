import cron from "node-cron";
import { getDb, getEnv, logger } from "@aif/shared";
import { pollAndProcess } from "./coordinator.js";
import { flushAllActivityQueues } from "./hooks.js";
import { connectWakeChannel, closeWakeChannel } from "./notifier.js";

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

// ---------------------------------------------------------------------------
// Event-driven wake: subscribe to API WS for immediate coordinator triggers
// ---------------------------------------------------------------------------
async function triggerWake(reason: string): Promise<void> {
  if (isProcessing) {
    log.debug({ reason }, "Wake signal received but poll cycle already running, skipping");
    return;
  }

  log.info({ reason }, "Wake-triggered poll cycle starting");
  isProcessing = true;
  try {
    await pollAndProcess();
  } catch (err) {
    log.error({ err, reason }, "Unexpected error in wake-triggered poll cycle");
  } finally {
    isProcessing = false;
  }
}

connectWakeChannel((reason) => {
  void triggerWake(reason);
});

log.info("Agent coordinator is running. Press Ctrl+C to stop.");

// ---------------------------------------------------------------------------
// Graceful shutdown: flush buffered activity logs before exit
// ---------------------------------------------------------------------------
function onShutdown(signal: string): void {
  log.info(
    { signal },
    "Shutdown signal received — closing wake channel and flushing activity queues",
  );
  try {
    closeWakeChannel();
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

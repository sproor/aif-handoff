import { logger, getEnv } from "@aif/shared";

const log = logger("agent-notifier");

type BroadcastType = "task:updated" | "task:moved";

export async function notifyTaskBroadcast(
  taskId: string,
  type: BroadcastType = "task:updated",
): Promise<void> {
  const baseUrl = process.env.API_BASE_URL || `http://localhost:${process.env.PORT || 3001}`;
  const url = `${baseUrl}/tasks/${taskId}/broadcast`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type }),
    });

    if (!res.ok) {
      log.debug(
        { taskId, type, status: res.status },
        "Task broadcast request returned non-OK status",
      );
    }
  } catch (err) {
    // Broadcast is best-effort. Agent processing must not fail because API is unavailable.
    log.debug({ taskId, type, err }, "Task broadcast request failed");
  }
}

// ---------------------------------------------------------------------------
// Event-driven wake channel — subscribes to API WebSocket for coordinator wake
// ---------------------------------------------------------------------------

/** Events that should trigger a coordinator wake. */
const WAKE_EVENTS = new Set(["task:created", "task:moved", "agent:wake"]);

type WakeCallback = (reason: string) => void;

let _ws: WebSocket | null = null;
let _reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let _wakeCallback: WakeCallback | null = null;
let _lastWakeTime = 0;

const DEBOUNCE_MS = 2000;
const RECONNECT_DELAY_MS = 5000;

function getWsUrl(): string {
  const env = getEnv();
  const httpBase = env.API_BASE_URL;
  return httpBase.replace(/^http/, "ws") + "/ws";
}

function handleMessage(data: string): void {
  try {
    const parsed = JSON.parse(data);
    const eventType = parsed?.type as string | undefined;

    if (!eventType || !WAKE_EVENTS.has(eventType)) return;

    const now = Date.now();
    if (now - _lastWakeTime < DEBOUNCE_MS) {
      log.debug({ eventType, debounceMs: DEBOUNCE_MS }, "Wake debounced");
      return;
    }

    _lastWakeTime = now;
    log.info({ reason: eventType }, "Wake signal received");
    _wakeCallback?.(eventType);
  } catch {
    log.debug("Failed to parse WS message for wake channel");
  }
}

function scheduleReconnect(): void {
  if (_reconnectTimer) return;
  _reconnectTimer = setTimeout(() => {
    _reconnectTimer = null;
    connectWakeChannel(_wakeCallback!);
  }, RECONNECT_DELAY_MS);
  if (typeof _reconnectTimer === "object" && "unref" in _reconnectTimer) {
    _reconnectTimer.unref();
  }
}

/**
 * Connect to the API WebSocket to receive wake signals.
 * Returns true if the connection was initiated (not necessarily open yet).
 */
export function connectWakeChannel(onWake: WakeCallback): boolean {
  _wakeCallback = onWake;
  const wsUrl = getWsUrl();

  try {
    _ws = new WebSocket(wsUrl);

    _ws.addEventListener("open", () => {
      log.info({ wsUrl }, "Wake channel connected");
    });

    _ws.addEventListener("message", (event) => {
      handleMessage(typeof event.data === "string" ? event.data : String(event.data));
    });

    _ws.addEventListener("close", () => {
      log.warn("Wake channel disconnected — scheduling reconnect");
      _ws = null;
      scheduleReconnect();
    });

    _ws.addEventListener("error", (err) => {
      log.error({ err }, "Wake channel error");
      // close event will fire after error, triggering reconnect
    });

    return true;
  } catch (err) {
    log.error({ err, wsUrl }, "Failed to initiate wake channel connection");
    scheduleReconnect();
    return false;
  }
}

/** Close the wake channel cleanly. */
export function closeWakeChannel(): void {
  if (_reconnectTimer) {
    clearTimeout(_reconnectTimer);
    _reconnectTimer = null;
  }
  if (_ws) {
    _ws.close();
    _ws = null;
  }
  _wakeCallback = null;
  log.debug("Wake channel closed");
}

/** Returns true if the wake WS is currently connected (OPEN). */
export function isWakeChannelConnected(): boolean {
  return _ws?.readyState === WebSocket.OPEN;
}

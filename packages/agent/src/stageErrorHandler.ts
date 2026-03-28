/**
 * Stage error handler — classifies pipeline errors and applies
 * the appropriate recovery strategy (fast retry, backoff, or revert).
 * Extracted from coordinator.ts for single responsibility.
 */

import { logger, type TaskStatus } from "@aif/shared";
import { logActivity } from "./hooks.js";
import { isExternalFailure, isFastRetryableFailure, truncateReason } from "./errorClassifier.js";
import { getRandomBackoffMinutes } from "./taskWatchdog.js";

const log = logger("stage-error-handler");

export type ErrorRecovery =
  | { kind: "fast_retry" }
  | { kind: "blocked_external"; retryAfter: string; retryCount: number }
  | { kind: "revert" };

interface StageErrorInput {
  taskId: string;
  stageLabel: string;
  sourceStatus: TaskStatus;
  retryCount: number;
  err: unknown;
}

/**
 * Classify a stage error and return the recovery strategy + status fields.
 * The caller is responsible for applying the status update.
 */
export function classifyStageError(input: StageErrorInput): ErrorRecovery {
  const { taskId, stageLabel, sourceStatus, err } = input;

  if (isFastRetryableFailure(err)) {
    const reason = err instanceof Error ? err.message : String(err);

    log.warn(
      { taskId, stage: stageLabel, reason },
      "Subagent hit transient stream interruption, scheduling fast retry",
    );

    return { kind: "fast_retry" };
  }

  if (isExternalFailure(err)) {
    const backoffMinutes = getRandomBackoffMinutes();
    const retryAfter = new Date(Date.now() + backoffMinutes * 60_000).toISOString();
    const reason = err instanceof Error ? err.message : String(err);

    logActivity(
      taskId,
      "Agent",
      `coordinator moved to blocked_external from ${sourceStatus} at ${stageLabel}; retryAfter=${retryAfter}; reason=${truncateReason(reason)}`,
    );

    log.error(
      { taskId, stage: stageLabel, err, retryAfter, backoffMinutes },
      "Subagent failed with external error, task blocked with backoff",
    );

    return {
      kind: "blocked_external",
      retryAfter,
      retryCount: (input.retryCount ?? 0) + 1,
    };
  }

  log.error({ taskId, stage: stageLabel, err }, "Subagent failed, reverting status");

  return { kind: "revert" };
}

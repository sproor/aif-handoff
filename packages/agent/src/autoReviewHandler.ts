/**
 * Auto review gate handler — evaluates review comments in autoMode
 * and decides whether to accept or request rework.
 * Extracted from coordinator.ts for single responsibility.
 */

import { createTaskComment, findTaskById } from "@aif/data";
import { logger } from "@aif/shared";
import { logActivity } from "./hooks.js";
import { evaluateReviewCommentsForAutoMode } from "./reviewGate.js";

const log = logger("auto-review-handler");

export type ReviewGateOutcome = "accepted" | "rework_requested";

interface AutoReviewInput {
  taskId: string;
  projectRoot: string;
}

/**
 * Run the auto review gate for a task in autoMode.
 * Returns "accepted" if the review passed, "rework_requested" if fixes are needed.
 * Returns null if the task is not in autoMode (caller should proceed normally).
 */
export async function handleAutoReviewGate(
  input: AutoReviewInput,
): Promise<ReviewGateOutcome | null> {
  const refreshedTask = findTaskById(input.taskId);

  if (!refreshedTask?.autoMode) {
    return null;
  }

  logActivity(
    input.taskId,
    "Agent",
    "coordinator auto review gate started: validating review comments before done transition",
  );

  const reviewGate = await evaluateReviewCommentsForAutoMode({
    taskId: input.taskId,
    projectRoot: input.projectRoot,
    reviewComments: refreshedTask.reviewComments,
  });

  if (reviewGate.status === "request_changes") {
    const requestedFixesCount = reviewGate.fixes
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.startsWith("- ")).length;

    const reviewSummary = [
      "## Auto Review Gate Summary",
      "- Outcome: request_changes",
      `- Required fixes: ${requestedFixesCount}`,
      "",
      "## Required Fixes",
      reviewGate.fixes,
    ].join("\n");

    createTaskComment({
      taskId: input.taskId,
      author: "agent",
      message: reviewSummary,
      attachments: [],
    });

    logActivity(
      input.taskId,
      "Agent",
      `coordinator auto review gate requested changes (${requestedFixesCount} items), returning to implementing`,
    );

    log.info(
      { taskId: input.taskId, fixesCount: requestedFixesCount },
      "Auto review gate requested changes, returning to implementing",
    );

    return "rework_requested";
  }

  createTaskComment({
    taskId: input.taskId,
    author: "agent",
    message: [
      "## Auto Review Gate Summary",
      "- Outcome: success",
      "- Required fixes: 0",
      "",
      "Review comments passed auto-gate; transitioning task to Done.",
    ].join("\n"),
    attachments: [],
  });

  logActivity(
    input.taskId,
    "Agent",
    "coordinator auto review gate passed: review accepted, proceeding to done",
  );

  return "accepted";
}

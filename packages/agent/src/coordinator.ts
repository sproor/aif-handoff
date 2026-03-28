import { and, asc, eq, inArray, or } from "drizzle-orm";
import {
  getDb,
  tasks,
  projects,
  taskComments,
  logger,
  initProjectDirectory,
  getEnv,
  CLEAN_STATE_RESET,
  type TaskStatus,
} from "@aif/shared";
import { runPlanner } from "./subagents/planner.js";
import { runPlanChecker } from "./subagents/planChecker.js";
import { runImplementer } from "./subagents/implementer.js";
import { runReviewer } from "./subagents/reviewer.js";
import { logActivity, flushActivityQueue } from "./hooks.js";
import { notifyTaskBroadcast } from "./notifier.js";
import { evaluateReviewCommentsForAutoMode } from "./reviewGate.js";
import { isExternalFailure, isFastRetryableFailure, truncateReason } from "./errorClassifier.js";
import {
  releaseDueBlockedTasks,
  recoverStaleInProgressTasks,
  getRandomBackoffMinutes,
} from "./taskWatchdog.js";

const log = logger("coordinator");
const env = getEnv();
const STAGE_RUN_TIMEOUT_MS = Math.max(env.AGENT_STAGE_RUN_TIMEOUT_MS, 60_000);

const runtimeCounters = {
  fastRetryStreamInterruptions: 0,
};

interface StatusTransition {
  from: TaskStatus[];
  inProgress: TaskStatus;
  onSuccess: TaskStatus;
  runner: (taskId: string, projectRoot: string) => Promise<void>;
  label: string;
}

const PIPELINE: StatusTransition[] = [
  {
    from: ["planning"],
    inProgress: "planning",
    onSuccess: "plan_ready",
    runner: runPlanner,
    label: "planner",
  },
  {
    from: ["plan_ready"],
    inProgress: "plan_ready",
    onSuccess: "plan_ready",
    runner: runPlanChecker,
    label: "plan-checker",
  },
  {
    from: ["plan_ready", "implementing"],
    inProgress: "implementing",
    onSuccess: "review",
    runner: runImplementer,
    label: "implementer",
  },
  {
    from: ["review"],
    inProgress: "review", // stays in review during processing
    onSuccess: "done",
    runner: runReviewer,
    label: "reviewer",
  },
];

export function getCoordinatorRuntimeCounters(): Readonly<typeof runtimeCounters> {
  return { ...runtimeCounters };
}

export function resetCoordinatorRuntimeCountersForTests(): void {
  runtimeCounters.fastRetryStreamInterruptions = 0;
}

async function runStageWithTimeout(
  runner: (taskId: string, projectRoot: string) => Promise<void>,
  taskId: string,
  projectRoot: string,
  stageLabel: string,
): Promise<void> {
  let timeoutId: NodeJS.Timeout | null = null;
  try {
    await Promise.race([
      runner(taskId, projectRoot),
      new Promise<void>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error(`Stage ${stageLabel} timed out after ${STAGE_RUN_TIMEOUT_MS}ms`));
        }, STAGE_RUN_TIMEOUT_MS);
        timeoutId.unref?.();
      }),
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

/** Update task status with optional field overrides and broadcast. */
function updateTaskStatus(
  db: ReturnType<typeof getDb>,
  taskId: string,
  status: TaskStatus,
  extra: Record<string, unknown> = {},
): void {
  const nowIso = new Date().toISOString();
  db.update(tasks)
    .set({
      status,
      lastHeartbeatAt: nowIso,
      updatedAt: nowIso,
      ...extra,
    } as Record<string, unknown>)
    .where(eq(tasks.id, taskId))
    .run();
  void notifyTaskBroadcast(taskId, "task:moved");
}

export async function pollAndProcess(): Promise<void> {
  const db = getDb();

  log.debug("Starting poll cycle");
  releaseDueBlockedTasks(db);
  recoverStaleInProgressTasks(db);

  for (const stage of PIPELINE) {
    // Find one task at the source status
    const stageFilter =
      stage.label === "implementer"
        ? or(
            eq(tasks.status, "implementing"),
            and(eq(tasks.status, "plan_ready"), eq(tasks.autoMode, true)),
          )
        : stage.label === "plan-checker"
          ? and(eq(tasks.status, "plan_ready"), eq(tasks.autoMode, true))
          : inArray(tasks.status, stage.from);

    // Deterministic pickup: lowest position first (uses idx_tasks_status index)
    const task = db
      .select()
      .from(tasks)
      .where(stageFilter)
      .orderBy(asc(tasks.position), asc(tasks.createdAt))
      .limit(1)
      .get();

    if (!task) {
      log.debug({ stage: stage.label }, "No tasks to process");
      continue;
    }

    log.debug(
      { stage: stage.label, taskId: task.id, candidateStatus: task.status },
      "Task candidate selected",
    );

    // Get the project's rootPath
    const project = db.select().from(projects).where(eq(projects.id, task.projectId)).get();

    if (!project) {
      log.error(
        { taskId: task.id, projectId: task.projectId },
        "Project not found for task, skipping",
      );
      continue;
    }

    // Ensure project directory is initialized (.claude/agents, .claude/skills, git)
    initProjectDirectory(project.rootPath);

    log.info(
      { taskId: task.id, title: task.title, stage: stage.label, projectRoot: project.rootPath },
      "Picked up task for processing",
    );
    const sourceStatus = task.status;

    // Set intermediate status
    updateTaskStatus(db, task.id, stage.inProgress);

    log.debug(
      { taskId: task.id, from: sourceStatus, to: stage.inProgress },
      "Status transition (start)",
    );

    try {
      await runStageWithTimeout(stage.runner, task.id, project.rootPath, stage.label);

      // Flush buffered activity logs at stage boundary (batch mode)
      flushActivityQueue(task.id);

      const refreshedTask = db.select().from(tasks).where(eq(tasks.id, task.id)).get();

      if (stage.label === "reviewer" && refreshedTask?.autoMode) {
        logActivity(
          task.id,
          "Agent",
          "coordinator auto review gate started: validating review comments before done transition",
        );
        const reviewGate = await evaluateReviewCommentsForAutoMode({
          taskId: task.id,
          projectRoot: project.rootPath,
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
          db.insert(taskComments)
            .values({
              taskId: task.id,
              author: "agent",
              message: reviewSummary,
              attachments: "[]",
            })
            .run();

          updateTaskStatus(db, task.id, "implementing", {
            ...CLEAN_STATE_RESET,
            reworkRequested: true,
          });
          logActivity(
            task.id,
            "Agent",
            `coordinator auto review gate requested changes (${requestedFixesCount} items), returning to implementing`,
          );

          log.info(
            { taskId: task.id, from: stage.inProgress, to: "implementing" },
            "Auto review gate requested changes, restarting implementing stage",
          );
          continue;
        }

        db.insert(taskComments)
          .values({
            taskId: task.id,
            author: "agent",
            message: [
              "## Auto Review Gate Summary",
              "- Outcome: success",
              "- Required fixes: 0",
              "",
              "Review comments passed auto-gate; transitioning task to Done.",
            ].join("\n"),
            attachments: "[]",
          })
          .run();

        logActivity(
          task.id,
          "Agent",
          "coordinator auto review gate passed: review accepted, proceeding to done",
        );
      }

      // Success — move to next status
      updateTaskStatus(db, task.id, stage.onSuccess, CLEAN_STATE_RESET);

      log.info(
        { taskId: task.id, from: stage.inProgress, to: stage.onSuccess },
        "Status transition (success)",
      );
    } catch (err) {
      if (isFastRetryableFailure(err)) {
        const reason = err instanceof Error ? err.message : String(err);
        runtimeCounters.fastRetryStreamInterruptions += 1;

        updateTaskStatus(db, task.id, sourceStatus, {
          blockedReason: null,
          blockedFromStatus: null,
          retryAfter: null,
        });

        log.warn(
          {
            taskId: task.id,
            stage: stage.label,
            reason,
            metric: "coordinator.fast_retry_stream_interruptions",
            fastRetryStreamInterruptions: runtimeCounters.fastRetryStreamInterruptions,
          },
          "Subagent hit transient stream interruption, scheduling fast retry",
        );
      } else if (isExternalFailure(err)) {
        const backoffMinutes = getRandomBackoffMinutes();
        const retryAfter = new Date(Date.now() + backoffMinutes * 60_000).toISOString();
        const reason = err instanceof Error ? err.message : String(err);

        updateTaskStatus(db, task.id, "blocked_external", {
          blockedReason: reason,
          blockedFromStatus: sourceStatus,
          retryAfter,
          retryCount: (task.retryCount ?? 0) + 1,
        });
        logActivity(
          task.id,
          "Agent",
          `coordinator moved to blocked_external from ${sourceStatus} at ${stage.label}; retryAfter=${retryAfter}; reason=${truncateReason(reason)}`,
        );

        log.error(
          { taskId: task.id, stage: stage.label, err, retryAfter, backoffMinutes },
          "Subagent failed with external error, task blocked with backoff",
        );
      } else {
        // Failure — revert to previous status
        updateTaskStatus(db, task.id, sourceStatus);

        log.error(
          { taskId: task.id, stage: stage.label, err },
          "Subagent failed, reverting status",
        );
      }

      // Flush buffered activity logs on error path too
      flushActivityQueue(task.id);

      // Stop current poll cycle after a failed stage to avoid immediately
      // re-picking the same task in a downstream stage in this same cycle.
      break;
    }
  }

  log.debug("Poll cycle complete");
}

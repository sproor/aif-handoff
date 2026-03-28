import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { existsSync, readFileSync } from "node:fs";
import { projects, logger, getCanonicalPlanPath, persistTaskPlan } from "@aif/shared";
import { eq } from "drizzle-orm";
import {
  createTaskSchema,
  updateTaskSchema,
  taskEventSchema,
  createTaskCommentSchema,
  reorderTaskSchema,
  broadcastTaskSchema,
} from "../schemas.js";
import { broadcast } from "../ws.js";
import { handleTaskEvent } from "../services/taskEvents.js";
import {
  findTaskById,
  listTasks,
  createTask,
  updateTask,
  deleteTask,
  listComments,
  createComment,
  toTaskResponse,
  toCommentResponse,
} from "../repositories/tasks.js";

const log = logger("tasks-route");

export const tasksRouter = new Hono();

// POST /tasks/:id/broadcast — emit WS update for a task (used by agent process)
tasksRouter.post("/:id/broadcast", zValidator("json", broadcastTaskSchema), async (c) => {
  const { id } = c.req.param();
  const { type } = c.req.valid("json");
  const { task } = findTaskById(id);
  if (!task) return c.json({ error: "Task not found" }, 404);

  broadcast({ type, payload: toTaskResponse(task) });
  log.debug({ taskId: id, type }, "Task WS broadcast triggered");
  return c.json({ success: true });
});

// GET /tasks?projectId=xxx — list by project, sorted by status order + position
tasksRouter.get("/", (c) => {
  const projectId = c.req.query("projectId") || undefined;
  if (projectId && !/^[0-9a-f-]{36}$/i.test(projectId)) {
    return c.json({ error: "Invalid projectId format" }, 400);
  }

  const allTasks = listTasks(projectId);
  log.debug({ count: allTasks.length, projectId }, "Listed tasks");
  return c.json(allTasks.map(toTaskResponse));
});

// POST /tasks — create
tasksRouter.post("/", zValidator("json", createTaskSchema), async (c) => {
  const body = c.req.valid("json");

  const created = createTask({
    projectId: body.projectId,
    title: body.title,
    description: body.description,
    attachments: body.attachments,
    priority: body.priority,
    autoMode: body.autoMode,
    isFix: body.isFix,
  });
  if (!created) return c.json({ error: "Failed to create task" }, 500);
  log.debug({ taskId: created.id, title: body.title }, "Task created");

  broadcast({ type: "task:created", payload: toTaskResponse(created) });
  // Wake coordinator when a new task is created (may need immediate processing)
  broadcast({ type: "agent:wake", payload: { id: created.id } });
  return c.json(toTaskResponse(created), 201);
});

// GET /tasks/:id — full detail
tasksRouter.get("/:id", (c) => {
  const { id } = c.req.param();
  const { task } = findTaskById(id);
  if (!task) {
    log.debug({ taskId: id }, "Task not found");
    return c.json({ error: "Task not found" }, 404);
  }

  log.debug({ taskId: id }, "Task fetched");
  return c.json(toTaskResponse(task));
});

// GET /tasks/:id/plan-file-status — check if canonical physical plan file already exists
tasksRouter.get("/:id/plan-file-status", (c) => {
  const { id } = c.req.param();
  const { db, task: existing } = findTaskById(id);
  if (!existing) {
    return c.json({ error: "Task not found" }, 404);
  }

  const project = db.select().from(projects).where(eq(projects.id, existing.projectId)).get();
  if (!project) {
    return c.json({ error: "Project not found for task" }, 404);
  }

  const canonicalPlanPath = getCanonicalPlanPath({
    projectRoot: project.rootPath,
    isFix: existing.isFix,
  });

  return c.json({
    exists: existsSync(canonicalPlanPath),
    path: canonicalPlanPath,
  });
});

// GET /tasks/:id/comments — list comments
tasksRouter.get("/:id/comments", (c) => {
  const { id } = c.req.param();
  const { task } = findTaskById(id);
  if (!task) {
    return c.json({ error: "Task not found" }, 404);
  }

  const comments = listComments(id);
  return c.json(comments.map(toCommentResponse));
});

// POST /tasks/:id/comments — create a human comment
tasksRouter.post("/:id/comments", zValidator("json", createTaskCommentSchema), (c) => {
  const { id } = c.req.param();
  const body = c.req.valid("json");
  const { task } = findTaskById(id);
  if (!task) {
    return c.json({ error: "Task not found" }, 404);
  }

  const created = createComment({
    taskId: id,
    message: body.message,
    attachments: body.attachments,
  });
  if (!created) return c.json({ error: "Failed to create comment" }, 500);
  return c.json(toCommentResponse(created), 201);
});

// PUT /tasks/:id — update fields
tasksRouter.put("/:id", zValidator("json", updateTaskSchema), async (c) => {
  const { id } = c.req.param();
  const body = c.req.valid("json");
  const { db, task: existing } = findTaskById(id);
  if (!existing) {
    return c.json({ error: "Task not found" }, 404);
  }

  const { attachments, ...restBody } = body;
  const updatePayload: Record<string, unknown> = { ...restBody };
  if (attachments) {
    updatePayload.attachments = JSON.stringify(attachments);
  }

  const hasPlanUpdate = Object.prototype.hasOwnProperty.call(restBody, "plan");
  if (hasPlanUpdate) {
    const project = db.select().from(projects).where(eq(projects.id, existing.projectId)).get();
    if (!project) {
      return c.json({ error: "Project not found for task" }, 404);
    }
    persistTaskPlan({
      db,
      taskId: id,
      projectRoot: project.rootPath,
      isFix: existing.isFix,
      planText: restBody.plan ?? null,
      updatedAt: new Date().toISOString(),
    });
    delete updatePayload.plan;
  }

  const updated = updateTask(id, updatePayload);
  if (!updated) return c.json({ error: "Task not found after update" }, 500);
  log.debug({ taskId: id, fields: Object.keys(body) }, "Task updated");

  broadcast({ type: "task:updated", payload: toTaskResponse(updated) });
  return c.json(toTaskResponse(updated));
});

// POST /tasks/:id/sync-plan — sync DB plan with physical plan file
tasksRouter.post("/:id/sync-plan", (c) => {
  const { id } = c.req.param();
  const { db, task: existing } = findTaskById(id);
  if (!existing) {
    return c.json({ error: "Task not found" }, 404);
  }

  const project = db.select().from(projects).where(eq(projects.id, existing.projectId)).get();
  if (!project) {
    return c.json({ error: "Project not found for task" }, 404);
  }

  const canonicalPlanPath = getCanonicalPlanPath({
    projectRoot: project.rootPath,
    isFix: existing.isFix,
  });
  if (!existsSync(canonicalPlanPath)) {
    return c.json({ error: "Plan file not found" }, 404);
  }

  const filePlan = readFileSync(canonicalPlanPath, "utf8");
  const normalizedPlan = filePlan.trim().length > 0 ? filePlan : null;

  persistTaskPlan({
    db,
    taskId: id,
    planText: normalizedPlan,
    projectRoot: project.rootPath,
    isFix: existing.isFix,
    updatedAt: new Date().toISOString(),
  });

  const updated = updateTask(id, {});
  if (!updated) return c.json({ error: "Task not found after sync" }, 500);
  log.debug({ taskId: id, canonicalPlanPath }, "Task plan synced from physical file");

  broadcast({ type: "task:updated", payload: toTaskResponse(updated) });
  return c.json(toTaskResponse(updated));
});

// DELETE /tasks/:id
tasksRouter.delete("/:id", (c) => {
  const { id } = c.req.param();
  const { task: existing } = findTaskById(id);
  if (!existing) {
    return c.json({ error: "Task not found" }, 404);
  }

  deleteTask(id);
  log.debug({ taskId: id }, "Task deleted");

  broadcast({ type: "task:deleted", payload: { id } });
  return c.json({ success: true });
});

// POST /tasks/:id/events — apply a human action through state machine
tasksRouter.post("/:id/events", zValidator("json", taskEventSchema), async (c) => {
  const { id } = c.req.param();
  const { event } = c.req.valid("json");
  const { db, task: existing } = findTaskById(id);
  if (!existing) {
    return c.json({ error: "Task not found" }, 404);
  }
  try {
    const handled = await handleTaskEvent({
      db,
      task: existing,
      event,
    });
    if (!handled.ok) {
      return c.json({ error: handled.error }, handled.status);
    }

    log.debug(
      { taskId: id, from: existing.status, to: handled.task.status, event },
      "Task state transition applied",
    );
    broadcast({
      type: handled.broadcastType,
      payload: toTaskResponse(handled.task),
    });
    // Wake coordinator when task transitions may require agent processing
    if (handled.broadcastType === "task:moved") {
      broadcast({ type: "agent:wake", payload: { id: handled.task.id } });
    }
    return c.json(toTaskResponse(handled.task));
  } catch (error) {
    log.error({ taskId: id, event, error }, "Task event handling failed");
    return c.json({ error: "Internal server error" }, 500);
  }
});

// PATCH /tasks/:id/position — reorder within column
tasksRouter.patch("/:id/position", zValidator("json", reorderTaskSchema), async (c) => {
  const { id } = c.req.param();
  const { position } = c.req.valid("json");
  const { task: existing } = findTaskById(id);
  if (!existing) {
    return c.json({ error: "Task not found" }, 404);
  }

  const updated = updateTask(id, { position });
  if (!updated) return c.json({ error: "Task not found after reorder" }, 500);
  log.debug({ taskId: id, position }, "Task reordered");

  broadcast({ type: "task:updated", payload: toTaskResponse(updated) });
  return c.json(toTaskResponse(updated));
});

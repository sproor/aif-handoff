import { describe, it, expect, beforeEach, vi } from "vitest";
import { createTestDb } from "@aif/shared/server";
import { projects } from "@aif/shared";

// Set up test DB before importing tools
const testDb = { current: createTestDb() };
vi.mock("@aif/shared/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@aif/shared/server")>();
  return {
    ...actual,
    getDb: () => testDb.current,
  };
});

// Mock env to avoid shared env validation
vi.mock("@aif/shared", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@aif/shared")>();
  return {
    ...actual,
    getEnv: () => ({
      API_BASE_URL: "http://localhost:3009",
      DATABASE_URL: ":memory:",
      PORT: 3009,
    }),
  };
});

const {
  createTask,
  findTaskById,
  listTasks,
  listProjects,
  searchTasks,
  toTaskResponse,
  touchLastSyncedAt,
  updateTaskStatus,
  setTaskFields,
  listTasksPaginated,
  searchTasksPaginated,
  toTaskSummary,
} = await import("@aif/data");

const { resolveConflict } = await import("../sync/conflictResolver.js");

function seedProject(id = "proj-1") {
  testDb.current
    .insert(projects)
    .values({ id, name: "Test", rootPath: "/tmp/test" })
    .run();
}

function seedTask(overrides: { projectId?: string; title?: string; description?: string } = {}) {
  return createTask({
    projectId: overrides.projectId ?? "proj-1",
    title: overrides.title ?? "Test Task",
    description: overrides.description ?? "Description",
  });
}

describe("MCP tools", () => {
  beforeEach(() => {
    testDb.current = createTestDb();
    seedProject();
  });

  // ── listTasks ─────────────────────────────────────────────

  describe("listTasks data layer", () => {
    it("lists all tasks", () => {
      seedTask({ title: "A" });
      seedTask({ title: "B" });
      const all = listTasks("proj-1");
      expect(all).toHaveLength(2);
    });

    it("filters by project", () => {
      testDb.current
        .insert(projects)
        .values({ id: "proj-2", name: "Other", rootPath: "/tmp/other" })
        .run();
      seedTask({ projectId: "proj-1", title: "P1 Task" });
      seedTask({ projectId: "proj-2", title: "P2 Task" });
      expect(listTasks("proj-1")).toHaveLength(1);
      expect(listTasks("proj-2")).toHaveLength(1);
    });
  });

  // ── listTasksPaginated ─────────────────────────────────────

  describe("listTasksPaginated", () => {
    it("returns paginated results with total count", () => {
      for (let i = 0; i < 5; i++) seedTask({ title: `Paged ${i}` });
      const result = listTasksPaginated({ limit: 2 });
      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(5);
      expect(result.limit).toBe(2);
    });

    it("excludes heavy fields from summary", () => {
      seedTask({ title: "Summary check", description: "big description" });
      const result = listTasksPaginated({});
      const item = result.items[0];
      expect(item).toHaveProperty("title");
      expect(item).not.toHaveProperty("plan");
      expect(item).not.toHaveProperty("description");
      expect(item).not.toHaveProperty("implementationLog");
    });

    it("toTaskSummary parses tags", () => {
      createTask({ projectId: "proj-1", title: "T", description: "", tags: ["x"] });
      const result = listTasksPaginated({});
      const summary = toTaskSummary(result.items[0]);
      expect(summary.tags).toContain("x");
    });
  });

  // ── searchTasksPaginated ──────────────────────────────────

  describe("searchTasksPaginated", () => {
    it("returns paginated search results", () => {
      for (let i = 0; i < 5; i++) seedTask({ title: `Findable ${i}` });
      const result = searchTasksPaginated({ query: "Findable", limit: 2 });
      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(5);
    });
  });

  // ── getTask ───────────────────────────────────────────────

  describe("getTask data layer", () => {
    it("finds task by ID", () => {
      const task = seedTask();
      const found = findTaskById(task!.id);
      expect(found).toBeDefined();
      expect(found!.title).toBe("Test Task");
    });

    it("returns undefined for missing task", () => {
      expect(findTaskById("00000000-0000-0000-0000-000000000000")).toBeUndefined();
    });
  });

  // ── searchTasks ───────────────────────────────────────────

  describe("searchTasks data layer", () => {
    it("searches by title", () => {
      seedTask({ title: "Authentication feature" });
      seedTask({ title: "Database migration" });
      const results = searchTasks("Auth");
      expect(results).toHaveLength(1);
      expect(results[0].title).toBe("Authentication feature");
    });

    it("returns empty for no matches", () => {
      seedTask({ title: "Something" });
      expect(searchTasks("nonexistent")).toHaveLength(0);
    });
  });

  // ── listProjects ──────────────────────────────────────────

  describe("listProjects data layer", () => {
    it("lists all projects", () => {
      const all = listProjects();
      expect(all).toHaveLength(1);
      expect(all[0].name).toBe("Test");
    });
  });

  // ── createTask ────────────────────────────────────────────

  describe("createTask data layer", () => {
    it("creates a task", () => {
      const task = seedTask({ title: "New Task" });
      expect(task).toBeDefined();
      expect(task!.title).toBe("New Task");
      expect(task!.status).toBe("backlog");
    });

    it("creates with optional fields", () => {
      const task = createTask({
        projectId: "proj-1",
        title: "Tagged",
        description: "Desc",
        priority: 2,
        tags: ["urgent"],
      });
      expect(task).toBeDefined();
      expect(task!.priority).toBe(2);
    });
  });

  // ── syncStatus conflict resolver ──────────────────────────

  describe("conflictResolver", () => {
    it("source wins when newer", () => {
      const result = resolveConflict({
        sourceTimestamp: "2026-01-02T00:00:00.000Z",
        targetTimestamp: "2026-01-01T00:00:00.000Z",
        field: "status",
      });
      expect(result.applied).toBe(true);
      expect(result.conflict).toBe(false);
      expect(result.winner).toBe("source");
    });

    it("target wins when newer", () => {
      const result = resolveConflict({
        sourceTimestamp: "2026-01-01T00:00:00.000Z",
        targetTimestamp: "2026-01-02T00:00:00.000Z",
        field: "status",
      });
      expect(result.applied).toBe(false);
      expect(result.conflict).toBe(true);
      expect(result.winner).toBe("target");
    });

    it("source wins on equal timestamps", () => {
      const result = resolveConflict({
        sourceTimestamp: "2026-01-01T00:00:00.000Z",
        targetTimestamp: "2026-01-01T00:00:00.000Z",
        field: "status",
      });
      expect(result.applied).toBe(true);
      expect(result.conflict).toBe(false);
    });
  });

  // ── syncStatus flow ───────────────────────────────────────

  describe("syncStatus flow", () => {
    it("applies status change when source is newer", () => {
      const task = seedTask();
      expect(task!.status).toBe("backlog");

      // Set updatedAt to old time
      setTaskFields(task!.id, { updatedAt: "2026-01-01T00:00:00.000Z" });

      const resolution = resolveConflict({
        sourceTimestamp: "2026-01-02T00:00:00.000Z",
        targetTimestamp: "2026-01-01T00:00:00.000Z",
        field: "status",
      });
      expect(resolution.applied).toBe(true);

      updateTaskStatus(task!.id, "planning");
      touchLastSyncedAt(task!.id);

      const updated = findTaskById(task!.id);
      expect(updated!.status).toBe("planning");
      expect(updated!.lastSyncedAt).toBeTruthy();
    });

    it("detects conflict when target is newer", () => {
      const task = seedTask();
      setTaskFields(task!.id, { updatedAt: "2026-01-02T00:00:00.000Z" });

      const resolution = resolveConflict({
        sourceTimestamp: "2026-01-01T00:00:00.000Z",
        targetTimestamp: "2026-01-02T00:00:00.000Z",
        field: "status",
      });
      expect(resolution.conflict).toBe(true);
      expect(resolution.applied).toBe(false);
    });
  });

  // ── pushPlan flow ─────────────────────────────────────────

  describe("pushPlan flow", () => {
    it("updates task plan field", () => {
      const task = seedTask();
      const planContent = "## Plan\n- Step 1\n- Step 2";

      setTaskFields(task!.id, { plan: planContent, updatedAt: new Date().toISOString() });
      const updated = findTaskById(task!.id);
      expect(updated!.plan).toBe(planContent);
    });

    it("preserves annotations in plan content", () => {
      const task = seedTask();
      const planContent = `## Overview\n<!-- handoff:task:${task!.id} -->\nContent here`;

      setTaskFields(task!.id, { plan: planContent, updatedAt: new Date().toISOString() });
      const updated = findTaskById(task!.id);
      expect(updated!.plan).toContain("handoff:task:");
    });
  });

  // ── toTaskResponse ────────────────────────────────────────

  describe("toTaskResponse", () => {
    it("converts TaskRow to Task with parsed fields", () => {
      const row = seedTask();
      const task = toTaskResponse(row!);
      expect(task.id).toBe(row!.id);
      expect(Array.isArray(task.tags)).toBe(true);
      expect(task.lastSyncedAt).toBeNull();
    });
  });

  // ── Integration: full create → search → update → sync flow ─

  describe("integration flow", () => {
    it("create → search → update → sync status", () => {
      // 1. Create
      const task = createTask({
        projectId: "proj-1",
        title: "Integration Test Task",
        description: "Test the full flow",
        priority: 1,
      });
      expect(task).toBeDefined();

      // 2. Search
      const searchResults = searchTasks("Integration");
      expect(searchResults).toHaveLength(1);
      expect(searchResults[0].id).toBe(task!.id);

      // 3. Update
      setTaskFields(task!.id, {
        plan: "## Plan\nDo things",
        updatedAt: "2026-01-01T00:00:00.000Z",
      });
      const withPlan = findTaskById(task!.id);
      expect(withPlan!.plan).toContain("Plan");

      // 4. Sync status (source newer)
      const resolution = resolveConflict({
        sourceTimestamp: "2026-01-02T00:00:00.000Z",
        targetTimestamp: withPlan!.updatedAt,
        field: "status",
      });
      expect(resolution.applied).toBe(true);

      updateTaskStatus(task!.id, "planning");
      touchLastSyncedAt(task!.id);

      const final = findTaskById(task!.id);
      expect(final!.status).toBe("planning");
      expect(final!.lastSyncedAt).toBeTruthy();
      expect(final!.plan).toContain("Plan");
    });
  });
});

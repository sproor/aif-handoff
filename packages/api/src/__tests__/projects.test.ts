import { beforeEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { createTestDb } from "@aif/shared/server";

const testDb = { current: createTestDb() };
const mockInitProjectDirectory = vi.fn();

vi.mock("@aif/shared/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@aif/shared/server")>();
  return {
    ...actual,
    getDb: () => testDb.current,
  };
});

vi.mock("@aif/shared", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@aif/shared")>();
  return {
    ...actual,
    initProjectDirectory: (projectRoot: string) => mockInitProjectDirectory(projectRoot),
  };
});

vi.mock("../ws.js", () => ({
  broadcast: vi.fn(),
  setupWebSocket: vi.fn(() => ({
    injectWebSocket: vi.fn(),
    upgradeWebSocket: vi.fn(),
  })),
  getInjectWebSocket: vi.fn(),
}));

const { projectsRouter } = await import("../routes/projects.js");

function createApp() {
  const app = new Hono();
  app.route("/projects", projectsRouter);
  return app;
}

describe("projects API", () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    testDb.current = createTestDb();
    mockInitProjectDirectory.mockReset();
    app = createApp();
  });

  it("returns projects list", async () => {
    const res = await app.request("/projects");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it("creates project even when directory initialization fails", async () => {
    mockInitProjectDirectory.mockImplementation(() => {
      throw new Error("permission denied");
    });

    const res = await app.request("/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Demo",
        rootPath: "/tmp/demo-project",
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.name).toBe("Demo");
    expect(body.rootPath).toBe("/tmp/demo-project");
  });
});

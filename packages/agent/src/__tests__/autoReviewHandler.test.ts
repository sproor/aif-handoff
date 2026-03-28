import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFindTaskById = vi.fn();
const mockCreateTaskComment = vi.fn();

vi.mock("@aif/data", () => ({
  findTaskById: (...args: unknown[]) => mockFindTaskById(...args),
  createTaskComment: (...args: unknown[]) => mockCreateTaskComment(...args),
  appendTaskActivityLog: vi.fn(),
}));

vi.mock("../reviewGate.js", () => ({
  evaluateReviewCommentsForAutoMode: vi.fn(),
}));

const { handleAutoReviewGate } = await import("../autoReviewHandler.js");
const { evaluateReviewCommentsForAutoMode } = await import("../reviewGate.js");

describe("handleAutoReviewGate", () => {
  const baseInput = { taskId: "task-1", projectRoot: "/tmp/test" };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when task is not in autoMode", async () => {
    mockFindTaskById.mockReturnValue({ id: "task-1", autoMode: false });

    const result = await handleAutoReviewGate(baseInput);

    expect(result).toBeNull();
    expect(evaluateReviewCommentsForAutoMode).not.toHaveBeenCalled();
    expect(mockCreateTaskComment).not.toHaveBeenCalled();
  });

  it("returns null when task is not found", async () => {
    mockFindTaskById.mockReturnValue(undefined);

    const result = await handleAutoReviewGate(baseInput);

    expect(result).toBeNull();
  });

  it("returns 'accepted' and creates success comment when review passes", async () => {
    mockFindTaskById.mockReturnValue({
      id: "task-1",
      autoMode: true,
      reviewComments: "Looks good",
    });
    vi.mocked(evaluateReviewCommentsForAutoMode).mockResolvedValue({ status: "success" });

    const result = await handleAutoReviewGate(baseInput);

    expect(result).toBe("accepted");
    expect(mockCreateTaskComment).toHaveBeenCalledOnce();
    const commentArg = mockCreateTaskComment.mock.calls[0][0];
    expect(commentArg.taskId).toBe("task-1");
    expect(commentArg.author).toBe("agent");
    expect(commentArg.message).toContain("## Auto Review Gate Summary");
    expect(commentArg.message).toContain("Outcome: success");
    expect(commentArg.message).toContain("Required fixes: 0");
  });

  it("returns 'rework_requested' and creates comment with fixes when review fails", async () => {
    mockFindTaskById.mockReturnValue({
      id: "task-1",
      autoMode: true,
      reviewComments: "## Code Review\n- fix A\n- fix B",
    });
    vi.mocked(evaluateReviewCommentsForAutoMode).mockResolvedValue({
      status: "request_changes",
      fixes: "- fix A\n- fix B",
    });

    const result = await handleAutoReviewGate(baseInput);

    expect(result).toBe("rework_requested");
    expect(mockCreateTaskComment).toHaveBeenCalledOnce();
    const commentArg = mockCreateTaskComment.mock.calls[0][0];
    expect(commentArg.message).toContain("Outcome: request_changes");
    expect(commentArg.message).toContain("Required fixes: 2");
    expect(commentArg.message).toContain("fix A");
    expect(commentArg.message).toContain("fix B");
  });

  it("passes reviewComments to evaluateReviewCommentsForAutoMode", async () => {
    mockFindTaskById.mockReturnValue({
      id: "task-1",
      autoMode: true,
      reviewComments: "specific review text",
    });
    vi.mocked(evaluateReviewCommentsForAutoMode).mockResolvedValue({ status: "success" });

    await handleAutoReviewGate(baseInput);

    expect(evaluateReviewCommentsForAutoMode).toHaveBeenCalledWith({
      taskId: "task-1",
      projectRoot: "/tmp/test",
      reviewComments: "specific review text",
    });
  });

  it("writes activity log entries for gate start and outcome", async () => {
    // Use the real logActivity (sync mode) which calls appendTaskActivityLog
    const { appendTaskActivityLog } = await import("@aif/data");

    mockFindTaskById.mockReturnValue({
      id: "task-1",
      autoMode: true,
      reviewComments: "ok",
    });
    vi.mocked(evaluateReviewCommentsForAutoMode).mockResolvedValue({ status: "success" });

    await handleAutoReviewGate(baseInput);

    const calls = vi.mocked(appendTaskActivityLog).mock.calls;
    const logTexts = calls.filter((c) => c[0] === "task-1").map((c) => c[1]);

    expect(logTexts.some((t) => t.includes("auto review gate started"))).toBe(true);
    expect(logTexts.some((t) => t.includes("auto review gate passed"))).toBe(true);
  });

  it("writes activity log for rework outcome", async () => {
    const { appendTaskActivityLog } = await import("@aif/data");

    mockFindTaskById.mockReturnValue({
      id: "task-1",
      autoMode: true,
      reviewComments: "issues",
    });
    vi.mocked(evaluateReviewCommentsForAutoMode).mockResolvedValue({
      status: "request_changes",
      fixes: "- fix X",
    });

    await handleAutoReviewGate(baseInput);

    const calls = vi.mocked(appendTaskActivityLog).mock.calls;
    const logTexts = calls.filter((c) => c[0] === "task-1").map((c) => c[1]);

    expect(logTexts.some((t) => t.includes("auto review gate started"))).toBe(true);
    expect(logTexts.some((t) => t.includes("auto review gate requested changes"))).toBe(true);
    expect(logTexts.some((t) => t.includes("1 items"))).toBe(true);
  });
});

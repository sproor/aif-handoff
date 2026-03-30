import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { initProjectDirectory } from "../projectInit.js";

describe("projectInit", () => {
  it("creates .ai-factory and is safe to run multiple times", () => {
    const projectRoot = mkdtempSync(join(tmpdir(), "aif-project-init-"));
    try {
      initProjectDirectory(projectRoot);
      initProjectDirectory(projectRoot);

      expect(existsSync(join(projectRoot, ".ai-factory"))).toBe(true);
    } finally {
      rmSync(projectRoot, { recursive: true, force: true });
    }
  }, 15000);
});

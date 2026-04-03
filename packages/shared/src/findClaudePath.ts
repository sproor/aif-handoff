import { existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { resolve } from "node:path";

/** Find the Claude CLI executable path from common install locations. */
export function findClaudePath(): string | undefined {
  const candidates = [
    resolve(process.env.HOME ?? "", ".local/bin/claude"),
    "/usr/local/bin/claude",
    "/opt/homebrew/bin/claude",
    resolve(process.env.HOME ?? "", ".npm-global/bin/claude"),
    "/usr/bin/claude",
  ];
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }

  // Fallback: ask the shell where claude lives (covers npm/npx global installs, nvm, etc.)
  try {
    const result = execSync("which claude", { encoding: "utf8", timeout: 3_000 }).trim();
    if (result && existsSync(result)) return result;
  } catch {
    // which not available or claude not in PATH
  }

  return undefined;
}

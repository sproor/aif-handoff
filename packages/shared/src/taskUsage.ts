import { eq, sql } from "drizzle-orm";
import { getDb } from "./db.js";
import { tasks } from "./schema.js";

interface UsageLike {
  input_tokens?: unknown;
  output_tokens?: unknown;
  cache_read_input_tokens?: unknown;
  cache_creation_input_tokens?: unknown;
  inputTokens?: unknown;
  outputTokens?: unknown;
  cacheReadInputTokens?: unknown;
  cacheCreationInputTokens?: unknown;
  total_cost_usd?: unknown;
  totalCostUsd?: unknown;
}

export interface TaskTokenUsage {
  input: number;
  output: number;
  total: number;
  costUsd: number;
}

function toTokenInt(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  const normalized = Math.trunc(value);
  return normalized > 0 ? normalized : 0;
}

function toNonNegativeNumber(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return value > 0 ? value : 0;
}

/**
 * Normalize SDK usage payload (snake_case/camelCase) into task-level in/out counters.
 */
export function parseTaskTokenUsage(usage: UsageLike | null | undefined): TaskTokenUsage {
  if (!usage) return { input: 0, output: 0, total: 0, costUsd: 0 };

  const promptInput = toTokenInt(usage.input_tokens ?? usage.inputTokens);
  const output = toTokenInt(usage.output_tokens ?? usage.outputTokens);
  const cacheRead = toTokenInt(usage.cache_read_input_tokens ?? usage.cacheReadInputTokens);
  const cacheCreation = toTokenInt(
    usage.cache_creation_input_tokens ?? usage.cacheCreationInputTokens
  );
  const input = promptInput + cacheRead + cacheCreation;
  const costUsd = toNonNegativeNumber(usage.total_cost_usd ?? usage.totalCostUsd);
  return { input, output, total: input + output, costUsd };
}

/**
 * Atomically increments token counters on a task row.
 */
export function incrementTaskTokenUsage(
  taskId: string,
  usage: UsageLike | null | undefined
): TaskTokenUsage {
  const delta = parseTaskTokenUsage(usage);
  if (delta.total === 0 && delta.costUsd === 0) return delta;

  const db = getDb();
  db.update(tasks)
    .set({
      tokenInput: sql<number>`coalesce(${tasks.tokenInput}, 0) + ${delta.input}`,
      tokenOutput: sql<number>`coalesce(${tasks.tokenOutput}, 0) + ${delta.output}`,
      tokenTotal: sql<number>`coalesce(${tasks.tokenTotal}, 0) + ${delta.total}`,
      costUsd: sql<number>`coalesce(${tasks.costUsd}, 0) + ${delta.costUsd}`,
    })
    .where(eq(tasks.id, taskId))
    .run();

  return delta;
}

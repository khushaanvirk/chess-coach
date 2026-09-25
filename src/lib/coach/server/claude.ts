import { query, type SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import { mkdtempSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { COACH_MODELS, type CoachModel } from "../models";

// Server-only. Runs one isolated Claude call through the Agent SDK, which
// authenticates with the local Claude Code login (your Claude plan).

export type CoachErrorCode =
  | "not_logged_in"
  | "limit_reached"
  | "budget_exceeded"
  | "invalid_output"
  | "aborted"
  | "failed";

export class CoachRunError extends Error {
  constructor(
    public readonly code: CoachErrorCode,
    message: string,
    public readonly resetsAt?: number
  ) {
    super(message);
    this.name = "CoachRunError";
  }
}

export interface StructuredRunParams {
  systemPrompt: string;
  prompt: string;
  jsonSchema: Record<string, unknown>;
  model: CoachModel;
  maxBudgetUsd: number;
  signal?: AbortSignal;
}

export interface StructuredRunResult {
  output: unknown;
  costUsd: number;
  numTurns: number;
  durationMs: number;
  model: string;
  apiKeySource: string;
  toolsAvailable: string[];
}

// Structured output may take an extra round trip to validate against the schema.
const MAX_TURNS = 3;

// Saves a round trip: without it the model writes prose, then the tool call.
const STRUCTURED_OUTPUT_RULE =
  "Deliver your answer only by calling the StructuredOutput tool. Do not write it as text first.";

// Applies to this invocation only (like --settings); nothing on disk changes.
const ISOLATION_SETTINGS = {
  disableClaudeAiConnectors: true,
  syncClaudeAiSkills: false,
  syncClaudeAiPlugins: false,
};

let isolatedCwd: string | undefined;
const getIsolatedCwd = (): string => {
  isolatedCwd ??= mkdtempSync(join(tmpdir(), "chess-coach-"));
  return isolatedCwd;
};

// Never let an API key in the shell environment redirect billing away from
// the Claude plan login.
const buildEnv = (): Record<string, string | undefined> => ({
  ...process.env,
  ANTHROPIC_API_KEY: undefined,
  ANTHROPIC_AUTH_TOKEN: undefined,
  CLAUDE_AGENT_SDK_CLIENT_APP: "chess-coach/0.1",
});

const looksLikeAuthError = (text: string): boolean =>
  /not logged in|invalid api key|authentication|\/login|unauthori[sz]ed|oauth/i.test(
    text
  );

export const runStructured = async (
  params: StructuredRunParams
): Promise<StructuredRunResult> => {
  const abortController = new AbortController();
  const onAbort = () => abortController.abort();
  params.signal?.addEventListener("abort", onAbort, { once: true });

  const modelInfo = COACH_MODELS[params.model];
  let apiKeySource = "unknown";
  let toolsAvailable: string[] = [];
  let rejectedResetsAt: number | undefined;
  let authError: string | undefined;

  try {
    const run = query({
      prompt: params.prompt,
      options: {
        model: params.model,
        ...(modelInfo.supportsEffort ? { effort: "medium" as const } : {}),
        systemPrompt: `${params.systemPrompt}\n\n${STRUCTURED_OUTPUT_RULE}`,
        tools: [],
        // Isolation: without these, the user's claude.ai connectors (Gmail,
        // Calendar, ...) ride along as ~39k tokens of tool definitions per call.
        settingSources: [],
        strictMcpConfig: true,
        mcpServers: {},
        settings: ISOLATION_SETTINGS,
        persistSession: false,
        cwd: getIsolatedCwd(),
        env: buildEnv(),
        maxTurns: MAX_TURNS,
        maxBudgetUsd: params.maxBudgetUsd,
        abortController,
        outputFormat: { type: "json_schema", schema: params.jsonSchema },
      },
    });

    for await (const message of run as AsyncIterable<SDKMessage>) {
      if (message.type === "system" && message.subtype === "init") {
        apiKeySource = message.apiKeySource;
        toolsAvailable = message.tools;
        continue;
      }

      if (message.type === "auth_status" && message.error) {
        authError = message.error;
        continue;
      }

      if (
        message.type === "rate_limit_event" &&
        message.rate_limit_info.status === "rejected"
      ) {
        rejectedResetsAt = message.rate_limit_info.resetsAt;
        continue;
      }

      if (message.type !== "result") continue;

      if (message.subtype === "error_max_budget_usd") {
        throw new CoachRunError(
          "budget_exceeded",
          `This run hit its $${params.maxBudgetUsd.toFixed(2)} budget cap.`
        );
      }

      if (message.subtype !== "success") {
        throw new CoachRunError(
          message.subtype === "error_max_structured_output_retries"
            ? "invalid_output"
            : "failed",
          `Claude stopped early (${message.subtype}).`
        );
      }

      if (message.is_error) {
        if (rejectedResetsAt !== undefined) {
          throw new CoachRunError(
            "limit_reached",
            "Your Claude plan limit or Agent SDK credit is used up.",
            rejectedResetsAt
          );
        }
        if (looksLikeAuthError(message.result)) {
          throw new CoachRunError(
            "not_logged_in",
            "Claude Code isn't logged in. Run `claude` in a terminal and use /login."
          );
        }
        throw new CoachRunError("failed", message.result || "Claude failed.");
      }

      return {
        output: message.structured_output ?? parseJsonFromText(message.result),
        costUsd: message.total_cost_usd,
        numTurns: message.num_turns,
        durationMs: message.duration_ms,
        model: params.model,
        apiKeySource,
        toolsAvailable,
      };
    }

    if (authError) {
      throw new CoachRunError("not_logged_in", authError);
    }
    throw new CoachRunError("failed", "Claude returned no result.");
  } catch (error) {
    if (error instanceof CoachRunError) throw error;
    if (abortController.signal.aborted) {
      throw new CoachRunError("aborted", "The request was cancelled.");
    }
    const text = error instanceof Error ? error.message : String(error);
    if (looksLikeAuthError(text)) {
      throw new CoachRunError(
        "not_logged_in",
        "Claude Code isn't logged in. Run `claude` in a terminal and use /login."
      );
    }
    throw new CoachRunError("failed", text);
  } finally {
    params.signal?.removeEventListener("abort", onAbort);
  }
};

const parseJsonFromText = (text: string): unknown => {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) return undefined;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return undefined;
  }
};

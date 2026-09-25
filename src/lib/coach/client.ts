import type { CoachModel } from "./models";
import type { ApiErrorCode, ApiResponse } from "./server/http";
import type { ReviewRunResult, TrendsRunResult } from "./server/review";
import type { GameDigest, ReviewPacket } from "./types";

// Browser-side calls to the local coach API. Types only from ./server, so no
// server code ends up in the page bundle.

export type CoachClientErrorCode = ApiErrorCode | "offline";

export class CoachClientError extends Error {
  constructor(
    public readonly code: CoachClientErrorCode,
    message: string,
    public readonly resetsAt?: number
  ) {
    super(message);
    this.name = "CoachClientError";
  }
}

const post = async <T>(
  path: string,
  body: unknown,
  signal?: AbortSignal
): Promise<T> => {
  let res: Response;
  try {
    res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });
  } catch (error) {
    if (signal?.aborted) throw new CoachClientError("aborted", "Cancelled.");
    throw new CoachClientError(
      "offline",
      error instanceof Error ? error.message : "offline"
    );
  }

  let json: ApiResponse<T>;
  try {
    json = (await res.json()) as ApiResponse<T>;
  } catch {
    throw new CoachClientError(
      "failed",
      `The coach server answered ${res.status}.`
    );
  }
  if (!json.ok) {
    throw new CoachClientError(
      json.error.code,
      json.error.message,
      json.error.resetsAt
    );
  }
  return json.data;
};

export const requestReview = (
  body: { packet: ReviewPacket; gameSans: string[]; model: CoachModel },
  signal?: AbortSignal
): Promise<ReviewRunResult> => post("/api/coach/review", body, signal);

export const requestTrends = (
  body: { digests: GameDigest[]; model: CoachModel },
  signal?: AbortSignal
): Promise<TrendsRunResult> => post("/api/coach/trends", body, signal);

const formatReset = (resetsAt: number | undefined): string => {
  if (!resetsAt) return "";
  const when = new Date(resetsAt * 1000);
  return ` It resets ${when.toLocaleString(undefined, {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  })}.`;
};

/** What to tell the user, in plain words, for anything that went wrong. */
export const describeCoachError = (error: unknown): string => {
  if (!(error instanceof CoachClientError)) {
    return error instanceof Error ? error.message : "Something went wrong.";
  }
  switch (error.code) {
    case "not_logged_in":
      return "Claude isn't connected. Open a terminal, run `claude`, and use /login with your Claude account, then try again.";
    case "limit_reached":
      return `Your Claude plan's limit or Agent SDK credit is used up.${formatReset(error.resetsAt)}`;
    case "budget_exceeded":
      return "This run hit its safety cap and was stopped before spending more. Try again, or pick a cheaper model.";
    case "invalid_output":
      return "Claude's answer came back in the wrong shape. Try again.";
    case "offline":
      return "Can't reach the local coach server. Is `npm run app` still running?";
    case "aborted":
      return "Cancelled.";
    case "busy":
      return "Claude is already working on two requests. Wait for one to finish, then try again.";
    default:
      return error.message;
  }
};

import type { NextApiRequest, NextApiResponse } from "next";
import type { CoachErrorCode } from "./claude";
import { CoachRunError } from "./claude";

// The coach API spends the user's Claude credit, so it only answers the
// user's own browser on this machine.

export type ApiErrorCode =
  | CoachErrorCode
  | "forbidden"
  | "bad_request"
  | "busy";

export interface ApiError {
  code: ApiErrorCode;
  message: string;
  resetsAt?: number;
}

export type ApiResponse<T> =
  | { ok: true; data: T }
  | { ok: false; error: ApiError };

const LOOPBACK_ADDRESSES = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);
const LOCAL_HOSTNAMES = new Set(["127.0.0.1", "localhost", "[::1]"]);

const STATUS_BY_CODE: Record<ApiErrorCode, number> = {
  forbidden: 403,
  bad_request: 400,
  busy: 429,
  not_logged_in: 401,
  limit_reached: 429,
  budget_exceeded: 402,
  invalid_output: 502,
  aborted: 499,
  failed: 500,
};

const hostnameOf = (value: string | undefined): string | undefined => {
  if (!value) return undefined;
  try {
    return new URL(value.includes("://") ? value : `http://${value}`).hostname;
  } catch {
    return undefined;
  }
};

export const sendError = <T>(
  res: NextApiResponse<ApiResponse<T>>,
  error: ApiError
): void => {
  if (res.writableEnded) return;
  res.status(STATUS_BY_CODE[error.code]).json({ ok: false, error });
};

/**
 * Rejects anything that isn't a same-origin JSON POST from this machine:
 * other devices on the network, other websites open in the browser, and
 * DNS-rebinding hosts. Returns false after sending the error response.
 */
export const guardLocalRequest = <T>(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<T>>
): boolean => {
  const forbid = (message: string) => {
    sendError(res, { code: "forbidden", message });
    return false;
  };

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return forbid("Use POST.");
  }
  if (!LOOPBACK_ADDRESSES.has(req.socket.remoteAddress ?? "")) {
    return forbid("The coach only answers requests from this computer.");
  }
  if (!LOCAL_HOSTNAMES.has(hostnameOf(req.headers.host) ?? "")) {
    return forbid("Unexpected host.");
  }
  const origin = req.headers.origin;
  if (origin && !LOCAL_HOSTNAMES.has(hostnameOf(origin) ?? "")) {
    return forbid("Cross-site requests are not allowed.");
  }
  if (!req.headers["content-type"]?.includes("application/json")) {
    return forbid("Send JSON.");
  }
  return true;
};

// A floor under runaway loops: batch review runs one game at a time, so two
// concurrent calls covers a manual review alongside it.
const MAX_IN_FLIGHT = 2;
let inFlight = 0;

/** Reserves a Claude call slot; returns a release function, or null when busy. */
export const acquireCallSlot = (): (() => void) | null => {
  if (inFlight >= MAX_IN_FLIGHT) return null;
  inFlight++;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    inFlight--;
  };
};

export const BUSY_ERROR: ApiError = {
  code: "busy",
  message: "Claude is already working on two requests. Wait for one to finish.",
};

/** Aborts the Claude call if the browser goes away before we answer. */
export const abortOnDisconnect = (res: NextApiResponse): AbortSignal => {
  const controller = new AbortController();
  res.on("close", () => {
    if (!res.writableEnded) controller.abort();
  });
  return controller.signal;
};

export const toApiError = (error: unknown): ApiError => {
  if (error instanceof CoachRunError) {
    return {
      code: error.code,
      message: error.message,
      resetsAt: error.resetsAt,
    };
  }
  console.error("[coach] unexpected error", error);
  return { code: "failed", message: "Something went wrong talking to Claude." };
};

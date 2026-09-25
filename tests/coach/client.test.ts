import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CoachClientError,
  describeCoachError,
  requestReview,
  requestTrends,
} from "@/lib/coach/client";
import { isCoachModel } from "@/lib/coach/models";
import { getKnownUsernames } from "@/lib/coach/states";
import type { ReviewPacket } from "@/lib/coach/types";

const packet = {} as ReviewPacket;

const respond = (body: unknown, status = 200) =>
  vi.fn().mockResolvedValue({
    status,
    json: () =>
      body instanceof Error ? Promise.reject(body) : Promise.resolve(body),
  });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("coach API client", () => {
  it("returns data from a successful response and posts JSON", async () => {
    const fetchMock = respond({ ok: true, data: { costUsd: 0.04 } });
    vi.stubGlobal("fetch", fetchMock);

    const result = await requestReview({ packet, gameSans: [], model: "claude-opus-5" });

    expect(result).toEqual({ costUsd: 0.04 });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/coach/review");
    expect(init.method).toBe("POST");
    expect(init.headers["Content-Type"]).toBe("application/json");
  });

  it("turns an API error envelope into a typed error", async () => {
    vi.stubGlobal(
      "fetch",
      respond({ ok: false, error: { code: "limit_reached", message: "x", resetsAt: 1 } }, 429)
    );

    const error = await requestTrends({ digests: [], model: "claude-opus-5" }).catch((e) => e);
    expect(error).toBeInstanceOf(CoachClientError);
    expect(error).toMatchObject({ code: "limit_reached", resetsAt: 1 });
  });

  it("reports an unreachable server as offline and a cancel as aborted", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    await expect(
      requestReview({ packet, gameSans: [], model: "claude-opus-5" })
    ).rejects.toMatchObject({ code: "offline" });

    const controller = new AbortController();
    controller.abort();
    await expect(
      requestReview({ packet, gameSans: [], model: "claude-opus-5" }, controller.signal)
    ).rejects.toMatchObject({ code: "aborted" });
  });

  it("handles a response that isn't JSON", async () => {
    vi.stubGlobal("fetch", respond(new SyntaxError("bad json"), 502));
    await expect(
      requestReview({ packet, gameSans: [], model: "claude-opus-5" })
    ).rejects.toMatchObject({ code: "failed" });
  });
});

describe("describeCoachError", () => {
  it.each([
    ["not_logged_in", /\/login/],
    ["limit_reached", /used up/],
    ["budget_exceeded", /safety cap/],
    ["invalid_output", /wrong shape/],
    ["offline", /npm run app/],
    ["aborted", /Cancelled/],
  ] as const)("explains %s in plain words", (code, pattern) => {
    expect(describeCoachError(new CoachClientError(code, "raw"))).toMatch(pattern);
  });

  it("mentions when the limit resets", () => {
    expect(
      describeCoachError(new CoachClientError("limit_reached", "raw", 1_790_000_000))
    ).toMatch(/resets/);
  });

  it("falls back to the message for other errors", () => {
    expect(describeCoachError(new CoachClientError("failed", "boom"))).toBe("boom");
    expect(describeCoachError(new Error("plain"))).toBe("plain");
    expect(describeCoachError("weird")).toBe("Something went wrong.");
  });
});

describe("getKnownUsernames", () => {
  it("reads Chesskit's stored username history", () => {
    const store: Record<string, string> = {
      "chesscom-username": JSON.stringify("Khushaan, other"),
      "lichess-username": "not json",
    };
    vi.stubGlobal("window", { localStorage: { getItem: (k: string) => store[k] ?? null } });

    expect(getKnownUsernames()).toEqual(["Khushaan", "other"]);
  });

  it("returns nothing outside the browser", () => {
    expect(getKnownUsernames()).toEqual([]);
  });
});

describe("isCoachModel", () => {
  it("accepts only known models", () => {
    expect(isCoachModel("claude-opus-5")).toBe(true);
    expect(isCoachModel("gpt-9")).toBe(false);
    expect(isCoachModel(5)).toBe(false);
  });
});

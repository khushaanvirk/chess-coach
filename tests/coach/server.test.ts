import { describe, expect, it, vi } from "vitest";
import { Chess } from "chess.js";
import type { NextApiRequest, NextApiResponse } from "next";
import { buildReviewPacket } from "@/lib/coach/packet";
import { reviewRequestSchema, trendsRequestSchema } from "@/lib/coach/schema";
import { acquireCallSlot, guardLocalRequest, toApiError } from "@/lib/coach/server/http";
import { CoachRunError } from "@/lib/coach/server/claude";
import { TRAP_PGN, trapEval } from "./fixtures";

const fixtureRequest = () => {
  const game = new Chess();
  game.loadPgn(TRAP_PGN);
  const packet = buildReviewPacket({ game, gameEval: trapEval(), userSide: "w" });
  return { packet, gameSans: game.history(), model: "claude-opus-5" };
};

describe("request schemas", () => {
  it("accepts a packet built by the real packet builder", () => {
    expect(reviewRequestSchema.safeParse(fixtureRequest()).success).toBe(true);
  });

  it("rejects unknown models and oversized input", () => {
    expect(reviewRequestSchema.safeParse({ ...fixtureRequest(), model: "gpt-9" }).success).toBe(
      false
    );
    const huge = fixtureRequest();
    huge.packet.moves = "x".repeat(20_000);
    expect(reviewRequestSchema.safeParse(huge).success).toBe(false);
  });

  it("needs at least two games for trends", () => {
    expect(trendsRequestSchema.safeParse({ digests: [], model: "claude-opus-5" }).success).toBe(
      false
    );
  });
});

const mockRes = () => {
  const res = {
    writableEnded: false,
    statusCode: 200,
    body: undefined as unknown,
    headers: {} as Record<string, string>,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: unknown) {
      this.body = body;
      this.writableEnded = true;
      return this;
    },
    setHeader(name: string, value: string) {
      this.headers[name] = value;
    },
  };
  return res as unknown as NextApiResponse & typeof res;
};

const mockReq = (overrides: {
  method?: string;
  remoteAddress?: string;
  headers?: Record<string, string>;
}) =>
  ({
    method: overrides.method ?? "POST",
    socket: { remoteAddress: overrides.remoteAddress ?? "127.0.0.1" },
    headers: {
      host: "127.0.0.1:3000",
      "content-type": "application/json",
      ...overrides.headers,
    },
  }) as unknown as NextApiRequest;

describe("guardLocalRequest", () => {
  it("lets a same-origin JSON POST from this machine through", () => {
    const res = mockRes();
    const req = mockReq({ headers: { origin: "http://127.0.0.1:3000" } });
    expect(guardLocalRequest(req, res)).toBe(true);
  });

  it.each([
    ["another device", { remoteAddress: "192.168.1.20" }],
    ["another website", { headers: { origin: "https://evil.example" } }],
    ["a rebinding host", { headers: { host: "evil.example:3000" } }],
    ["a form post", { headers: { "content-type": "text/plain" } }],
    ["a GET", { method: "GET" }],
  ])("refuses %s", (_, overrides) => {
    const res = mockRes();
    expect(guardLocalRequest(mockReq(overrides), res)).toBe(false);
    expect(res.statusCode).toBe(403);
  });
});

describe("acquireCallSlot", () => {
  it("allows two calls at once and frees a slot on release", () => {
    const first = acquireCallSlot();
    const second = acquireCallSlot();
    expect(first).not.toBeNull();
    expect(second).not.toBeNull();
    expect(acquireCallSlot()).toBeNull();

    first?.();
    first?.(); // releasing twice must not free a second slot
    const third = acquireCallSlot();
    expect(third).not.toBeNull();
    expect(acquireCallSlot()).toBeNull();

    second?.();
    third?.();
  });
});

describe("toApiError", () => {
  it("passes coach errors through with their code", () => {
    expect(toApiError(new CoachRunError("limit_reached", "used up", 123))).toEqual({
      code: "limit_reached",
      message: "used up",
      resetsAt: 123,
    });
  });

  it("hides unexpected errors behind a generic message", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(toApiError(new Error("stack details"))).toEqual({
      code: "failed",
      message: "Something went wrong talking to Claude.",
    });
    spy.mockRestore();
  });
});

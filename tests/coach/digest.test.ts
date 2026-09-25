import { describe, expect, it } from "vitest";
import { Chess } from "chess.js";
import { buildDigest, getOutcome, getTimeClass, summarizeDigests } from "@/lib/coach/digest";
import { buildReviewPacket } from "@/lib/coach/packet";
import { validateReviewOutput } from "@/lib/coach/validate";
import { TRAP_PGN, trapEval } from "./fixtures";

describe("getOutcome", () => {
  it("reads the result from the user's side", () => {
    expect(getOutcome("1-0", "w")).toBe("win");
    expect(getOutcome("1-0", "b")).toBe("loss");
    expect(getOutcome("0-1", "b")).toBe("win");
    expect(getOutcome("1/2-1/2", "w")).toBe("draw");
    expect(getOutcome("*", "w")).toBe("unknown");
    expect(getOutcome(undefined, "w")).toBe("unknown");
  });
});

describe("getTimeClass", () => {
  it("uses base + 40 x increment like lichess", () => {
    expect(getTimeClass("60")).toBe("bullet");
    expect(getTimeClass("120+1")).toBe("bullet");
    expect(getTimeClass("180+2")).toBe("blitz");
    expect(getTimeClass("600")).toBe("rapid");
    expect(getTimeClass("1800")).toBe("classical");
    expect(getTimeClass("1/86400")).toBe("daily");
    expect(getTimeClass(undefined)).toBe("unknown");
    expect(getTimeClass("-")).toBe("unknown");
  });
});

describe("buildDigest", () => {
  it("joins the packet's facts with the coach's words", () => {
    const game = new Chess();
    game.loadPgn(TRAP_PGN);
    const packet = buildReviewPacket({ game, gameEval: trapEval(), userSide: "w" });
    const review = validateReviewOutput(
      {
        summary: "s",
        takeaways: ["a", "b", "c"],
        moments: [
          { ply: 6, title: "Pawn grab", explanation: "e", lesson: "Check queen moves." },
          { ply: 8, title: "Greedy knight", explanation: "e", lesson: "Protect g2." },
        ],
      },
      packet,
      game.history()
    );

    const digest = buildDigest({
      gameKey: "k1",
      gameId: 7,
      packet,
      review,
      reviewedAt: "2026-09-25T00:00:00.000Z",
    });

    expect(digest).toMatchObject({
      gameKey: "k1",
      gameId: 7,
      userName: "khushaan_test",
      userSide: "w",
      opponentName: "TrapSetter",
      userRating: 812,
      opponentRating: 845,
      outcome: "loss",
      timeClass: "rapid",
      opening: "Italian Game: Blackburne Shilling Gambit",
      accuracy: { user: 41.2, opponent: 88.9 },
    });
    expect(digest.counts).toEqual({
      blunder: 2,
      miss: 0,
      mistake: 0,
      inaccuracy: 0,
      brilliant: 0,
      great: 0,
    });
    expect(digest.moments[0]).toMatchObject({
      ply: 6,
      label: "blunder",
      phase: "opening",
      title: "Pawn grab",
      lesson: "Check queen moves.",
    });
    expect(digest.moments[0].clockSeconds).toBeCloseTo(571.4);
  });
});

describe("summarizeDigests", () => {
  const base = {
    userName: "me",
    userSide: "w" as const,
    opponentName: "o",
    timeClass: "blitz" as const,
    reviewedAt: "2026-09-25T00:00:00.000Z",
  };
  const m = (label: "blunder" | "mistake" | "great", phase: "opening" | "middlegame" | "endgame", clockSeconds?: number) => ({
    ply: 1,
    moveNumber: "1.",
    label,
    phase,
    tags: [],
    title: "",
    lesson: "",
    clockSeconds,
  });

  it("aggregates results, accuracy, error phases and time trouble", () => {
    const stats = summarizeDigests([
      {
        ...base,
        gameKey: "a",
        outcome: "win",
        accuracy: { user: 80, opponent: 60 },
        counts: { blunder: 1, miss: 0, mistake: 1, inaccuracy: 0, brilliant: 0, great: 1 },
        moments: [m("blunder", "middlegame", 12), m("mistake", "endgame", 90), m("great", "opening")],
      },
      {
        ...base,
        gameKey: "b",
        outcome: "loss",
        accuracy: { user: 60, opponent: 85 },
        counts: { blunder: 2, miss: 0, mistake: 0, inaccuracy: 0, brilliant: 0, great: 0 },
        moments: [m("blunder", "middlegame", 25), m("blunder", "opening")],
      },
    ]);

    expect(stats).toEqual({
      games: 2,
      record: { win: 1, loss: 1, draw: 0 },
      averageAccuracy: 70,
      errorsPerGame: 2,
      errorPhases: { opening: 1, middlegame: 2, endgame: 1 },
      timeTroubleErrors: 2,
    });
  });

  it("handles no games", () => {
    expect(summarizeDigests([]).games).toBe(0);
    expect(summarizeDigests([]).averageAccuracy).toBe(0);
  });
});

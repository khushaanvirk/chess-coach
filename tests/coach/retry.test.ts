import { describe, expect, it } from "vitest";
import { judgeAttempt, judgeByEngine, selectDrills } from "@/lib/coach/retry";
import type { CoachReview, ReviewedMoment } from "@/lib/coach/types";

const moment = (overrides: Partial<ReviewedMoment> = {}): ReviewedMoment => ({
  ply: 6,
  moveNumber: "4.",
  label: "blunder",
  fen: "r1bqkbnr/pppp1ppp/8/4p3/2BnP3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4",
  playedMove: "Nxe5",
  bestMove: "Nxd4",
  goodMoves: ["Nxd4", "O-O"],
  winChanceBefore: 57,
  title: "t",
  explanation: "e",
  lesson: "l",
  unverified: false,
  unverifiedMoves: [],
  ...overrides,
});

describe("judgeAttempt", () => {
  it("recognises the best move, ignoring check marks", () => {
    expect(judgeAttempt(moment({ bestMove: "Bxf7+" }), "Bxf7+")).toBe("best");
    expect(judgeAttempt(moment({ bestMove: "Bxf7+" }), "Bxf7")).toBe("best");
  });

  it("accepts the engine's other good moves", () => {
    expect(judgeAttempt(moment(), "O-O")).toBe("good");
  });

  it("calls out repeating the game move", () => {
    expect(judgeAttempt(moment(), "Nxe5")).toBe("played");
  });

  it("asks the engine about anything else", () => {
    expect(judgeAttempt(moment(), "d3")).toBe("needs-engine");
  });
});

describe("judgeByEngine", () => {
  it("accepts a move that keeps you within the margin of best play", () => {
    expect(judgeByEngine(57, 54)).toBe("good");
  });

  it("rejects a move that throws away chances", () => {
    expect(judgeByEngine(57, 30)).toBe("wrong");
  });
});

const review = (gameKey: string, createdAt: string, moments: ReviewedMoment[]): CoachReview => ({
  id: `${gameKey}|claude-opus-5|2`,
  gameKey,
  model: "claude-opus-5",
  promptVersion: 2,
  createdAt,
  userSide: "w",
  engine: { name: "stockfish_18_lite", depth: 16, date: createdAt },
  summary: "s",
  takeaways: [],
  moments,
  costUsd: 0.04,
});

describe("selectDrills", () => {
  const older = review("g1", "2026-09-20T00:00:00Z", [
    moment({ ply: 10 }),
    moment({ ply: 4, label: "mistake" }),
  ]);
  const newer = review("g2", "2026-09-24T00:00:00Z", [
    moment({ ply: 8, label: "miss" }),
    moment({ ply: 12, label: "inaccuracy" }),
    moment({ ply: 14, label: "great", bestMove: null }),
    moment({ ply: 16, fen: "" }),
  ]);

  it("keeps blunders, mistakes and misses that have a better move and a position", () => {
    const drills = selectDrills([older, newer]);
    expect(drills.map((d) => [d.gameKey, d.moment.ply])).toEqual([
      ["g2", 8],
      ["g1", 4],
      ["g1", 10],
    ]);
    expect(drills[0].userSide).toBe("w");
  });

  it("caps the number of drills", () => {
    expect(selectDrills([older, newer], 2)).toHaveLength(2);
  });
});

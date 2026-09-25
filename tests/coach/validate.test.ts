import { describe, expect, it } from "vitest";
import { Chess } from "chess.js";
import { buildReviewPacket } from "@/lib/coach/packet";
import {
  InvalidCoachOutputError,
  extractMoveMentions,
  validateReviewOutput,
  validateTrendsOutput,
} from "@/lib/coach/validate";
import type { GameDigest } from "@/lib/coach/types";
import { TRAP_PGN, trapEval } from "./fixtures";

const packet = () => {
  const game = new Chess();
  game.loadPgn(TRAP_PGN);
  return { packet: buildReviewPacket({ game, gameEval: trapEval(), userSide: "w" }), sans: game.history() };
};

const goodOutput = {
  summary: "You fell for the Blackburne Shilling trap.",
  takeaways: ["Check what the queen attacks.", "Count defenders.", "Castle early.", "extra"],
  moments: [
    {
      ply: 6,
      title: "Grabbing the e5 pawn",
      explanation: "Nxe5 walks into Qg5, hitting the knight and g2. Nxd4 exd4 O-O was safe.",
      lesson: "Before taking a pawn, ask what your opponent's next move attacks.",
    },
    {
      ply: 8,
      title: "The fork that wasn't",
      explanation: "Nxf7 lets Qxg2 in. Bxf7+ was the better try.",
      lesson: "Defend g2 when the queen lands on g5.",
    },
  ],
};

describe("extractMoveMentions", () => {
  it("finds piece moves, captures and castling but not bare squares", () => {
    expect(
      extractMoveMentions("After 4...Qg5 the pawn on e4 falls; 0-0 and exd5 or Bxf7+ were ideas, e8=Q too.")
    ).toEqual(["Qg5", "O-O", "exd5", "Bxf7", "e8=Q"]);
  });
});

describe("validateReviewOutput", () => {
  it("maps Claude's moments onto the packet and trims takeaways to three", () => {
    const { packet: p, sans } = packet();
    const review = validateReviewOutput(goodOutput, p, sans);

    expect(review.takeaways).toHaveLength(3);
    expect(review.moments.map((m) => [m.ply, m.moveNumber, m.playedMove, m.bestMove])).toEqual([
      [6, "4.", "Nxe5", "Nxd4"],
      [8, "5.", "Nxf7", "Bxf7+"],
    ]);
    expect(review.moments.every((m) => !m.unverified)).toBe(true);
    expect(review.moments[0].fen).toBe(p.moments[0].fen);
    expect(review.moments[0].goodMoves).toEqual(p.moments[0].goodMoves);
    expect(review.moments[0].winChanceBefore).toBe(p.moments[0].winChanceBefore);
  });

  it("marks a moment unverified when it cites a move the engine never showed", () => {
    const { packet: p, sans } = packet();
    const output = {
      ...goodOutput,
      moments: [
        { ...goodOutput.moments[0], explanation: "Instead Bb5 would have pinned the knight." },
        goodOutput.moments[1],
      ],
    };
    const review = validateReviewOutput(output, p, sans);

    expect(review.moments[0].unverified).toBe(true);
    expect(review.moments[0].unverifiedMoves).toEqual(["Bb5"]);
    expect(review.moments[1].unverified).toBe(false);
  });

  it("drops moments for plies that are not key moments and fills in missing ones", () => {
    const { packet: p, sans } = packet();
    const output = {
      ...goodOutput,
      moments: [{ ply: 3, title: "x", explanation: "y", lesson: "z" }, goodOutput.moments[1]],
    };
    const review = validateReviewOutput(output, p, sans);

    expect(review.moments.map((m) => m.ply)).toEqual([6, 8]);
    const fallback = review.moments[0];
    expect(fallback.explanation).toMatch(/Nxe5/);
    expect(fallback.explanation).toMatch(/Nxd4/);
    expect(fallback.unverified).toBe(false);
  });

  it("rejects output that does not match the schema", () => {
    const { packet: p, sans } = packet();
    expect(() => validateReviewOutput({ takeaways: [] }, p, sans)).toThrow(InvalidCoachOutputError);
    expect(() => validateReviewOutput(undefined, p, sans)).toThrow(InvalidCoachOutputError);
  });
});

const digest = (gameKey: string, plies: number[]): GameDigest => ({
  gameKey,
  userName: "me",
  userSide: "w",
  opponentName: "them",
  outcome: "loss",
  timeClass: "blitz",
  accuracy: { user: 60, opponent: 80 },
  counts: { blunder: plies.length, miss: 0, mistake: 0, inaccuracy: 0, brilliant: 0, great: 0 },
  moments: plies.map((ply) => ({
    ply,
    moveNumber: `${Math.floor(ply / 2) + 1}.`,
    label: "blunder" as const,
    phase: "middlegame" as const,
    tags: [],
    title: "t",
    lesson: "l",
  })),
  reviewedAt: "2026-09-25T00:00:00.000Z",
});

describe("validateTrendsOutput", () => {
  const digests = [digest("g1", [10, 20]), digest("g2", [14])];
  const output = {
    headline: "You hang pieces after attacking.",
    patterns: [
      {
        name: "Loose pieces",
        description: "Pieces left undefended.",
        evidence: [
          { gameKey: "g1", ply: 10 },
          { gameKey: "g2", ply: 14 },
          { gameKey: "g2", ply: 99 },
          { gameKey: "made-up", ply: 10 },
        ],
      },
      { name: "Imaginary", description: "No real evidence.", evidence: [{ gameKey: "nope", ply: 1 }] },
    ],
    strengths: ["Good openings"],
    focusAreas: [
      { what: "Blunder check", howToPractice: "Before each move, list what is attacked." },
      { what: "Tactics", howToPractice: "Fork puzzles." },
      { what: "Endgames", howToPractice: "Rook endings." },
      { what: "Extra", howToPractice: "Dropped." },
    ],
  };

  it("keeps only evidence that exists and drops patterns left with none", () => {
    const report = validateTrendsOutput(output, digests);

    expect(report.patterns).toHaveLength(1);
    expect(report.patterns[0].evidence).toEqual([
      { gameKey: "g1", ply: 10 },
      { gameKey: "g2", ply: 14 },
    ]);
    expect(report.focusAreas).toHaveLength(3);
  });

  it("rejects malformed trends output", () => {
    expect(() => validateTrendsOutput({ headline: 1 }, digests)).toThrow(InvalidCoachOutputError);
  });
});

describe("prompts", () => {
  it("keeps raw tags out of the review prompt but in plain words for trends", async () => {
    const { buildReviewPrompt, buildTrendsPrompt } = await import("@/lib/coach/prompts");
    const { packet: p } = packet();
    expect(buildReviewPrompt(p)).not.toContain("refutation_capture");
    expect(buildReviewPrompt(p)).toContain("Nxe5");

    const trends = buildTrendsPrompt([
      { ...digest("g1", [10]), moments: [{ ...digest("g1", [10]).moments[0], tags: ["hangs_piece"] }] },
    ]);
    expect(trends).toContain("left a piece hanging");
    expect(trends).not.toContain("hangs_piece");
  });
});

import { describe, expect, it } from "vitest";
import {
  computeMomentFacts,
  getGamePhase,
  lineToSan,
  parseClockSeconds,
} from "@/lib/coach/facts";

// Black to move; White's knight on b5 is one hop from forking e8 and a8.
const FORK_FEN = "r3kbnr/ppp2ppp/2n5/1N1pp3/8/8/PPPPPPPP/R1BQKBNR b KQkq - 0 1";
// White to move; Ng5 would put the knight where the d8 queen takes it for free.
const HANG_FEN = "rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3";

describe("computeMomentFacts", () => {
  it("tags a knight fork in the refutation and says what it hits", () => {
    const facts = computeMomentFacts({
      fenBefore: FORK_FEN,
      playedUci: "g8f6",
      bestPv: ["a7a6", "b5c3"],
      refutationPv: ["b5c7", "e8d7", "c7a8"],
      userSide: "b",
    });

    expect(facts.playedSan).toBe("Nf6");
    expect(facts.bestSan).toBe("a6");
    expect(facts.refutationLine).toEqual(["Nxc7+", "Kd7", "Nxa8"]);
    expect(facts.tags).toEqual(
      expect.arrayContaining(["fork", "refutation_check", "refutation_capture"])
    );
    expect(facts.hints.join(" ")).toMatch(/Nxc7\+ forks your king on e8 and rook on a8/);
  });

  it("flags a piece left hanging only when the refutation takes it", () => {
    const facts = computeMomentFacts({
      fenBefore: HANG_FEN,
      playedUci: "f3g5",
      bestPv: ["f1c4"],
      refutationPv: ["d8g5", "d2d4"],
      userSide: "w",
    });

    expect(facts.tags).toContain("hangs_piece");
    expect(facts.hints.join(" ")).toMatch(/knight on g5 was left undefended/);
    // Losing the knight shows up as -3 at the end of the played line.
    expect(facts.materialAfterPlayedLine).toBe(-3);
  });

  it("does not flag a hanging piece the engine does not take", () => {
    const facts = computeMomentFacts({
      fenBefore: HANG_FEN,
      playedUci: "f3g5",
      bestPv: ["f1c4"],
      refutationPv: ["d7d6", "d2d4"],
      userSide: "w",
    });

    expect(facts.tags).not.toContain("hangs_piece");
  });

  it("reports a missed fork when the best move forks", () => {
    // Same fork position, but White to move with the knight already able to fork.
    const fen = "r3kbnr/ppp2ppp/2n2n2/1N1pp3/8/8/PPPPPPPP/R1BQKBNR w KQkq - 1 2";
    const facts = computeMomentFacts({
      fenBefore: fen,
      playedUci: "a2a3",
      bestPv: ["b5c7", "e8d7", "c7a8"],
      refutationPv: ["a7a6"],
      userSide: "w",
    });

    expect(facts.bestSan).toBe("Nxc7+");
    expect(facts.tags).toContain("missed_fork");
    expect(facts.tags).toContain("missed_material");
    expect(facts.materialAfterBestLine).toBeGreaterThanOrEqual(5);
  });

  it("returns a null best move when the played move was best", () => {
    const facts = computeMomentFacts({
      fenBefore: HANG_FEN,
      playedUci: "f1c4",
      bestPv: ["f1c4", "g8f6"],
      refutationPv: ["g8f6"],
      userSide: "w",
    });

    expect(facts.bestSan).toBeNull();
  });

  it("describes a missed mate and an allowed mate from the user's side", () => {
    const facts = computeMomentFacts({
      fenBefore: HANG_FEN,
      playedUci: "f1c4",
      bestPv: ["f3e5"],
      refutationPv: ["d8h4"],
      userSide: "w",
      bestLineMateForUser: 3,
      playedLineMateForUser: -2,
    });

    expect(facts.tags).toEqual(expect.arrayContaining(["missed_mate", "allows_mate"]));
    expect(facts.hints.join(" ")).toMatch(/forced mate in 3/);
    expect(facts.hints.join(" ")).toMatch(/mate in 2/);
  });
});

describe("lineToSan", () => {
  it("converts UCI to SAN and stops at the first illegal move", () => {
    expect(lineToSan(HANG_FEN, ["f3g5", "d8g5", "a1a8"])).toEqual(["Ng5", "Qxg5"]);
  });

  it("caps long lines", () => {
    const pv = ["g1f3", "g8f6", "f3g1", "f6g8", "g1f3", "g8f6", "f3g1", "f6g8", "g1f3"];
    expect(lineToSan("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", pv)).toHaveLength(8);
  });
});

describe("getGamePhase", () => {
  it("calls the first ten moves the opening", () => {
    expect(getGamePhase(HANG_FEN)).toBe("opening");
  });

  it("detects an endgame by remaining piece material", () => {
    expect(getGamePhase("8/5pk1/6p1/8/3R4/6P1/5PK1/3r4 w - - 0 40")).toBe("endgame");
  });

  it("treats a full board after move ten as the middlegame", () => {
    expect(
      getGamePhase("r2q1rk1/ppp2ppp/2np1n2/2b1p1B1/2B1P1b1/2NP1N2/PPP2PPP/R2Q1RK1 w - - 0 11")
    ).toBe("middlegame");
  });
});

describe("parseClockSeconds", () => {
  it("parses chess.com clock comments", () => {
    expect(parseClockSeconds("[%clk 0:02:31.5]")).toBeCloseTo(151.5);
    expect(parseClockSeconds("[%clk 1:00:00]")).toBe(3600);
  });

  it("returns undefined without a clock", () => {
    expect(parseClockSeconds("a nice move")).toBeUndefined();
    expect(parseClockSeconds(undefined)).toBeUndefined();
  });
});

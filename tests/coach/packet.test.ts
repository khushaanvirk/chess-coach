import { describe, expect, it } from "vitest";
import { Chess } from "chess.js";
import { buildReviewPacket, formatUserEval, getGoodMoves } from "@/lib/coach/packet";
import { detectUserSide, getGameKey, getUnsupportedReason } from "@/lib/coach/gameKey";
import { TRAP_PGN, trapEval } from "./fixtures";

const loadTrap = (): Chess => {
  const game = new Chess();
  game.loadPgn(TRAP_PGN);
  return game;
};

describe("buildReviewPacket", () => {
  it("builds grounded moments for the user's blunders", () => {
    const packet = buildReviewPacket({ game: loadTrap(), gameEval: trapEval(), userSide: "w" });

    expect(packet.moments.map((m) => [m.ply, m.moveNumber, m.label, m.playedMove])).toEqual([
      [6, "4.", "blunder", "Nxe5"],
      [8, "5.", "blunder", "Nxf7"],
    ]);

    const [first, second] = packet.moments;
    expect(first.bestMove).toBe("Nxd4");
    expect(first.fen).toBe("r1bqkbnr/pppp1ppp/8/4p3/2BnP3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4");
    // The fixture's second line (h3, 40cp worse) is within the good-move margin.
    expect(first.goodMoves).toEqual(["Nxd4", "h3"]);
    expect(first.bestLine).toEqual(["Nxd4", "exd4", "O-O"]);
    expect(first.refutationLine).toEqual(["Qg5", "Nxf7", "Qxg2", "Rf1", "Qxe4+", "Be2", "Nf3#"]);
    expect(first.winChanceBefore).toBeGreaterThan(first.winChanceAfter);
    expect(first.evalBefore).toBe("+0.80");
    expect(first.evalAfter).toBe("-1.50");
    expect(first.clockSeconds).toBeCloseTo(571.4);
    expect(first.phase).toBe("opening");

    expect(second.bestMove).toBe("Bxf7+");
    expect(second.tags).toContain("refutation_capture");
  });

  it("fills in game context from headers and the evaluation", () => {
    const packet = buildReviewPacket({ game: loadTrap(), gameEval: trapEval(), userSide: "w" });

    expect(packet.game).toMatchObject({
      white: { name: "khushaan_test", rating: 812 },
      black: { name: "TrapSetter", rating: 845 },
      userSide: "white",
      result: "0-1",
      timeControl: "600",
      opening: "Italian Game: Blackburne Shilling Gambit",
      accuracy: { user: 41.2, opponent: 88.9 },
      engine: { name: "stockfish_18_lite", depth: 16 },
      moveCount: 14,
    });
    expect(packet.moves).toBe(
      "1. e4 e5 2. Nf3 Nc6 3. Bc4 Nd4 4. Nxe5 Qg5 5. Nxf7 Qxg2 6. Rf1 Qxe4+ 7. Be2 Nf3#"
    );
  });

  it("returns no moments for the side that played cleanly", () => {
    const packet = buildReviewPacket({ game: loadTrap(), gameEval: trapEval(), userSide: "b" });
    expect(packet.game.userSide).toBe("black");
    expect(packet.game.accuracy).toEqual({ user: 88.9, opponent: 41.2 });
    expect(packet.moments).toEqual([]);
  });

  it("refuses an evaluation that does not match the game", () => {
    const gameEval = trapEval();
    const truncated = { ...gameEval, positions: gameEval.positions.slice(0, 5) };
    expect(() =>
      buildReviewPacket({ game: loadTrap(), gameEval: truncated, userSide: "w" })
    ).toThrow(/doesn't match/);
  });
});

describe("getGoodMoves", () => {
  const fen = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1";
  const position = {
    lines: [
      { pv: ["e7e5"], cp: -20, depth: 16, multiPv: 1 },
      { pv: ["c7c5"], cp: -35, depth: 16, multiPv: 2 },
      { pv: ["g7g5"], cp: 250, depth: 16, multiPv: 3 },
    ],
  };

  it("keeps moves close to the best from the user's side, best first", () => {
    expect(getGoodMoves(fen, position, "b", "a7a6")).toEqual(["e5", "c5"]);
  });

  it("never offers the move that was actually played", () => {
    expect(getGoodMoves(fen, position, "b", "c7c5")).toEqual(["e5"]);
  });

  it("ignores unscored lines", () => {
    expect(getGoodMoves(fen, { lines: [{ pv: ["e7e5"], depth: 1, multiPv: 1 }] }, "b", "a7a6")).toEqual([]);
  });
});

describe("formatUserEval", () => {
  it("shows centipawns and mates from the user's side", () => {
    expect(formatUserEval({ cp: 120 }, "w")).toBe("+1.20");
    expect(formatUserEval({ cp: 120 }, "b")).toBe("-1.20");
    expect(formatUserEval({ mate: -2 }, "w")).toBe("-M2");
    expect(formatUserEval({ mate: -2 }, "b")).toBe("+M2");
    expect(formatUserEval(undefined, "w")).toBe("?");
  });
});

describe("gameKey helpers", () => {
  it("uses the chess.com link as a stable key", async () => {
    const headers = loadTrap().getHeaders();
    expect(await getGameKey(headers, [])).toBe("https://www.chess.com/game/live/123456789");
  });

  it("uses the lichess site URL", async () => {
    expect(await getGameKey({ Site: "https://lichess.org/AbCdEf12" }, [])).toBe(
      "https://lichess.org/AbCdEf12"
    );
  });

  it("hashes players, date and moves when there is no link", async () => {
    const headers = { White: "a", Black: "b", Date: "2026.01.01" };
    const key = await getGameKey(headers, ["e4", "e5"]);
    expect(key).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(await getGameKey(headers, ["e4", "e5"])).toBe(key);
    expect(await getGameKey(headers, ["d4"])).not.toBe(key);
  });

  it("detects the user's side by username, ignoring case and spaces", () => {
    const headers = loadTrap().getHeaders();
    expect(detectUserSide(headers, [" Khushaan_Test "])).toBe("w");
    expect(detectUserSide(headers, ["someone", "trapsetter"])).toBe("b");
    expect(detectUserSide(headers, ["nobody"])).toBeNull();
    expect(detectUserSide(headers, [])).toBeNull();
  });

  it("rejects Chess960 and custom start positions", () => {
    expect(getUnsupportedReason(loadTrap().getHeaders())).toBeNull();
    expect(getUnsupportedReason({ Variant: "Chess960" })).toMatch(/Chess960/);
    expect(
      getUnsupportedReason({ SetUp: "1", FEN: "4k3/8/8/8/8/8/8/4K2R w K - 0 1" })
    ).toMatch(/custom starting position/);
    expect(
      getUnsupportedReason({
        SetUp: "1",
        FEN: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
      })
    ).toBeNull();
  });
});

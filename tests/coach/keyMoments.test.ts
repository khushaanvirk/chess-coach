import { describe, expect, it } from "vitest";
import { MoveClassification as C } from "@/types/enums";
import { selectKeyMoments, userWinChance } from "@/lib/coach/keyMoments";
import { pe, sideFens } from "./helpers";

describe("userWinChance", () => {
  it("flips White's win chance for a Black user", () => {
    const position = pe(300);
    const white = userWinChance(position, "w") ?? NaN;
    expect(white).toBeGreaterThan(70);
    expect(userWinChance(position, "b")).toBeCloseTo(100 - white);
  });

  it("returns undefined for an unscored line instead of throwing", () => {
    expect(userWinChance({ lines: [{ pv: [], depth: 1, multiPv: 1 }] }, "w")).toBeUndefined();
    expect(userWinChance({ lines: [] }, "w")).toBeUndefined();
  });
});

describe("selectKeyMoments", () => {
  it("reads the label for ply i from positions[i + 1] and only keeps the user's moves", () => {
    // ply 0 White, ply 1 Black blunders, ply 2 White blunders.
    const positions = [pe(20), pe(20), pe(400, C.Blunder), pe(-400, C.Blunder)];
    const moments = selectKeyMoments({ positions, fens: sideFens(4), userSide: "w" });

    expect(moments.map((m) => [m.ply, m.label])).toEqual([[2, "blunder"]]);
    expect(moments[0].winBefore).toBeGreaterThan(moments[0].winAfter);
  });

  it("finds the same moment from Black's side", () => {
    const positions = [pe(20), pe(20), pe(400, C.Blunder), pe(-400, C.Blunder)];
    const moments = selectKeyMoments({ positions, fens: sideFens(4), userSide: "b" });

    expect(moments.map((m) => [m.ply, m.label])).toEqual([[1, "blunder"]]);
    expect(moments[0].winBefore).toBeGreaterThan(moments[0].winAfter);
  });

  it("labels a miss when the opponent erred and the reply gave it back", () => {
    // ply 1: Black blunders (White jumps from 50% to ~80%).
    // ply 2: White replies with an inaccuracy-sized move that returns most of it.
    const positions = [pe(0), pe(0), pe(400, C.Blunder), pe(20, C.Mistake)];
    const moments = selectKeyMoments({ positions, fens: sideFens(4), userSide: "w" });

    expect(moments.map((m) => m.label)).toEqual(["miss"]);
  });

  it("still calls it a blunder when the missed chance was also a blunder", () => {
    const positions = [pe(0), pe(0), pe(400, C.Blunder), pe(-600, C.Blunder)];
    const moments = selectKeyMoments({ positions, fens: sideFens(4), userSide: "w" });
    expect(moments.map((m) => m.label)).toEqual(["blunder"]);
  });

  it("maps splendid and perfect to brilliant and great", () => {
    const positions = [pe(0), pe(50, C.Splendid), pe(50), pe(120, C.Perfect)];
    const moments = selectKeyMoments({ positions, fens: sideFens(4), userSide: "w" });
    expect(moments.map((m) => m.label)).toEqual(["brilliant", "great"]);
  });

  it("keeps only the three worst inaccuracies", () => {
    const positions = [pe(0)];
    const drops = [60, 90, 70, 110, 80];
    for (const drop of drops) {
      positions.push(pe(-drop, C.Inaccuracy)); // after White's move
      positions.push(pe(0)); // after Black's reply
    }
    const moments = selectKeyMoments({
      positions,
      fens: sideFens(positions.length),
      userSide: "w",
    });

    expect(moments).toHaveLength(3);
    expect(moments.every((m) => m.label === "inaccuracy")).toBe(true);
    // The 110, 90 and 80 centipawn drops, returned in game order.
    expect(moments.map((m) => m.ply)).toEqual([2, 6, 8]);
  });

  it("caps the total and prefers blunders over lighter moments", () => {
    const positions = [pe(0)];
    for (let i = 0; i < 10; i++) {
      positions.push(pe(-500, C.Blunder));
      positions.push(pe(0));
    }
    for (let i = 0; i < 4; i++) {
      positions.push(pe(50, C.Perfect));
      positions.push(pe(0));
    }
    const moments = selectKeyMoments({
      positions,
      fens: sideFens(positions.length),
      userSide: "w",
      maxMoments: 12,
    });

    expect(moments).toHaveLength(12);
    expect(moments.filter((m) => m.label === "blunder")).toHaveLength(10);
    expect(moments.filter((m) => m.label === "great")).toHaveLength(2);
  });

  it("skips moves whose evals have no score", () => {
    const broken = { lines: [{ pv: ["a2a3"], depth: 1, multiPv: 1 }] };
    const positions = [broken, pe(-500, C.Blunder)];
    expect(selectKeyMoments({ positions, fens: sideFens(2), userSide: "w" })).toEqual([]);
  });

  it("ignores moves the evaluation does not cover", () => {
    const moments = selectKeyMoments({ positions: [pe(0)], fens: sideFens(3), userSide: "w" });
    expect(moments).toEqual([]);
  });
});

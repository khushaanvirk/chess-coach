import { MoveClassification as C, EngineName } from "@/types/enums";
import type { GameEval, PositionEval } from "@/types/eval";
import { pe } from "./helpers";

/** Blackburne Shilling trap, chess.com-style headers, White ("khushaan_test") falls for it. */
export const TRAP_PGN = `[Event "Live Chess"]
[Site "Chess.com"]
[Date "2026.09.20"]
[Round "-"]
[White "khushaan_test"]
[Black "TrapSetter"]
[Result "0-1"]
[WhiteElo "812"]
[BlackElo "845"]
[TimeControl "600"]
[Termination "TrapSetter won by checkmate"]
[ECO "C50"]
[ECOUrl "https://www.chess.com/openings/Italian-Game-Blackburne-Shilling-Gambit"]
[UTCDate "2026.09.20"]
[Link "https://www.chess.com/game/live/123456789"]

1. e4 {[%clk 0:09:58]} 1... e5 {[%clk 0:09:57]} 2. Nf3 {[%clk 0:09:55]} 2... Nc6 {[%clk 0:09:54]} 3. Bc4 {[%clk 0:09:50]} 3... Nd4 {[%clk 0:09:49]} 4. Nxe5 {[%clk 0:09:31.4]} 4... Qg5 {[%clk 0:09:40]} 5. Nxf7 {[%clk 0:09:02]} 5... Qxg2 {[%clk 0:09:35]} 6. Rf1 {[%clk 0:08:40]} 6... Qxe4+ {[%clk 0:09:30]} 7. Be2 {[%clk 0:08:20]} 7... Nf3# {[%clk 0:09:28]} 0-1`;

const withOpening = (position: PositionEval, opening: string): PositionEval => ({
  ...position,
  opening,
});

/** Hand-written White-POV evals for TRAP_PGN; label of ply i sits on positions[i + 1]. */
export const trapEval = (): GameEval => {
  const positions: PositionEval[] = [
    pe(30, undefined, ["e2e4"]),
    withOpening(pe(30, C.Opening, ["e7e5"]), "King's Pawn Game"),
    withOpening(pe(30, C.Opening, ["g1f3"]), "King's Pawn Game"),
    withOpening(pe(30, C.Opening, ["b8c6"]), "King's Knight Opening"),
    withOpening(pe(30, C.Opening, ["f1c4"]), "Italian Game"),
    withOpening(pe(30, C.Opening, ["f8c5"]), "Italian Game"),
    withOpening(pe(80, C.Okay, ["f3d4", "e5d4", "e1g1"]), "Italian Game: Blackburne Shilling Gambit"),
    pe(-150, C.Blunder, ["d8g5", "e5f7", "g5g2", "h1f1", "g2e4", "c4e2", "d4f3"]),
    pe(-150, C.Best, ["c4f7", "e8d8", "e1g1"]),
    pe(-600, C.Blunder, ["g5g2", "h1f1", "g2e4", "c4e2", "d4f3"]),
    pe(-700, C.Best, ["h1f1", "g2e4", "c4e2", "d4f3"]),
    pe({ mate: -2 }, C.Best, ["g2e4", "c4e2", "d4f3"]),
    pe(-900, C.Best, ["d1e2", "e4e2", "c4e2"]),
    pe({ mate: -1 }, C.Okay, ["d4f3"]),
    { lines: [{ pv: [], depth: 0, multiPv: 1, mate: 0 }], moveClassification: C.Best },
  ];

  return {
    positions,
    accuracy: { white: 41.2, black: 88.9 },
    estimatedElo: { white: 700, black: 1100 },
    settings: {
      engine: EngineName.Stockfish18Lite,
      depth: 16,
      multiPv: 3,
      date: "2026-09-25T10:00:00.000Z",
    },
  };
};

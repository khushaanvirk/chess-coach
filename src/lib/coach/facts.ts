import { Chess, type PieceSymbol, type Square } from "chess.js";
import { getMaterialDifference, uciMoveParams } from "@/lib/chess";
import type { GamePhase, MotifTag, Side } from "./types";

// Plain-language chess facts computed by code, so Claude narrates tactics that
// are really on the board instead of inventing them.

export const MAX_LINE_PLIES = 8;
const OPENING_LAST_MOVE = 10;
const ENDGAME_MAX_PIECE_MATERIAL = 20;
const MATERIAL_SWING_WORTH_MENTIONING = 2;
const MAX_OPPONENT_MOVES_TO_SCAN = 3;

const PIECE_VALUES: Record<PieceSymbol, number> = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
  k: 0,
};

const PIECE_NAMES: Record<PieceSymbol, string> = {
  p: "pawn",
  n: "knight",
  b: "bishop",
  r: "rook",
  q: "queen",
  k: "king",
};

export interface MomentFactsInput {
  fenBefore: string;
  playedUci: string;
  /** Engine's best line from fenBefore (UCI), starting with the user's move. */
  bestPv: string[];
  /** Engine's line after the played move (UCI), starting with the opponent's reply. */
  refutationPv: string[];
  userSide: Side;
  /** Mate distance from the user's side before the move: >0 the user mates. */
  bestLineMateForUser?: number;
  /** Mate distance from the user's side after the move: <0 the opponent mates. */
  playedLineMateForUser?: number;
}

export interface MomentFacts {
  playedSan: string;
  bestSan: string | null;
  bestLine: string[];
  refutationLine: string[];
  materialAfterBestLine: number;
  materialAfterPlayedLine: number;
  tags: MotifTag[];
  hints: string[];
}

export const lineToSan = (
  fen: string,
  pv: string[],
  maxPlies: number = MAX_LINE_PLIES
): string[] => {
  const game = new Chess(fen);
  const sans: string[] = [];

  for (const uci of pv.slice(0, maxPlies)) {
    try {
      sans.push(game.move(uciMoveParams(uci)).san);
    } catch {
      break;
    }
  }

  return sans;
};

const playLine = (fen: string, pv: string[]): Chess => {
  const game = new Chess(fen);
  for (const uci of pv.slice(0, MAX_LINE_PLIES)) {
    try {
      game.move(uciMoveParams(uci));
    } catch {
      break;
    }
  }
  return game;
};

const userMaterial = (fen: string, side: Side): number =>
  getMaterialDifference(fen) * (side === "w" ? 1 : -1);

const materialSwing = (fen: string, pv: string[], side: Side): number =>
  userMaterial(playLine(fen, pv).fen(), side) - userMaterial(fen, side);

interface Target {
  square: Square;
  type: PieceSymbol;
}

const describeTargets = (targets: Target[]): string => {
  const parts = targets.map((t) => `${PIECE_NAMES[t.type]} on ${t.square}`);
  return parts.length <= 2
    ? parts.join(" and ")
    : `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}`;
};

/**
 * Pieces of the side not making the move that the moved piece attacks after
 * `uci`, if it hits two or more of them (king or pieces worth 3+).
 */
export const getForkTargets = (fen: string, uci: string | undefined): Target[] => {
  if (!uci) return [];

  const game = new Chess(fen);
  let to: Square;
  try {
    to = game.move(uciMoveParams(uci)).to;
  } catch {
    return [];
  }

  const victimColor = game.turn();
  const attackerColor = victimColor === "w" ? "b" : "w";
  const targets: Target[] = [];

  for (const row of game.board()) {
    for (const cell of row) {
      if (!cell || cell.color !== victimColor) continue;
      const isValuable = cell.type === "k" || PIECE_VALUES[cell.type] >= 3;
      if (!isValuable) continue;
      if (game.attackers(cell.square, attackerColor).includes(to)) {
        targets.push({ square: cell.square, type: cell.type });
      }
    }
  }

  if (targets.length < 2) return [];

  return [...targets].sort((a, b) => {
    if (a.type === "k") return -1;
    if (b.type === "k") return 1;
    return PIECE_VALUES[b.type] - PIECE_VALUES[a.type];
  });
};

/**
 * A user piece worth 3+ that the engine's reply line actually captures, and
 * that was loose after the played move (undefended, or attacked by a cheaper piece).
 */
const findHangingPiece = (
  fenAfter: string,
  refutationPv: string[],
  userSide: Side
): { target: Target; undefended: boolean; attacker: PieceSymbol } | null => {
  const board = new Chess(fenAfter);
  const game = new Chess(fenAfter);
  const opponent = userSide === "w" ? "b" : "w";

  const pv = refutationPv.slice(0, MAX_OPPONENT_MOVES_TO_SCAN * 2);
  for (let i = 0; i < pv.length; i++) {
    let move;
    try {
      move = game.move(uciMoveParams(pv[i]));
    } catch {
      return null;
    }
    const isOpponentMove = i % 2 === 0;
    if (!isOpponentMove || !move.captured) continue;

    const original = board.get(move.to);
    if (
      !original ||
      original.color !== userSide ||
      original.type !== move.captured ||
      PIECE_VALUES[original.type] < 3
    ) {
      continue;
    }

    const attackers = board.attackers(move.to, opponent);
    if (!attackers.length) continue;
    const defenders = board.attackers(move.to, userSide);
    const cheapest = attackers
      .map((sq) => board.get(sq)?.type)
      .filter((t): t is PieceSymbol => !!t)
      .sort((a, b) => PIECE_VALUES[a] - PIECE_VALUES[b])[0];

    const undefended = defenders.length === 0;
    const cheaperAttacker = PIECE_VALUES[cheapest] < PIECE_VALUES[original.type];
    if (undefended || cheaperAttacker) {
      return {
        target: { square: move.to, type: original.type },
        undefended,
        attacker: cheapest,
      };
    }
  }

  return null;
};

export const computeMomentFacts = (input: MomentFactsInput): MomentFacts => {
  const { fenBefore, playedUci, bestPv, refutationPv, userSide } = input;
  const tags: MotifTag[] = [];
  const hints: string[] = [];

  const playedSan = lineToSan(fenBefore, [playedUci], 1)[0] ?? playedUci;
  const playedWasBest = bestPv[0] === playedUci;
  const bestLine = lineToSan(fenBefore, bestPv);
  const bestSan = playedWasBest ? null : (bestLine[0] ?? null);

  const fenAfter = playLine(fenBefore, [playedUci]).fen();
  const refutationLine = lineToSan(fenAfter, refutationPv);

  const materialAfterBestLine = materialSwing(fenBefore, bestPv, userSide);
  const materialAfterPlayedLine = materialSwing(
    fenBefore,
    [playedUci, ...refutationPv],
    userSide
  );

  const reply = refutationLine[0];
  if (reply?.includes("+") || reply?.includes("#")) tags.push("refutation_check");
  if (reply?.includes("x")) tags.push("refutation_capture");

  const forkTargets = getForkTargets(fenAfter, refutationPv[0]);
  if (forkTargets.length && reply) {
    tags.push("fork");
    hints.push(`The engine's reply ${reply} forks your ${describeTargets(forkTargets)}.`);
  }

  const hanging = findHangingPiece(fenAfter, refutationPv, userSide);
  if (hanging) {
    tags.push("hangs_piece");
    const piece = `${PIECE_NAMES[hanging.target.type]} on ${hanging.target.square}`;
    hints.push(
      hanging.undefended
        ? `After ${playedSan}, your ${piece} was left undefended and the engine line takes it.`
        : `After ${playedSan}, your ${piece} could be won by a cheaper ${PIECE_NAMES[hanging.attacker]}.`
    );
  }

  if (bestSan) {
    const missedFork = getForkTargets(fenBefore, bestPv[0]);
    if (missedFork.length) {
      tags.push("missed_fork");
      hints.push(`The best move ${bestSan} would have forked the ${describeTargets(missedFork)}.`);
    }

    const gainMissed = materialAfterBestLine - materialAfterPlayedLine;
    if (
      materialAfterBestLine >= MATERIAL_SWING_WORTH_MENTIONING &&
      gainMissed >= MATERIAL_SWING_WORTH_MENTIONING
    ) {
      tags.push("missed_material");
      hints.push(
        `The best line wins about ${materialAfterBestLine} points of material (pawn = 1).`
      );
    }
  }

  const mateBefore = input.bestLineMateForUser;
  const mateAfter = input.playedLineMateForUser;
  if (bestSan && mateBefore !== undefined && mateBefore > 0 && !(mateAfter !== undefined && mateAfter > 0)) {
    tags.push("missed_mate");
    hints.push(`You had a forced mate in ${mateBefore} starting with ${bestSan}.`);
  }
  if (mateAfter !== undefined && mateAfter < 0) {
    tags.push("allows_mate");
    hints.push(`After ${playedSan}, the opponent has a forced mate in ${Math.abs(mateAfter)}.`);
  }

  return {
    playedSan,
    bestSan,
    bestLine,
    refutationLine,
    materialAfterBestLine,
    materialAfterPlayedLine,
    tags,
    hints,
  };
};

export const getGamePhase = (fen: string): GamePhase => {
  const fullMove = Number(fen.split(" ")[5] ?? "1");
  if (fullMove <= OPENING_LAST_MOVE) return "opening";

  const pieceMaterial = new Chess(fen)
    .board()
    .flat()
    .reduce(
      (sum, cell) => (cell && cell.type !== "p" ? sum + PIECE_VALUES[cell.type] : sum),
      0
    );

  return pieceMaterial <= ENDGAME_MAX_PIECE_MATERIAL ? "endgame" : "middlegame";
};

const CLOCK_PATTERN = /\[%clk\s+(\d+):(\d{1,2}):(\d{1,2}(?:\.\d+)?)\]/;

export const parseClockSeconds = (comment: string | undefined): number | undefined => {
  const match = comment?.match(CLOCK_PATTERN);
  if (!match) return undefined;
  const [, h, m, s] = match;
  return Number(h) * 3600 + Number(m) * 60 + Number(s);
};

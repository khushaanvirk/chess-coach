import type { Chess } from "chess.js";
import { getEvaluateGameParams, getLineEvalLabel } from "@/lib/chess";
import type { GameEval, LineEval } from "@/types/eval";
import { computeMomentFacts, getGamePhase, parseClockSeconds } from "./facts";
import { DEFAULT_MAX_MOMENTS, selectKeyMoments } from "./keyMoments";
import type { KeyMoment, PacketMoment, ReviewPacket, Side } from "./types";

export interface BuildPacketInput {
  game: Chess;
  gameEval: GameEval;
  userSide: Side;
  maxMoments?: number;
}

const round1 = (n: number): number => Math.round(n * 10) / 10;

const toNumber = (value: string | undefined): number | undefined => {
  const n = Number(value);
  return value && Number.isFinite(n) ? n : undefined;
};

/** Engine eval of a line from the user's side, e.g. "+1.20" or "-M3". */
export const formatUserEval = (
  line: Pick<LineEval, "cp" | "mate"> | undefined,
  side: Side
): string => {
  if (!line) return "?";
  const sign = side === "w" ? 1 : -1;
  return getLineEvalLabel({
    cp: line.cp === undefined ? undefined : line.cp * sign,
    mate: line.mate === undefined ? undefined : line.mate * sign,
  });
};

const userMate = (line: LineEval | undefined, side: Side): number | undefined =>
  line?.mate === undefined ? undefined : line.mate * (side === "w" ? 1 : -1);

const moveNumberLabel = (fen: string): string => {
  const [, turn, , , , fullMove] = fen.split(" ");
  return `${fullMove}${turn === "w" ? "." : "..."}`;
};

const buildMovetext = (fens: string[], sans: string[]): string =>
  sans
    .map((san, ply) => {
      const [, turn, , , , fullMove] = fens[ply].split(" ");
      if (turn === "w") return `${fullMove}. ${san}`;
      return ply === 0 ? `${fullMove}... ${san}` : san;
    })
    .join(" ");

const openingFromEcoUrl = (url: string | undefined): string | undefined => {
  const slug = url?.split("/openings/")[1];
  return slug ? decodeURIComponent(slug).replace(/-/g, " ") : undefined;
};

const clockByFen = (game: Chess): Map<string, number> => {
  const clocks = new Map<string, number>();
  for (const { fen, comment } of game.getComments()) {
    const seconds = parseClockSeconds(comment);
    if (seconds !== undefined) clocks.set(fen, seconds);
  }
  return clocks;
};

/**
 * Turns a Stockfish-analysed game into the facts Claude is allowed to see:
 * key moments with engine lines in SAN, plus code-computed tactical hints.
 */
export const buildReviewPacket = ({
  game,
  gameEval,
  userSide,
  maxMoments = DEFAULT_MAX_MOMENTS,
}: BuildPacketInput): ReviewPacket => {
  const { fens, uciMoves } = getEvaluateGameParams(game);
  const { positions } = gameEval;
  if (positions.length !== fens.length) {
    throw new Error("The engine evaluation doesn't match this game. Analyze it again.");
  }

  const headers: Record<string, string | undefined> = game.getHeaders();
  const sans = game.history();
  const clocks = clockByFen(game);

  const toPacketMoment = (moment: KeyMoment): PacketMoment => {
    const { ply } = moment;
    const before = positions[ply].lines[0];
    const after = positions[ply + 1].lines[0];
    const facts = computeMomentFacts({
      fenBefore: fens[ply],
      playedUci: uciMoves[ply],
      bestPv: before?.pv ?? [],
      refutationPv: after?.pv ?? [],
      userSide,
      bestLineMateForUser: userMate(before, userSide),
      playedLineMateForUser: userMate(after, userSide),
    });

    return {
      ply,
      moveNumber: moveNumberLabel(fens[ply]),
      label: moment.label,
      playedMove: facts.playedSan,
      bestMove: facts.bestSan,
      winChanceBefore: round1(moment.winBefore),
      winChanceAfter: round1(moment.winAfter),
      evalBefore: formatUserEval(before, userSide),
      evalAfter: formatUserEval(after, userSide),
      bestLine: facts.bestLine,
      refutationLine: facts.refutationLine,
      materialAfterBestLine: facts.materialAfterBestLine,
      materialAfterPlayedLine: facts.materialAfterPlayedLine,
      tags: facts.tags,
      hints: facts.hints,
      phase: getGamePhase(fens[ply]),
      clockSeconds: clocks.get(fens[ply + 1]),
    };
  };

  const moments = selectKeyMoments({ positions, fens, userSide, maxMoments }).map(
    toPacketMoment
  );

  const opening =
    [...positions].reverse().find((p) => p.opening)?.opening ??
    openingFromEcoUrl(headers.ECOUrl);
  const isWhite = userSide === "w";

  return {
    game: {
      white: { name: headers.White ?? "White", rating: toNumber(headers.WhiteElo) },
      black: { name: headers.Black ?? "Black", rating: toNumber(headers.BlackElo) },
      userSide: isWhite ? "white" : "black",
      result: headers.Result,
      termination: headers.Termination,
      timeControl: headers.TimeControl,
      date: headers.UTCDate ?? headers.Date,
      opening,
      accuracy: {
        user: round1(isWhite ? gameEval.accuracy.white : gameEval.accuracy.black),
        opponent: round1(isWhite ? gameEval.accuracy.black : gameEval.accuracy.white),
      },
      engine: { name: gameEval.settings.engine, depth: gameEval.settings.depth },
      moveCount: sans.length,
    },
    moves: buildMovetext(fens, sans),
    moments,
  };
};

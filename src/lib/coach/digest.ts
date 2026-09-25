import type {
  GameDigest,
  GameOutcome,
  MomentLabel,
  ReviewPacket,
  Side,
  TimeClass,
} from "./types";
import type { ValidatedReview } from "./validate";

// Lichess-style estimated duration: base seconds + 40 moves of increment.
const INCREMENT_MOVES = 40;
const BULLET_MAX_SECONDS = 179;
const BLITZ_MAX_SECONDS = 479;
const RAPID_MAX_SECONDS = 1499;

export const getOutcome = (result: string | undefined, side: Side): GameOutcome => {
  if (result === "1/2-1/2") return "draw";
  if (result === "1-0") return side === "w" ? "win" : "loss";
  if (result === "0-1") return side === "b" ? "win" : "loss";
  return "unknown";
};

export const getTimeClass = (timeControl: string | undefined): TimeClass => {
  if (!timeControl) return "unknown";
  if (timeControl.includes("/")) return "daily";

  const [base, increment = "0"] = timeControl.split("+");
  const seconds = Number(base) + INCREMENT_MOVES * Number(increment);
  if (!Number.isFinite(seconds) || seconds <= 0) return "unknown";
  if (seconds <= BULLET_MAX_SECONDS) return "bullet";
  if (seconds <= BLITZ_MAX_SECONDS) return "blitz";
  if (seconds <= RAPID_MAX_SECONDS) return "rapid";
  return "classical";
};

const EMPTY_COUNTS: Record<MomentLabel, number> = {
  blunder: 0,
  miss: 0,
  mistake: 0,
  inaccuracy: 0,
  brilliant: 0,
  great: 0,
};

export interface BuildDigestInput {
  gameKey: string;
  gameId?: number;
  packet: ReviewPacket;
  review: ValidatedReview;
  reviewedAt: string;
}

/** A self-contained record of one reviewed game, the input to cross-game trends. */
export const buildDigest = ({
  gameKey,
  gameId,
  packet,
  review,
  reviewedAt,
}: BuildDigestInput): GameDigest => {
  const { game } = packet;
  const userSide: Side = game.userSide === "white" ? "w" : "b";
  const user = userSide === "w" ? game.white : game.black;
  const opponent = userSide === "w" ? game.black : game.white;
  const words = new Map(review.moments.map((m) => [m.ply, m]));

  const counts = packet.moments.reduce(
    (acc, m) => ({ ...acc, [m.label]: acc[m.label] + 1 }),
    EMPTY_COUNTS
  );

  return {
    gameKey,
    gameId,
    date: game.date,
    userName: user.name,
    userSide,
    opponentName: opponent.name,
    userRating: user.rating,
    opponentRating: opponent.rating,
    outcome: getOutcome(game.result, userSide),
    termination: game.termination,
    timeControl: game.timeControl,
    timeClass: getTimeClass(game.timeControl),
    opening: game.opening,
    accuracy: game.accuracy,
    counts,
    moments: packet.moments.map((m) => ({
      ply: m.ply,
      moveNumber: m.moveNumber,
      label: m.label,
      phase: m.phase,
      tags: m.tags,
      title: words.get(m.ply)?.title ?? "",
      lesson: words.get(m.ply)?.lesson ?? "",
      clockSeconds: m.clockSeconds,
    })),
    reviewedAt,
  };
};

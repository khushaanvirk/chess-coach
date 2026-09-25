import { GOOD_MOVE_MARGIN } from "./packet";
import type { CoachReview, MomentLabel, ReviewedMoment, Side } from "./types";

// "Retry your mistakes": replay the position before each error and see if the
// user now finds a move the engine is happy with.

const DRILL_LABELS: ReadonlySet<MomentLabel> = new Set([
  "blunder",
  "mistake",
  "miss",
]);
export const DEFAULT_MAX_DRILLS = 20;

export type AttemptVerdict = "best" | "good" | "played" | "needs-engine";
export type EngineVerdict = "good" | "wrong";

export interface Drill {
  id: string;
  gameKey: string;
  userSide: Side;
  moment: ReviewedMoment;
}

const normalize = (san: string): string => san.replace(/[+#!?]/g, "");

export const judgeAttempt = (
  moment: ReviewedMoment,
  attemptSan: string
): AttemptVerdict => {
  const attempt = normalize(attemptSan);
  if (moment.bestMove && normalize(moment.bestMove) === attempt) return "best";
  if (moment.goodMoves.some((san) => normalize(san) === attempt)) return "good";
  if (normalize(moment.playedMove) === attempt) return "played";
  return "needs-engine";
};

/** For a move outside the stored engine lines: good if it keeps you near best play. */
export const judgeByEngine = (
  winChanceBest: number,
  winChanceAfterAttempt: number
): EngineVerdict =>
  winChanceBest - winChanceAfterAttempt <= GOOD_MOVE_MARGIN ? "good" : "wrong";

/** Mistakes worth replaying, newest review first, game order within a review. */
export const selectDrills = (
  reviews: CoachReview[],
  maxDrills: number = DEFAULT_MAX_DRILLS
): Drill[] =>
  [...reviews]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .flatMap((review) =>
      [...review.moments]
        .sort((a, b) => a.ply - b.ply)
        .filter((m) => DRILL_LABELS.has(m.label) && m.bestMove && m.fen)
        .map((moment) => ({
          id: `${review.gameKey}#${moment.ply}`,
          gameKey: review.gameKey,
          userSide: review.userSide,
          moment,
        }))
    )
    .slice(0, maxDrills);

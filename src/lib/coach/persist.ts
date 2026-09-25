import type { GameEval } from "@/types/eval";
import { reviewId, saveDigest, saveReview } from "./db";
import { buildDigest } from "./digest";
import { PROMPT_VERSION } from "./prompts";
import type { ReviewRunResult } from "./server/review";
import type { CoachReview, ReviewPacket, Side } from "./types";

export interface PersistReviewInput {
  gameKey: string;
  gameId?: number;
  userSide: Side;
  gameEval: GameEval;
  packet: ReviewPacket;
  result: ReviewRunResult;
}

/** Stores a fresh review and its trends digest in the coach database. */
export const persistReview = async ({
  gameKey,
  gameId,
  userSide,
  gameEval,
  packet,
  result,
}: PersistReviewInput): Promise<CoachReview> => {
  const now = new Date().toISOString();
  const review: CoachReview = {
    id: reviewId(gameKey, result.model),
    gameKey,
    model: result.model,
    promptVersion: PROMPT_VERSION,
    createdAt: now,
    userSide,
    engine: {
      name: gameEval.settings.engine,
      depth: gameEval.settings.depth,
      date: gameEval.settings.date,
    },
    summary: result.review.summary,
    takeaways: result.review.takeaways,
    moments: result.review.moments,
    costUsd: result.costUsd,
  };

  await saveReview(review);
  await saveDigest(
    buildDigest({
      gameKey,
      gameId,
      packet,
      review: result.review,
      reviewedAt: now,
    })
  );
  return review;
};

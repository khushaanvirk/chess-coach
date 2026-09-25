import type { CoachModel } from "../models";
import {
  COACH_SYSTEM_PROMPT,
  REVIEW_JSON_SCHEMA,
  TRENDS_JSON_SCHEMA,
  TRENDS_SYSTEM_PROMPT,
  buildReviewPrompt,
  buildTrendsPrompt,
} from "../prompts";
import type { GameDigest, ReviewPacket } from "../types";
import {
  InvalidCoachOutputError,
  validateReviewOutput,
  validateTrendsOutput,
  type ValidatedReview,
  type ValidatedTrends,
} from "../validate";
import { CoachRunError, runStructured } from "./claude";

export const REVIEW_BUDGET_USD = 0.5;
export const TRENDS_BUDGET_USD = 1.5;

interface RunOptions {
  model: CoachModel;
  maxBudgetUsd?: number;
  signal?: AbortSignal;
}

export interface ReviewRunResult {
  review: ValidatedReview;
  costUsd: number;
  model: CoachModel;
}

export interface TrendsRunResult {
  trends: ValidatedTrends;
  costUsd: number;
  model: CoachModel;
}

const asCoachError = (error: unknown): never => {
  if (error instanceof InvalidCoachOutputError) {
    throw new CoachRunError("invalid_output", error.message);
  }
  throw error;
};

export const runReview = async (
  packet: ReviewPacket,
  gameSans: string[],
  { model, maxBudgetUsd = REVIEW_BUDGET_USD, signal }: RunOptions
): Promise<ReviewRunResult> => {
  const result = await runStructured({
    systemPrompt: COACH_SYSTEM_PROMPT,
    prompt: buildReviewPrompt(packet),
    jsonSchema: REVIEW_JSON_SCHEMA,
    model,
    maxBudgetUsd,
    signal,
  });

  try {
    return {
      review: validateReviewOutput(result.output, packet, gameSans),
      costUsd: result.costUsd,
      model,
    };
  } catch (error) {
    return asCoachError(error);
  }
};

export const runTrends = async (
  digests: GameDigest[],
  { model, maxBudgetUsd = TRENDS_BUDGET_USD, signal }: RunOptions
): Promise<TrendsRunResult> => {
  const result = await runStructured({
    systemPrompt: TRENDS_SYSTEM_PROMPT,
    prompt: buildTrendsPrompt(digests),
    jsonSchema: TRENDS_JSON_SCHEMA,
    model,
    maxBudgetUsd,
    signal,
  });

  try {
    return {
      trends: validateTrendsOutput(result.output, digests),
      costUsd: result.costUsd,
      model,
    };
  } catch (error) {
    return asCoachError(error);
  }
};

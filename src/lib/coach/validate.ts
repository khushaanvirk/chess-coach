import { z } from "zod";
import type {
  GameDigest,
  PacketMoment,
  ReviewPacket,
  ReviewedMoment,
  TrendPattern,
  TrendsReport,
} from "./types";

// Claude's output is untrusted: check its shape, pin it to the packet's key
// moments, and flag any move it mentions that the engine data doesn't contain.

export class InvalidCoachOutputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidCoachOutputError";
  }
}

const MAX_TAKEAWAYS = 3;
const MAX_STRENGTHS = 3;
const MAX_FOCUS_AREAS = 3;

const reviewOutputSchema = z.object({
  summary: z.string().min(1),
  takeaways: z.array(z.string()),
  moments: z.array(
    z.object({
      ply: z.number().int(),
      title: z.string(),
      explanation: z.string(),
      lesson: z.string(),
    })
  ),
});

const trendsOutputSchema = z.object({
  headline: z.string().min(1),
  patterns: z.array(
    z.object({
      name: z.string(),
      description: z.string(),
      evidence: z.array(
        z.object({ gameKey: z.string(), ply: z.number().int() })
      ),
    })
  ),
  strengths: z.array(z.string()),
  focusAreas: z.array(
    z.object({ what: z.string(), howToPractice: z.string() })
  ),
});

const parseOrThrow = <T>(
  schema: z.ZodType<T>,
  raw: unknown,
  what: string
): T => {
  const result = schema.safeParse(raw);
  if (!result.success) {
    throw new InvalidCoachOutputError(
      `Claude's ${what} didn't match the expected format.`
    );
  }
  return result.data;
};

// Moves that can't be confused with a bare square: piece moves, captures,
// castling and promotions. "the pawn on e4" is deliberately not a mention.
const MOVE_MENTION =
  /(?<![A-Za-z0-9])(O-O-O|O-O|0-0-0|0-0|[KQRBN][a-h]?[1-8]?x?[a-h][1-8]|[a-h]x[a-h][1-8](?:=[QRBN])?|[a-h][18]=[QRBN])[+#]?(?![A-Za-z0-9])/g;

const normalizeMove = (san: string): string =>
  san
    .replace(/[+#!?]/g, "")
    .replace(/^0-0-0$/, "O-O-O")
    .replace(/^0-0$/, "O-O");

export const extractMoveMentions = (text: string): string[] =>
  Array.from(text.matchAll(MOVE_MENTION), (match) => normalizeMove(match[1]));

const allowedMoves = (moment: PacketMoment, gameSans: string[]): Set<string> =>
  new Set(
    [
      moment.playedMove,
      moment.bestMove ?? "",
      ...moment.goodMoves,
      ...moment.bestLine,
      ...moment.refutationLine,
      ...gameSans,
    ]
      .filter(Boolean)
      .map(normalizeMove)
  );

const LABEL_TITLES: Record<PacketMoment["label"], string> = {
  blunder: "Blunder",
  miss: "Missed chance",
  mistake: "Mistake",
  inaccuracy: "Inaccuracy",
  brilliant: "Brilliant move",
  great: "Great move",
};

/** Factual stand-in, built only from engine data, when Claude skipped a moment. */
const fallbackMoment = (
  moment: PacketMoment
): Pick<ReviewedMoment, "title" | "explanation" | "lesson"> => {
  const title = `${LABEL_TITLES[moment.label]}: ${moment.moveNumber}${moment.playedMove}`;
  if (!moment.bestMove) {
    return {
      title,
      explanation: `${moment.playedMove} was the engine's top choice here.`,
      lesson: "",
    };
  }
  const line =
    moment.bestLine.length > 1 ? ` (${moment.bestLine.join(" ")})` : "";
  return {
    title,
    explanation: `${moment.playedMove} took your winning chances from ${moment.winChanceBefore}% to ${moment.winChanceAfter}%. The engine preferred ${moment.bestMove}${line}.`,
    lesson: "",
  };
};

export interface ValidatedReview {
  summary: string;
  takeaways: string[];
  moments: ReviewedMoment[];
}

export const validateReviewOutput = (
  raw: unknown,
  packet: ReviewPacket,
  gameSans: string[]
): ValidatedReview => {
  const output = parseOrThrow(reviewOutputSchema, raw, "review");
  const byPly = new Map(output.moments.map((m) => [m.ply, m]));

  const moments = packet.moments.map((moment): ReviewedMoment => {
    const written = byPly.get(moment.ply);
    const text = written ?? fallbackMoment(moment);
    const allowed = allowedMoves(moment, gameSans);
    const unverifiedMoves = written
      ? Array.from(
          new Set(
            extractMoveMentions(
              `${text.title} ${text.explanation} ${text.lesson}`
            ).filter((move) => !allowed.has(move))
          )
        )
      : [];

    return {
      ply: moment.ply,
      moveNumber: moment.moveNumber,
      label: moment.label,
      fen: moment.fen,
      playedMove: moment.playedMove,
      bestMove: moment.bestMove,
      goodMoves: moment.goodMoves,
      winChanceBefore: moment.winChanceBefore,
      title: text.title.trim(),
      explanation: text.explanation.trim(),
      lesson: text.lesson.trim(),
      unverified: unverifiedMoves.length > 0,
      unverifiedMoves,
    };
  });

  return {
    summary: output.summary.trim(),
    takeaways: output.takeaways
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, MAX_TAKEAWAYS),
    moments,
  };
};

export type ValidatedTrends = Pick<
  TrendsReport,
  "headline" | "patterns" | "strengths" | "focusAreas"
>;

export const validateTrendsOutput = (
  raw: unknown,
  digests: GameDigest[]
): ValidatedTrends => {
  const output = parseOrThrow(trendsOutputSchema, raw, "trends report");
  const known = new Map(
    digests.map((d) => [d.gameKey, new Set(d.moments.map((m) => m.ply))])
  );

  const patterns: TrendPattern[] = output.patterns
    .map((pattern) => ({
      ...pattern,
      evidence: pattern.evidence.filter((e) =>
        known.get(e.gameKey)?.has(e.ply)
      ),
    }))
    .filter((pattern) => pattern.evidence.length > 0);

  return {
    headline: output.headline.trim(),
    patterns,
    strengths: output.strengths.slice(0, MAX_STRENGTHS),
    focusAreas: output.focusAreas.slice(0, MAX_FOCUS_AREAS),
  };
};

import { z } from "zod";
import { COACH_MODELS, type CoachModel } from "./models";

// Request bodies for the local coach API. They come from our own page, but
// they still cross a process boundary and end up in a prompt, so check them.

const MAX_MOMENTS = 20;
const MAX_LINE = 12;
const MAX_TRENDS_GAMES = 50;

const label = z.enum([
  "blunder",
  "miss",
  "mistake",
  "inaccuracy",
  "brilliant",
  "great",
]);
const tag = z.enum([
  "hangs_piece",
  "fork",
  "missed_fork",
  "refutation_check",
  "refutation_capture",
  "missed_mate",
  "allows_mate",
  "missed_material",
  "sacrifice",
]);
const phase = z.enum(["opening", "middlegame", "endgame"]);
const san = z.string().max(12);
const shortText = z.string().max(200);
const player = z.object({ name: shortText, rating: z.number().optional() });

const packetMoment = z.object({
  ply: z.number().int().min(0),
  fen: z.string().max(100),
  moveNumber: z.string().max(8),
  label,
  playedMove: san,
  bestMove: san.nullable(),
  goodMoves: z.array(san).max(6),
  winChanceBefore: z.number(),
  winChanceAfter: z.number(),
  evalBefore: z.string().max(12),
  evalAfter: z.string().max(12),
  bestLine: z.array(san).max(MAX_LINE),
  refutationLine: z.array(san).max(MAX_LINE),
  materialAfterBestLine: z.number(),
  materialAfterPlayedLine: z.number(),
  tags: z.array(tag),
  hints: z.array(z.string().max(300)).max(10),
  phase,
  clockSeconds: z.number().optional(),
});

export const reviewPacketSchema = z.object({
  game: z.object({
    white: player,
    black: player,
    userSide: z.enum(["white", "black"]),
    result: shortText.optional(),
    termination: shortText.optional(),
    timeControl: shortText.optional(),
    date: shortText.optional(),
    opening: shortText.optional(),
    accuracy: z.object({ user: z.number(), opponent: z.number() }),
    engine: z.object({ name: shortText, depth: z.number() }),
    moveCount: z.number().int().min(0),
  }),
  moves: z.string().max(10_000),
  moments: z.array(packetMoment).max(MAX_MOMENTS),
});

const coachModel = z
  .string()
  .refine(
    (value): value is CoachModel => value in COACH_MODELS,
    "Unknown model"
  );

export const reviewRequestSchema = z.object({
  packet: reviewPacketSchema,
  gameSans: z.array(san).max(1_000),
  model: coachModel,
});

const gameDigest = z.object({
  gameKey: z.string().max(300),
  gameId: z.number().int().optional(),
  date: shortText.optional(),
  userName: shortText,
  userSide: z.enum(["w", "b"]),
  opponentName: shortText,
  userRating: z.number().optional(),
  opponentRating: z.number().optional(),
  outcome: z.enum(["win", "loss", "draw", "unknown"]),
  termination: shortText.optional(),
  timeControl: shortText.optional(),
  timeClass: z.enum([
    "bullet",
    "blitz",
    "rapid",
    "classical",
    "daily",
    "unknown",
  ]),
  opening: shortText.optional(),
  accuracy: z.object({ user: z.number(), opponent: z.number() }),
  counts: z.record(label, z.number()),
  moments: z
    .array(
      z.object({
        ply: z.number().int().min(0),
        moveNumber: z.string().max(8),
        label,
        phase,
        tags: z.array(tag),
        title: z.string().max(300),
        lesson: z.string().max(600),
        clockSeconds: z.number().optional(),
      })
    )
    .max(MAX_MOMENTS),
  reviewedAt: shortText,
});

export const trendsRequestSchema = z.object({
  digests: z.array(gameDigest).min(2).max(MAX_TRENDS_GAMES),
  model: coachModel,
});

import type { CoachModel } from "./models";

export type Side = "w" | "b";

/** Coach-level label for a move worth talking about. */
export type MomentLabel =
  | "blunder"
  | "miss"
  | "mistake"
  | "inaccuracy"
  | "brilliant"
  | "great";

export type MotifTag =
  | "hangs_piece"
  | "fork"
  | "missed_fork"
  | "refutation_check"
  | "refutation_capture"
  | "missed_mate"
  | "allows_mate"
  | "missed_material"
  | "sacrifice";

export type GamePhase = "opening" | "middlegame" | "endgame";

/** A key moment picked by code from the engine evaluation. */
export interface KeyMoment {
  /** 0-based index into the game's moves. */
  ply: number;
  label: MomentLabel;
  /** The user's win chance (0-100) before and after the move. */
  winBefore: number;
  winAfter: number;
}

/** Everything Claude is allowed to know about one key moment. */
export interface PacketMoment {
  ply: number;
  /** Position before the move. */
  fen: string;
  /** "12." for a White move, "12..." for a Black move. */
  moveNumber: string;
  label: MomentLabel;
  playedMove: string;
  /** Null when the played move was already the engine's best. */
  bestMove: string | null;
  /** Engine moves (SAN) about as good as the best one, best first; excludes the played move. */
  goodMoves: string[];
  winChanceBefore: number;
  winChanceAfter: number;
  /** Engine eval from the user's side, e.g. "+1.20" or "-M3". */
  evalBefore: string;
  evalAfter: string;
  /** Engine's best continuation from the position before the move (SAN). */
  bestLine: string[];
  /** Engine's reply line after the move that was played (SAN). */
  refutationLine: string[];
  /** User-relative material change (pawns) at the end of each line. */
  materialAfterBestLine: number;
  materialAfterPlayedLine: number;
  tags: MotifTag[];
  /** Plain-language facts computed by code, safe for Claude to rely on. */
  hints: string[];
  phase: GamePhase;
  clockSeconds?: number;
}

export interface PacketPlayer {
  name: string;
  rating?: number;
}

export interface ReviewPacket {
  game: {
    white: PacketPlayer;
    black: PacketPlayer;
    userSide: "white" | "black";
    result?: string;
    termination?: string;
    timeControl?: string;
    date?: string;
    opening?: string;
    accuracy: { user: number; opponent: number };
    engine: { name: string; depth: number };
    moveCount: number;
  };
  /** Full game in SAN movetext, for narrative context only. */
  moves: string;
  moments: PacketMoment[];
}

/** One explained moment, as stored and shown in the UI. */
export interface ReviewedMoment {
  ply: number;
  moveNumber: string;
  label: MomentLabel;
  fen: string;
  playedMove: string;
  bestMove: string | null;
  goodMoves: string[];
  /** The user's win chance with best play from this position (0-100). */
  winChanceBefore: number;
  title: string;
  explanation: string;
  lesson: string;
  /** True when the explanation mentions a move the engine data doesn't contain. */
  unverified: boolean;
  unverifiedMoves: string[];
}

export interface CoachReview {
  id: string;
  gameKey: string;
  model: CoachModel;
  promptVersion: number;
  createdAt: string;
  userSide: Side;
  engine: { name: string; depth: number; date: string };
  summary: string;
  takeaways: string[];
  moments: ReviewedMoment[];
  costUsd: number;
}

export interface DigestMoment {
  ply: number;
  moveNumber: string;
  label: MomentLabel;
  phase: GamePhase;
  tags: MotifTag[];
  title: string;
  lesson: string;
  clockSeconds?: number;
}

export type GameOutcome = "win" | "loss" | "draw" | "unknown";
export type TimeClass =
  | "bullet"
  | "blitz"
  | "rapid"
  | "classical"
  | "daily"
  | "unknown";

/** A self-contained summary of one reviewed game, input to cross-game trends. */
export interface GameDigest {
  gameKey: string;
  /** Local Chesskit database id, used to open the game again. */
  gameId?: number;
  date?: string;
  userName: string;
  userSide: Side;
  opponentName: string;
  userRating?: number;
  opponentRating?: number;
  outcome: GameOutcome;
  termination?: string;
  timeControl?: string;
  timeClass: TimeClass;
  opening?: string;
  accuracy: { user: number; opponent: number };
  counts: Record<MomentLabel, number>;
  moments: DigestMoment[];
  reviewedAt: string;
}

export interface TrendPattern {
  name: string;
  description: string;
  evidence: { gameKey: string; ply: number }[];
}

export interface TrendsReport {
  id: string;
  createdAt: string;
  model: CoachModel;
  gameKeys: string[];
  headline: string;
  patterns: TrendPattern[];
  strengths: string[];
  focusAreas: { what: string; howToPractice: string }[];
  costUsd: number;
}

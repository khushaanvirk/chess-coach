import { getPositionWinPercentage } from "@/lib/engine/helpers/winPercentage";
import { MoveClassification } from "@/types/enums";
import type { PositionEval } from "@/types/eval";
import type { KeyMoment, MomentLabel, Side } from "./types";

export const DEFAULT_MAX_MOMENTS = 12;
const MAX_INACCURACIES = 3;
const MAX_GOOD_MOVES = 3;
// A "miss": the opponent's last move handed you at least this much win chance...
const MISS_MIN_GAIN = 10;
// ...and your reply gave back at least half of it (and at least this much).
const MISS_MIN_LOSS = 5;
const MISS_GIVEBACK_RATIO = 0.5;

const LABEL_PRIORITY: Record<MomentLabel, number> = {
  blunder: 0,
  miss: 1,
  mistake: 2,
  brilliant: 3,
  great: 4,
  inaccuracy: 5,
};

const CLASSIFICATION_LABELS: Partial<Record<MoveClassification, MomentLabel>> = {
  [MoveClassification.Blunder]: "blunder",
  [MoveClassification.Mistake]: "mistake",
  [MoveClassification.Inaccuracy]: "inaccuracy",
  [MoveClassification.Splendid]: "brilliant",
  [MoveClassification.Perfect]: "great",
};

/** The user's win chance (0-100) in a position, or undefined if it has no score. */
export const userWinChance = (
  position: PositionEval | undefined,
  side: Side
): number | undefined => {
  const line = position?.lines[0];
  if (!position || !line || (line.cp === undefined && line.mate === undefined)) {
    return undefined;
  }
  const white = getPositionWinPercentage(position);
  return side === "w" ? white : 100 - white;
};

export interface SelectKeyMomentsInput {
  positions: PositionEval[];
  /** fens[i] is the position before ply i; one longer than the move list. */
  fens: string[];
  userSide: Side;
  maxMoments?: number;
}

const isMiss = (prev: number | undefined, before: number, after: number): boolean => {
  if (prev === undefined) return false;
  const gain = before - prev;
  const loss = before - after;
  return gain >= MISS_MIN_GAIN && loss >= Math.max(MISS_MIN_LOSS, gain * MISS_GIVEBACK_RATIO);
};

const labelFor = (
  classification: MoveClassification | undefined,
  missed: boolean
): MomentLabel | undefined => {
  const label = classification ? CLASSIFICATION_LABELS[classification] : undefined;
  if (label === "blunder") return label;
  if (missed) return "miss";
  return label;
};

const swing = (m: KeyMoment): number => Math.abs(m.winBefore - m.winAfter);

/**
 * Picks the user's moves worth explaining. Label of ply i lives on
 * positions[i + 1]; win chances are from the user's side.
 */
export const selectKeyMoments = ({
  positions,
  fens,
  userSide,
  maxMoments = DEFAULT_MAX_MOMENTS,
}: SelectKeyMomentsInput): KeyMoment[] => {
  const candidates: KeyMoment[] = [];
  const moveCount = Math.min(fens.length - 1, positions.length - 1);

  for (let ply = 0; ply < moveCount; ply++) {
    if (fens[ply].split(" ")[1] !== userSide) continue;

    const winBefore = userWinChance(positions[ply], userSide);
    const winAfter = userWinChance(positions[ply + 1], userSide);
    if (winBefore === undefined || winAfter === undefined) continue;

    const prev = ply > 0 ? userWinChance(positions[ply - 1], userSide) : undefined;
    const label = labelFor(
      positions[ply + 1].moveClassification,
      isMiss(prev, winBefore, winAfter)
    );
    if (label) candidates.push({ ply, label, winBefore, winAfter });
  }

  const inaccuracies = candidates
    .filter((m) => m.label === "inaccuracy")
    .sort((a, b) => swing(b) - swing(a))
    .slice(0, MAX_INACCURACIES);
  const goodMoves = candidates
    .filter((m) => m.label === "brilliant" || m.label === "great")
    .slice(0, MAX_GOOD_MOVES);
  const errors = candidates.filter(
    (m) => m.label === "blunder" || m.label === "miss" || m.label === "mistake"
  );

  return [...errors, ...goodMoves, ...inaccuracies]
    .sort(
      (a, b) => LABEL_PRIORITY[a.label] - LABEL_PRIORITY[b.label] || swing(b) - swing(a)
    )
    .slice(0, maxMoments)
    .sort((a, b) => a.ply - b.ply);
};

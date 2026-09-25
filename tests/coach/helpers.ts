import { MoveClassification } from "@/types/enums";
import type { PositionEval } from "@/types/eval";

type Score = number | { mate: number };

/** A position eval with a White-POV score, optional label and best line. */
export const pe = (
  score: Score,
  classification?: MoveClassification,
  pv: string[] = ["a2a3"]
): PositionEval => {
  const scored = typeof score === "number" ? { cp: score } : { mate: score.mate };
  return {
    bestMove: pv[0],
    moveClassification: classification,
    lines: [
      { pv, depth: 16, multiPv: 1, ...scored },
      { pv: ["h2h3"], depth: 16, multiPv: 2, cp: typeof score === "number" ? score - 40 : 0 },
    ],
  };
};

/** Fake FENs where only the side-to-move field matters. */
export const sideFens = (count: number, firstToMove: "w" | "b" = "w"): string[] =>
  Array.from({ length: count }, (_, i) => {
    const white = (i % 2 === 0) === (firstToMove === "w");
    return `8/8/8/8/8/8/8/8 ${white ? "w" : "b"} - - 0 ${Math.floor(i / 2) + 1}`;
  });

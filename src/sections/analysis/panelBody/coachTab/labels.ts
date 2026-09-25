import { CLASSIFICATION_COLORS } from "@/constants";
import { MoveClassification } from "@/types/enums";
import type { MomentLabel } from "@/lib/coach/types";

export const MISS_COLOR = "#e0703a";

/** How each coach label looks, reusing Chesskit's classification colours and icons. */
export const LABEL_META: Record<
  MomentLabel,
  { text: string; color: string; icon?: string }
> = {
  blunder: {
    text: "Blunder",
    color: CLASSIFICATION_COLORS[MoveClassification.Blunder],
    icon: "/icons/blunder.png",
  },
  miss: { text: "Missed chance", color: MISS_COLOR },
  mistake: {
    text: "Mistake",
    color: CLASSIFICATION_COLORS[MoveClassification.Mistake],
    icon: "/icons/mistake.png",
  },
  inaccuracy: {
    text: "Inaccuracy",
    color: CLASSIFICATION_COLORS[MoveClassification.Inaccuracy],
    icon: "/icons/inaccuracy.png",
  },
  brilliant: {
    text: "Brilliant",
    color: CLASSIFICATION_COLORS[MoveClassification.Splendid],
    icon: "/icons/splendid.png",
  },
  great: {
    text: "Great move",
    color: CLASSIFICATION_COLORS[MoveClassification.Perfect],
    icon: "/icons/perfect.png",
  },
};

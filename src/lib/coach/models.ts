export type CoachModel =
  | "claude-opus-5"
  | "claude-sonnet-5"
  | "claude-haiku-4-5";

export const DEFAULT_COACH_MODEL: CoachModel = "claude-opus-5";

export const COACH_MODELS: Record<
  CoachModel,
  { label: string; supportsEffort: boolean }
> = {
  "claude-opus-5": { label: "Claude Opus 5 (best)", supportsEffort: true },
  "claude-sonnet-5": { label: "Claude Sonnet 5", supportsEffort: true },
  "claude-haiku-4-5": {
    label: "Claude Haiku 4.5 (cheapest)",
    supportsEffort: false,
  },
};

export const isCoachModel = (value: unknown): value is CoachModel =>
  typeof value === "string" && value in COACH_MODELS;

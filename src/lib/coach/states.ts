import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import { DEFAULT_COACH_MODEL, type CoachModel } from "./models";
import type { CoachReview } from "./types";

export const coachModelAtom = atomWithStorage<CoachModel>(
  "coach-model",
  DEFAULT_COACH_MODEL
);

/** Review of the game currently open on the analysis page, if any. */
export const currentCoachReviewAtom = atom<CoachReview | undefined>(undefined);

// Chesskit keeps recent usernames as a JSON string of comma-separated names.
const USERNAME_KEYS = ["chesscom-username", "lichess-username"];

export const getKnownUsernames = (): string[] => {
  if (typeof window === "undefined") return [];
  return USERNAME_KEYS.flatMap((key) => {
    try {
      const raw = window.localStorage.getItem(key);
      const value: unknown = raw ? JSON.parse(raw) : "";
      return typeof value === "string"
        ? value.split(",").map((s) => s.trim())
        : [];
    } catch {
      return [];
    }
  }).filter(Boolean);
};

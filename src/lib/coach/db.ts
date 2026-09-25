import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { CoachModel } from "./models";
import { PROMPT_VERSION } from "./prompts";
import type { CoachReview, GameDigest, TrendsReport } from "./types";

// A separate IndexedDB database so Chesskit's own "games" database (and its
// schema version) is never touched by the coach.

interface CoachDbSchema extends DBSchema {
  reviews: {
    key: string;
    value: CoachReview;
    indexes: { "by-gameKey": string };
  };
  digests: {
    key: string;
    value: GameDigest;
    indexes: { "by-reviewedAt": string };
  };
  trends: {
    key: string;
    value: TrendsReport;
    indexes: { "by-createdAt": string };
  };
}

const DB_NAME = "coach";
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<CoachDbSchema>> | undefined;

const getDb = (): Promise<IDBPDatabase<CoachDbSchema>> => {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(
      new Error("The coach database only works in the browser.")
    );
  }
  dbPromise ??= openDB<CoachDbSchema>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      db.createObjectStore("reviews", { keyPath: "id" }).createIndex(
        "by-gameKey",
        "gameKey"
      );
      db.createObjectStore("digests", { keyPath: "gameKey" }).createIndex(
        "by-reviewedAt",
        "reviewedAt"
      );
      db.createObjectStore("trends", { keyPath: "id" }).createIndex(
        "by-createdAt",
        "createdAt"
      );
    },
  });
  return dbPromise;
};

export const reviewId = (gameKey: string, model: CoachModel): string =>
  `${gameKey}|${model}|${PROMPT_VERSION}`;

/** The review for this model if there is one, else the newest current-version review. */
export const findReview = async (
  gameKey: string,
  model: CoachModel
): Promise<CoachReview | undefined> => {
  const db = await getDb();
  const exact = await db.get("reviews", reviewId(gameKey, model));
  if (exact) return exact;

  const all = await db.getAllFromIndex("reviews", "by-gameKey", gameKey);
  return all
    .filter((r) => r.promptVersion === PROMPT_VERSION)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
};

export const saveReview = async (review: CoachReview): Promise<void> => {
  await (await getDb()).put("reviews", review);
};

export const saveDigest = async (digest: GameDigest): Promise<void> => {
  await (await getDb()).put("digests", digest);
};

/** Newest first. */
export const listDigests = async (limit?: number): Promise<GameDigest[]> => {
  const all = await (await getDb()).getAllFromIndex("digests", "by-reviewedAt");
  const newestFirst = all.reverse();
  return limit ? newestFirst.slice(0, limit) : newestFirst;
};

export const saveTrends = async (report: TrendsReport): Promise<void> => {
  await (await getDb()).put("trends", report);
};

export const getLatestTrends = async (): Promise<TrendsReport | undefined> => {
  const all = await (await getDb()).getAllFromIndex("trends", "by-createdAt");
  return all.at(-1);
};

/** Newest review per game for the current prompt version, newest first. */
export const listRecentReviews = async (
  limit?: number
): Promise<CoachReview[]> => {
  const all = await (await getDb()).getAll("reviews");
  const newestPerGame = new Map<string, CoachReview>();
  for (const review of all) {
    if (review.promptVersion !== PROMPT_VERSION) continue;
    const current = newestPerGame.get(review.gameKey);
    if (!current || review.createdAt > current.createdAt) {
      newestPerGame.set(review.gameKey, review);
    }
  }
  const sorted = [...newestPerGame.values()].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt)
  );
  return limit ? sorted.slice(0, limit) : sorted;
};

/** Newest current-version review of one game, whatever model wrote it. */
export const getLatestReviewForGame = async (
  gameKey: string
): Promise<CoachReview | undefined> =>
  (await listRecentReviews()).find((review) => review.gameKey === gameKey);

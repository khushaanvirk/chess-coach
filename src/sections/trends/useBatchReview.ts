import { useCallback, useRef, useState } from "react";
import { useAtomValue } from "jotai";
import { Chess } from "chess.js";
import { DEFAULT_ENGINE } from "@/constants";
import { useEngine } from "@/hooks/useEngine";
import { useGameDatabase } from "@/hooks/useGameDatabase";
import { getEvaluateGameParams } from "@/lib/chess";
import { getChessComUserRecentGames } from "@/lib/chessCom";
import {
  CoachClientError,
  describeCoachError,
  requestReview,
} from "@/lib/coach/client";
import { listDigests } from "@/lib/coach/db";
import {
  detectUserSide,
  getGameKey,
  getUnsupportedReason,
} from "@/lib/coach/gameKey";
import { buildReviewPacket } from "@/lib/coach/packet";
import { persistReview } from "@/lib/coach/persist";
import { coachModelAtom } from "@/lib/coach/states";
import { engineWorkersNbAtom } from "@/sections/analysis/states";

const BATCH_ENGINE_DEPTH = 16;
const BATCH_MULTI_PV = 3;
// Errors that will fail every remaining game too, so stop the batch.
const FATAL_CODES = new Set(["not_logged_in", "limit_reached", "offline"]);

export type BatchStatus =
  | "queued"
  | "analysing"
  | "reviewing"
  | "done"
  | "error";

export interface BatchItem {
  gameKey: string;
  title: string;
  status: BatchStatus;
  progress: number;
  message?: string;
}

export interface BatchReview {
  items: BatchItem[];
  running: boolean;
  notice?: string;
  engineReady: boolean;
  start: (username: string, count: number) => Promise<void>;
  cancel: () => void;
}

interface Candidate {
  gameKey: string;
  title: string;
  game: Chess;
}

const findCandidates = async (
  username: string,
  count: number
): Promise<Candidate[]> => {
  const games = await getChessComUserRecentGames(username);
  const reviewed = new Set((await listDigests()).map((d) => d.gameKey));
  const candidates: Candidate[] = [];

  for (const loaded of games) {
    if (candidates.length >= count) break;
    const game = new Chess();
    try {
      game.loadPgn(loaded.pgn);
    } catch {
      continue;
    }
    const headers = game.getHeaders();
    if (getUnsupportedReason(headers) || game.history().length < 2) continue;

    const gameKey = await getGameKey(headers, game.history());
    if (reviewed.has(gameKey)) continue;

    const opponent =
      loaded.white.name.toLowerCase() === username.toLowerCase()
        ? loaded.black
        : loaded.white;
    candidates.push({
      gameKey,
      game,
      title: `vs ${opponent.name}${loaded.date ? ` · ${loaded.date}` : ""}${loaded.timeControl ? ` · ${loaded.timeControl}` : ""}`,
    });
  }

  return candidates;
};

export const useBatchReview = (onGameReviewed: () => void): BatchReview => {
  const engine = useEngine(DEFAULT_ENGINE);
  const workersNb = useAtomValue(engineWorkersNbAtom);
  const model = useAtomValue(coachModelAtom);
  const { addGame, setGameEval, isReady: dbReady } = useGameDatabase();

  const [items, setItems] = useState<BatchItem[]>([]);
  const [running, setRunning] = useState(false);
  const [notice, setNotice] = useState<string>();
  const abortRef = useRef<AbortController | null>(null);

  const update = (gameKey: string, patch: Partial<BatchItem>) =>
    setItems((prev) =>
      prev.map((item) =>
        item.gameKey === gameKey ? { ...item, ...patch } : item
      )
    );

  const start = useCallback(
    async (username: string, count: number) => {
      if (!engine?.getIsReady() || !dbReady || running) return;
      const controller = new AbortController();
      abortRef.current = controller;
      setRunning(true);
      setNotice(undefined);

      try {
        const candidates = await findCandidates(username.trim(), count);
        setItems(
          candidates.map((c) => ({
            gameKey: c.gameKey,
            title: c.title,
            status: "queued",
            progress: 0,
          }))
        );
        if (!candidates.length) {
          setNotice(
            "No new games to review. Every recent game already has a review."
          );
          return;
        }

        for (const candidate of candidates) {
          if (controller.signal.aborted) break;
          const { game, gameKey } = candidate;
          const headers = game.getHeaders();

          try {
            update(gameKey, { status: "analysing" });
            const gameEval = await engine.evaluateGame({
              ...getEvaluateGameParams(game),
              depth: BATCH_ENGINE_DEPTH,
              multiPv: BATCH_MULTI_PV,
              workersNb,
              playersRatings: {
                white: Number(headers.WhiteElo) || undefined,
                black: Number(headers.BlackElo) || undefined,
              },
              setEvaluationProgress: (value) =>
                update(gameKey, { progress: value }),
            });
            if (controller.signal.aborted) break;

            const userSide = detectUserSide(headers, [username]) ?? "w";
            const packet = buildReviewPacket({ game, gameEval, userSide });
            const gameId = await addGame(game);
            await setGameEval(gameId, gameEval);

            update(gameKey, { status: "reviewing", progress: 100 });
            const result = await requestReview(
              { packet, gameSans: game.history(), model },
              controller.signal
            );
            await persistReview({
              gameKey,
              gameId,
              userSide,
              gameEval,
              packet,
              result,
            });
            update(gameKey, {
              status: "done",
              message: `$${result.costUsd.toFixed(3)}`,
            });
            onGameReviewed();
          } catch (error) {
            if (error instanceof CoachClientError && error.code === "aborted")
              break;
            update(gameKey, {
              status: "error",
              message: describeCoachError(error),
            });
            if (
              error instanceof CoachClientError &&
              FATAL_CODES.has(error.code)
            ) {
              setNotice(describeCoachError(error));
              break;
            }
          }
        }
      } catch (error) {
        setNotice(
          error instanceof Error && /fetching games/i.test(error.message)
            ? "Couldn't load games for that chess.com username."
            : describeCoachError(error)
        );
      } finally {
        setRunning(false);
        abortRef.current = null;
      }
    },
    [
      addGame,
      dbReady,
      engine,
      model,
      onGameReviewed,
      running,
      setGameEval,
      workersNb,
    ]
  );

  const cancel = useCallback(() => abortRef.current?.abort(), []);

  return {
    items,
    running,
    notice,
    engineReady: !!engine?.getIsReady(),
    start,
    cancel,
  };
};

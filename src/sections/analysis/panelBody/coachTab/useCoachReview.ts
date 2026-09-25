import { useCallback, useEffect, useRef, useState } from "react";
import { useAtom, useAtomValue } from "jotai";
import { useRouter } from "next/router";
import { gameAtom, gameEvalAtom } from "@/sections/analysis/states";
import { useGameDatabase } from "@/hooks/useGameDatabase";
import {
  CoachClientError,
  describeCoachError,
  requestReview,
} from "@/lib/coach/client";
import { findReview } from "@/lib/coach/db";
import {
  detectUserSide,
  getGameKey,
  getUnsupportedReason,
} from "@/lib/coach/gameKey";
import { buildReviewPacket } from "@/lib/coach/packet";
import { persistReview } from "@/lib/coach/persist";
import {
  coachModelAtom,
  currentCoachReviewAtom,
  getKnownUsernames,
} from "@/lib/coach/states";
import type { CoachReview, Side } from "@/lib/coach/types";

export type CoachStatus = "idle" | "needs-side" | "running" | "error";

export interface CoachReviewState {
  gameKey?: string;
  review?: CoachReview;
  status: CoachStatus;
  error?: string;
  unsupportedReason: string | null;
  canReview: boolean;
  runReview: (side?: Side) => Promise<void>;
  cancel: () => void;
}

export const useCoachReview = (): CoachReviewState => {
  const game = useAtomValue(gameAtom);
  const gameEval = useAtomValue(gameEvalAtom);
  const model = useAtomValue(coachModelAtom);
  const [review, setReview] = useAtom(currentCoachReviewAtom);
  const { addGame, setGameEval, gameFromUrl, isReady } = useGameDatabase();
  const router = useRouter();

  const [gameKey, setGameKey] = useState<string>();
  const [status, setStatus] = useState<CoachStatus>("idle");
  const [error, setError] = useState<string>();
  const abortRef = useRef<AbortController | null>(null);

  const headers = game.getHeaders();
  const history = game.history();
  const historyKey = history.join(" ");
  const unsupportedReason = getUnsupportedReason(headers);

  // Identify the loaded game, then pick up any review already stored for it.
  useEffect(() => {
    let cancelled = false;
    setStatus("idle");
    setError(undefined);

    if (!historyKey) {
      setGameKey(undefined);
      setReview(undefined);
      return;
    }

    (async () => {
      const key = await getGameKey(game.getHeaders(), historyKey.split(" "));
      if (cancelled) return;
      setGameKey(key);
      const stored = await findReview(key, model).catch(() => undefined);
      if (!cancelled) setReview(stored);
    })();

    return () => {
      cancelled = true;
    };
  }, [game, historyKey, model, setReview]);

  // Stop an in-flight review when the game changes or the page goes away.
  useEffect(() => () => abortRef.current?.abort(), [historyKey]);

  const ensureSaved = useCallback(async (): Promise<number | undefined> => {
    if (!gameEval || !isReady) return undefined;
    if (gameFromUrl) return gameFromUrl.id;

    const gameId = await addGame(game);
    await setGameEval(gameId, gameEval);
    await router.replace(
      { pathname: router.pathname, query: { ...router.query, gameId } },
      undefined,
      { shallow: true, scroll: false }
    );
    return gameId;
  }, [addGame, game, gameEval, gameFromUrl, isReady, router, setGameEval]);

  const runReview = useCallback(
    async (sideOverride?: Side) => {
      if (!gameEval || !gameKey || unsupportedReason) return;

      const side =
        sideOverride ?? detectUserSide(game.getHeaders(), getKnownUsernames());
      if (!side) {
        setStatus("needs-side");
        return;
      }

      const controller = new AbortController();
      abortRef.current?.abort();
      abortRef.current = controller;
      setStatus("running");
      setError(undefined);

      try {
        const packet = buildReviewPacket({ game, gameEval, userSide: side });
        const gameId = await ensureSaved();
        const result = await requestReview(
          { packet, gameSans: game.history(), model },
          controller.signal
        );

        const stored = await persistReview({
          gameKey,
          gameId,
          userSide: side,
          gameEval,
          packet,
          result,
        });

        if (abortRef.current === controller) {
          setReview(stored);
          setStatus("idle");
        }
      } catch (err) {
        if (err instanceof CoachClientError && err.code === "aborted") {
          setStatus("idle");
          return;
        }
        setError(describeCoachError(err));
        setStatus("error");
      }
    },
    [ensureSaved, game, gameEval, gameKey, model, setReview, unsupportedReason]
  );

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    setStatus("idle");
  }, []);

  return {
    gameKey,
    review,
    status,
    error,
    unsupportedReason,
    canReview: !!gameEval && !!gameKey && !unsupportedReason,
    runReview,
    cancel,
  };
};

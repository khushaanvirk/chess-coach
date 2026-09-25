import { useCallback, useEffect, useMemo, useState } from "react";
import { atom, useAtom, useSetAtom } from "jotai";
import { Chess } from "chess.js";
import { useEngine } from "@/hooks/useEngine";
import { DEFAULT_ENGINE } from "@/constants";
import { getLatestReviewForGame, listRecentReviews } from "@/lib/coach/db";
import { userWinChance } from "@/lib/coach/keyMoments";
import {
  judgeAttempt,
  judgeByEngine,
  selectDrills,
  type Drill,
} from "@/lib/coach/retry";
import type { CurrentPosition } from "@/types/eval";

export const retryBoardAtom = atom(new Chess());
export const retryPositionAtom = atom<CurrentPosition>({});

const RECENT_REVIEWS = 10;
const ENGINE_CHECK_DEPTH = 14;

export type AttemptState =
  | { kind: "waiting" }
  | { kind: "checking"; san: string }
  | { kind: "best" | "good"; san: string }
  | { kind: "played"; san: string }
  | { kind: "wrong"; san: string; winChance?: number }
  | { kind: "revealed" };

export interface RetryTrainer {
  loading: boolean;
  drills: Drill[];
  index: number;
  drill?: Drill;
  attempt: AttemptState;
  solvedFirstTry: number;
  finished: boolean;
  retry: () => void;
  reveal: () => void;
  next: () => void;
  restart: () => void;
}

export const useRetryTrainer = (gameKey: string | undefined): RetryTrainer => {
  const [board, setBoard] = useAtom(retryBoardAtom);
  const setPosition = useSetAtom(retryPositionAtom);
  const engine = useEngine(DEFAULT_ENGINE);

  const [loading, setLoading] = useState(true);
  const [drills, setDrills] = useState<Drill[]>([]);
  const [index, setIndex] = useState(0);
  const [attempt, setAttempt] = useState<AttemptState>({ kind: "waiting" });
  const [triesOnDrill, setTriesOnDrill] = useState(0);
  const [solvedFirstTry, setSolvedFirstTry] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const reviews = gameKey
        ? [await getLatestReviewForGame(gameKey)].filter((r) => r !== undefined)
        : await listRecentReviews(RECENT_REVIEWS);
      if (cancelled) return;
      setDrills(selectDrills(reviews));
      setIndex(0);
      setLoading(false);
    })().catch(() => setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [gameKey]);

  const drill = drills[index];

  const resetBoard = useCallback(() => {
    if (!drill) return;
    setBoard(new Chess(drill.moment.fen));
    setPosition({});
    setAttempt({ kind: "waiting" });
  }, [drill, setBoard, setPosition]);

  useEffect(() => {
    resetBoard();
    setTriesOnDrill(0);
  }, [resetBoard]);

  const lastMoveSan = useMemo(() => board.history().at(-1), [board]);

  // Judge a move as soon as the user plays one.
  useEffect(() => {
    if (!drill || !lastMoveSan || attempt.kind !== "waiting") return;
    const moment = drill.moment;
    const verdict = judgeAttempt(moment, lastMoveSan);
    const firstTry = triesOnDrill === 0;
    setTriesOnDrill((n) => n + 1);

    if (verdict === "best" || verdict === "good") {
      if (firstTry) setSolvedFirstTry((n) => n + 1);
      setAttempt({ kind: verdict, san: lastMoveSan });
      return;
    }
    if (verdict === "played") {
      setAttempt({ kind: "played", san: lastMoveSan });
      return;
    }

    setAttempt({ kind: "checking", san: lastMoveSan });
    const fenAfter = board.fen();
    (async () => {
      if (!engine?.getIsReady()) {
        setAttempt({ kind: "wrong", san: lastMoveSan });
        return;
      }
      const evaluation = await engine.evaluatePositionWithUpdate({
        fen: fenAfter,
        depth: ENGINE_CHECK_DEPTH,
        multiPv: 2,
      });
      const winChance = userWinChance(evaluation, drill.userSide);
      if (
        winChance !== undefined &&
        judgeByEngine(moment.winChanceBefore, winChance) === "good"
      ) {
        if (firstTry) setSolvedFirstTry((n) => n + 1);
        setAttempt({ kind: "good", san: lastMoveSan });
      } else {
        setAttempt({ kind: "wrong", san: lastMoveSan, winChance });
      }
    })().catch(() => setAttempt({ kind: "wrong", san: lastMoveSan }));
  }, [attempt.kind, board, drill, engine, lastMoveSan, triesOnDrill]);

  const reveal = useCallback(() => {
    if (!drill) return;
    const game = new Chess(drill.moment.fen);
    const best = drill.moment.bestMove
      ? game.move(drill.moment.bestMove)
      : undefined;
    setBoard(new Chess(drill.moment.fen));
    setPosition(best ? { lastEval: { bestMove: best.lan, lines: [] } } : {});
    setAttempt({ kind: "revealed" });
  }, [drill, setBoard, setPosition]);

  const next = useCallback(() => setIndex((i) => i + 1), []);

  const restart = useCallback(() => {
    setIndex(0);
    setSolvedFirstTry(0);
    resetBoard();
  }, [resetBoard]);

  return {
    loading,
    drills,
    index,
    drill,
    attempt,
    solvedFirstTry,
    finished: !loading && drills.length > 0 && index >= drills.length,
    retry: resetBoard,
    reveal,
    next,
    restart,
  };
};

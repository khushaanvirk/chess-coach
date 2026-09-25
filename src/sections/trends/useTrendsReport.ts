import { useCallback, useEffect, useRef, useState } from "react";
import { useAtomValue } from "jotai";
import {
  CoachClientError,
  describeCoachError,
  requestTrends,
} from "@/lib/coach/client";
import { getLatestTrends, listDigests, saveTrends } from "@/lib/coach/db";
import { coachModelAtom } from "@/lib/coach/states";
import type { GameDigest, TrendsReport } from "@/lib/coach/types";

export const MIN_GAMES_FOR_TRENDS = 2;

export interface TrendsState {
  digests: GameDigest[];
  report?: TrendsReport;
  loading: boolean;
  running: boolean;
  error?: string;
  reload: () => Promise<void>;
  analyse: (lastN: number) => Promise<void>;
  cancel: () => void;
}

export const useTrendsReport = (): TrendsState => {
  const model = useAtomValue(coachModelAtom);
  const [digests, setDigests] = useState<GameDigest[]>([]);
  const [report, setReport] = useState<TrendsReport>();
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string>();
  const abortRef = useRef<AbortController | null>(null);

  const reload = useCallback(async () => {
    const [allDigests, latest] = await Promise.all([
      listDigests(),
      getLatestTrends(),
    ]);
    setDigests(allDigests);
    setReport(latest);
    setLoading(false);
  }, []);

  useEffect(() => {
    reload().catch(() => setLoading(false));
    return () => abortRef.current?.abort();
  }, [reload]);

  const analyse = useCallback(
    async (lastN: number) => {
      const selected = digests.slice(0, lastN);
      if (selected.length < MIN_GAMES_FOR_TRENDS) return;

      const controller = new AbortController();
      abortRef.current = controller;
      setRunning(true);
      setError(undefined);
      try {
        const result = await requestTrends(
          { digests: selected, model },
          controller.signal
        );
        const saved: TrendsReport = {
          id: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          model: result.model,
          gameKeys: selected.map((d) => d.gameKey),
          costUsd: result.costUsd,
          ...result.trends,
        };
        await saveTrends(saved);
        setReport(saved);
      } catch (err) {
        if (!(err instanceof CoachClientError && err.code === "aborted")) {
          setError(describeCoachError(err));
        }
      } finally {
        setRunning(false);
      }
    },
    [digests, model]
  );

  const cancel = useCallback(() => abortRef.current?.abort(), []);

  return { digests, report, loading, running, error, reload, analyse, cancel };
};

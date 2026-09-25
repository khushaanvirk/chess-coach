import { useEffect, useRef } from "react";
import { useAtomValue } from "jotai";
import { useRouter } from "next/router";
import { useChessActions } from "@/hooks/useChessActions";
import { boardAtom, gameAtom } from "@/sections/analysis/states";

/** Trends evidence links open `/?gameId=..&ply=..`; move the board to that ply once loaded. */
export const useJumpToPly = (): void => {
  const router = useRouter();
  const game = useAtomValue(gameAtom);
  const { goToMove } = useChessActions(boardAtom);
  const handled = useRef<string | null>(null);

  const { ply: plyParam, gameId } = router.query;

  useEffect(() => {
    const ply = Number(plyParam);
    if (typeof plyParam !== "string" || !Number.isInteger(ply) || ply < 0)
      return;

    const key = `${gameId}:${ply}`;
    if (handled.current === key || game.history().length <= ply) return;

    handled.current = key;
    goToMove(ply + 1, game);
  }, [game, gameId, goToMove, plyParam]);
};

import { expect, test } from "@playwright/test";
import { Chess } from "chess.js";
import { TRAP_PGN } from "../tests/coach/fixtures";
import type { GameDigest, ReviewPacket } from "../src/lib/coach/types";
import {
  CLAUDE_TIMEOUT,
  clickMove,
  loadPgn,
  mockReviewRoute,
  openCoach,
  shot,
  waitForAnalysis,
} from "./helpers";

const squaresOf = (fen: string, san: string) => {
  const move = new Chess(fen).move(san);
  return { from: move.from, to: move.to };
};

test("retry: find the better move, repeat the game move, reveal the answer", async ({ page }) => {
  let packet: ReviewPacket | undefined;
  await mockReviewRoute(page, (p) => (packet = p));

  await page.goto("/");
  await loadPgn(page, TRAP_PGN);
  await waitForAnalysis(page);
  await openCoach(page);
  await page.getByRole("button", { name: "Review with Claude" }).click();
  await page.getByRole("button", { name: "White", exact: true }).click();
  await expect(page.getByRole("region", { name: "Game summary" })).toBeVisible({ timeout: CLAUDE_TIMEOUT });

  await page.getByRole("link", { name: /Practice \d+ mistake/ }).click();
  await expect(page.getByRole("heading", { name: "Practise your mistakes" })).toBeVisible();
  const drills = packet!.moments.filter((m) => ["blunder", "mistake", "miss"].includes(m.label) && m.bestMove);
  await expect(page.getByText(`1 of ${drills.length}`)).toBeVisible();
  await shot(page, "10-retry-start");

  // Drill 1: play the engine's move.
  const first = drills[0];
  const best = squaresOf(first.fen, first.bestMove!);
  await clickMove(page, best.from, best.to);
  await expect(page.getByRole("status").filter({ hasText: /top move|works/ })).toBeVisible();
  await shot(page, "11-retry-solved");
  await page.getByRole("button", { name: /Next position|Finish/ }).click();

  if (drills.length > 1) {
    // Drill 2: repeat the game move, then give up and look at the answer.
    const second = drills[1];
    await expect(page.getByText(`2 of ${drills.length}`)).toBeVisible();
    const played = squaresOf(second.fen, second.playedMove);
    await clickMove(page, played.from, played.to);
    await expect(page.getByText(/is what you played in the game/)).toBeVisible();
    await page.getByRole("button", { name: "Show answer" }).click();
    await expect(page.getByText(/The engine's move:/)).toBeVisible();
    await shot(page, "12-retry-revealed");
    for (let i = 1; i < drills.length; i++) {
      await page.getByRole("button", { name: /Next position|Finish/ }).click();
      if (i < drills.length - 1) await page.getByRole("button", { name: "Show answer" }).click();
    }
  }

  await expect(page.getByRole("heading", { name: "Session done" })).toBeVisible();
  await expect(page.getByText(/first try in 1 of/)).toBeVisible();
});

const digest = (gameKey: string, gameId: number, plies: number[]): GameDigest => ({
  gameKey,
  gameId,
  userName: "me",
  userSide: "w",
  opponentName: `Opponent${gameId}`,
  outcome: gameId % 2 ? "loss" : "win",
  timeClass: "blitz",
  accuracy: { user: 70, opponent: 75 },
  counts: { blunder: plies.length, miss: 0, mistake: 0, inaccuracy: 0, brilliant: 0, great: 0 },
  moments: plies.map((ply) => ({
    ply,
    moveNumber: `${Math.floor(ply / 2) + 1}.`,
    label: "blunder" as const,
    phase: "middlegame" as const,
    tags: ["hangs_piece" as const],
    title: "Loose knight",
    lesson: "Check defenders.",
    clockSeconds: 20,
  })),
  reviewedAt: `2026-09-2${gameId}T00:00:00.000Z`,
});

test("trends: stats from stored digests and a report with working evidence links", async ({ page }) => {
  let sentGames = 0;
  await page.route("**/api/coach/trends", async (route) => {
    const body = route.request().postDataJSON() as { digests: GameDigest[]; model: string };
    sentGames = body.digests.length;
    await route.fulfill({
      json: {
        ok: true,
        data: {
          model: body.model,
          costUsd: 0.12,
          trends: {
            headline: "You leave knights undefended after attacking.",
            patterns: [
              {
                name: "Loose knights",
                description: "Knights left without a defender.",
                evidence: [
                  { gameKey: "g1", ply: 20 },
                  { gameKey: "g2", ply: 31 },
                ],
              },
            ],
            strengths: ["Solid openings"],
            focusAreas: [
              { what: "Blunder check", howToPractice: "Before each move, ask what is undefended." },
              { what: "Tactics", howToPractice: "10 fork puzzles a day." },
              { what: "Clock", howToPractice: "Save 1 minute for the endgame." },
            ],
          },
        },
      },
    });
  });

  await page.goto("/trends");
  await expect(page.getByRole("heading", { name: "Your trends" })).toBeVisible();
  await expect(page.getByText(/Review at least 2 games/)).toBeVisible();

  const digests = [digest("g1", 1, [20, 24]), digest("g2", 2, [31])];
  await page.evaluate(async (items) => {
    await new Promise<void>((resolve, reject) => {
      const open = indexedDB.open("coach");
      open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        const tx = open.result.transaction("digests", "readwrite");
        items.forEach((item) => tx.objectStore("digests").put(item));
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      };
    });
  }, digests);
  await page.reload();

  const stats = page.getByRole("region", { name: "Stats" });
  await expect(stats).toContainText("Games reviewed");
  await expect(stats).toContainText("1·1·0");
  await expect(stats).toContainText(`Errors under 30s`);

  await page.getByRole("button", { name: "Find my patterns" }).click();
  const report = page.getByRole("region", { name: "Trends report" });
  await expect(report).toContainText("You leave knights undefended");
  expect(sentGames).toBe(2);

  const evidence = report.getByRole("link", { name: /vs Opponent2 · 16\. blunder/ });
  await expect(evidence).toHaveAttribute("href", "/?gameId=2&ply=31");
  await shot(page, "20-trends-report");
});

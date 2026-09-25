import { expect, test } from "@playwright/test";
import { TRAP_PGN } from "../tests/coach/fixtures";
import type { ReviewPacket } from "../src/lib/coach/types";
import { CLAUDE_TIMEOUT, loadPgn, openCoach, shot, waitForAnalysis } from "./helpers";

// Real Stockfish in the browser, Claude mocked at the network edge: free and
// deterministic, but it still proves the engine -> packet -> UI pipeline.
test("coach reviews a game, jumps to moments, and survives a reload", async ({ page }) => {
  let packet: ReviewPacket | undefined;
  await page.route("**/api/coach/review", async (route) => {
    const body = route.request().postDataJSON() as { packet: ReviewPacket; model: string };
    packet = body.packet;
    await route.fulfill({
      json: {
        ok: true,
        data: {
          model: body.model,
          costUsd: 0.042,
          review: {
            summary: "You fell for the Blackburne Shilling trap.",
            takeaways: ["Check what the queen hits.", "Count defenders.", "Castle early."],
            moments: body.packet.moments.map((m) => ({
              ply: m.ply,
              moveNumber: m.moveNumber,
              label: m.label,
              fen: m.fen,
              playedMove: m.playedMove,
              bestMove: m.bestMove,
              goodMoves: m.goodMoves,
              winChanceBefore: m.winChanceBefore,
              title: `Mocked note for ${m.playedMove}`,
              explanation: `${m.playedMove} was the problem; ${m.bestMove ?? "it"} was better.`,
              lesson: "Look before you grab.",
              unverified: false,
              unverifiedMoves: [],
            })),
          },
        },
      },
    });
  });

  await page.goto("/");
  await loadPgn(page, TRAP_PGN);
  await waitForAnalysis(page);
  await openCoach(page);
  await shot(page, "01-coach-empty");

  await page.getByRole("button", { name: "Review with Claude" }).click();
  // The fixture's player name isn't a saved username, so the coach asks.
  await page.getByRole("button", { name: "White", exact: true }).click();

  await expect(page.getByRole("region", { name: "Game summary" })).toBeVisible({
    timeout: CLAUDE_TIMEOUT,
  });
  await shot(page, "02-coach-review");

  // Real engine output reached the packet: both greedy knight captures are flagged.
  const flagged = packet?.moments.map((m) => [m.ply, m.playedMove]);
  expect(flagged).toEqual(expect.arrayContaining([[6, "Nxe5"], [8, "Nxf7"]]));
  expect(packet?.game.userSide).toBe("white");

  const firstMoment = page.getByRole("button", { name: /Mocked note for Nxe5/ });
  await firstMoment.click();
  await expect(firstMoment).toHaveAttribute("aria-current", "step");
  await expect(page.getByRole("complementary", { name: "Coach note" })).toContainText(
    "Mocked note for Nxe5"
  );
  await shot(page, "03-moment-selected");

  // The review was cached and the game saved, so a reload brings both back.
  await expect(page).toHaveURL(/gameId=\d+/);
  await page.reload();
  await waitForAnalysis(page);
  await openCoach(page);
  await expect(page.getByRole("region", { name: "Game summary" })).toContainText(
    "Blackburne Shilling"
  );
});

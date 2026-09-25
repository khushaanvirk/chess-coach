import { expect, type Page } from "@playwright/test";
import type { ReviewPacket } from "../src/lib/coach/types";

export const ANALYSIS_TIMEOUT = 5 * 60_000;
export const CLAUDE_TIMEOUT = 2 * 60_000;

export const shot = (page: Page, name: string) =>
  page.screenshot({ path: `e2e/.results/screens/${name}.png`, fullPage: true });

export const openLoadDialog = async (page: Page) => {
  await page.getByRole("button", { name: /load (another )?game/i }).first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
};

export const chooseOrigin = async (page: Page, origin: "Chess.com" | "Lichess.org" | "PGN") => {
  await page.getByRole("combobox", { name: "Game origin" }).click();
  await page.getByRole("option", { name: origin }).click();
};

export const loadPgn = async (page: Page, pgn: string) => {
  await openLoadDialog(page);
  await chooseOrigin(page, "PGN");
  await page.getByLabel("Enter PGN here...").fill(pgn);
  await page.getByRole("button", { name: "Add" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
};

export const waitForAnalysis = async (page: Page) => {
  await expect(page.getByRole("button", { name: "Analyze again" })).toBeVisible({
    timeout: ANALYSIS_TIMEOUT,
  });
};

export const openCoach = async (page: Page) => {
  await page.getByRole("button", { name: "Coach", exact: true }).click();
};


/** Answers /api/coach/review from the real packet, so moments match real Stockfish output. */
export const mockReviewRoute = async (page: Page, onPacket?: (packet: ReviewPacket) => void) => {
  await page.route("**/api/coach/review", async (route) => {
    const body = route.request().postDataJSON() as { packet: ReviewPacket; model: string };
    onPacket?.(body.packet);
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
};

/** Plays a SAN move on a board by clicking its from and to squares. */
// react-chessboard animates position changes for 300ms and drops clicks meanwhile.
const BOARD_ANIMATION_MS = 350;

export const clickMove = async (page: Page, from: string, to: string) => {
  await expect(page.locator(`[data-square="${from}"] [data-piece]`).first()).toBeVisible();
  await page.waitForTimeout(BOARD_ANIMATION_MS);
  await page.locator(`[data-square="${from}"]`).first().click();
  await page.locator(`[data-square="${to}"]`).first().click();
};

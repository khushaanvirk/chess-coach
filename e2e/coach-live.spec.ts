import { expect, test } from "@playwright/test";
import {
  CLAUDE_TIMEOUT,
  chooseOrigin,
  openCoach,
  openLoadDialog,
  shot,
  waitForAnalysis,
} from "./helpers";

// Spends real Claude plan credit (a few cents). Run with:
//   E2E_LIVE=1 E2E_CHESSCOM_USER=<name> npx playwright test coach-live
const USER = process.env.E2E_CHESSCOM_USER ?? "hikaru";

test.skip(!process.env.E2E_LIVE, "set E2E_LIVE=1 to spend plan credit on a live review");

test("live: review the latest chess.com game with Claude", async ({ page }) => {
  await page.goto("/");
  await openLoadDialog(page);
  await chooseOrigin(page, "Chess.com");
  await page.getByLabel("Enter your Chess.com username...").fill(USER);
  await page.getByRole("dialog").locator("li.MuiListItem-root").first().click();

  await waitForAnalysis(page);
  await openCoach(page);
  await page.getByRole("button", { name: "Review with Claude" }).click();

  await expect(page.getByRole("region", { name: "Game summary" })).toBeVisible({
    timeout: CLAUDE_TIMEOUT,
  });
  await expect(page.getByText(/of plan credit/)).toBeVisible();
  await shot(page, "live-review");
});

test("live: batch-review three recent games, then find patterns", async ({ page }) => {
  await page.goto("/trends");
  await page.getByLabel("Chess.com username").fill(USER);
  await page.getByRole("combobox", { name: "Games" }).click();
  await page.getByRole("option", { name: "3", exact: true }).click();
  await page.getByRole("button", { name: "Review my last 3" }).click();

  const panel = page.getByRole("region", { name: "Review recent games" });
  await expect(panel.getByText("Reviewed")).toHaveCount(3, { timeout: 12 * 60_000 });
  await shot(page, "live-batch");

  await page.getByRole("button", { name: /Find my patterns|Refresh patterns/ }).click();
  const report = page.getByRole("region", { name: "Trends report" });
  await expect(report).toBeVisible({ timeout: CLAUDE_TIMEOUT });
  await expect(report.getByRole("link").first()).toHaveAttribute("href", /\/\?gameId=\d+&ply=\d+/);
  await shot(page, "live-trends");

  // Evidence links open the game at that move with the coach's note.
  await report.getByRole("link").first().click();
  await expect(page.getByRole("complementary", { name: "Coach note" })).toBeVisible({ timeout: 60_000 });
  await shot(page, "live-evidence");
});

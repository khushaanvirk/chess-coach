import { expect, test } from "@playwright/test";
import { TRAP_PGN } from "../tests/coach/fixtures";
import { CLAUDE_TIMEOUT, loadPgn, mockReviewRoute, shot, waitForAnalysis } from "./helpers";

test.use({ viewport: { width: 375, height: 812 } });

test("coach tab works at phone width without horizontal scroll", async ({ page }) => {
  await mockReviewRoute(page);
  await page.goto("/");
  await loadPgn(page, TRAP_PGN);
  await waitForAnalysis(page);

  await page.getByRole("tab", { name: "Coach" }).click();
  await page.getByRole("button", { name: "Review with Claude" }).click();
  await page.getByRole("button", { name: "White", exact: true }).click();
  await expect(page.getByRole("region", { name: "Game summary" })).toBeVisible({
    timeout: CLAUDE_TIMEOUT,
  });

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  expect(overflow).toBeLessThanOrEqual(0);
  await shot(page, "30-mobile-coach");
});

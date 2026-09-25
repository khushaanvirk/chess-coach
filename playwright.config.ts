import { defineConfig, devices } from "@playwright/test";

// One worker: Stockfish analysis is CPU-heavy and this runs on an 8 GB laptop.
export default defineConfig({
  testDir: "e2e",
  workers: 1,
  timeout: 8 * 60_000,
  expect: { timeout: 15_000 },
  reporter: [["list"]],
  outputDir: "e2e/.results",
  use: {
    baseURL: "http://127.0.0.1:3000",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run start",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: true,
    timeout: 120_000,
  },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
  ],
});

// One command to use the app: build when the source changed, start on this
// machine only, and open the browser.  Usage: npm run app
import { spawn, spawnSync } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const PORT = process.env.PORT ?? "3000";
const URL = `http://127.0.0.1:${PORT}`;
const BUILD_ID = ".next/BUILD_ID";
const WATCHED = ["src", "public", "next.config.ts", "package.json"];

const newestMtime = (path) => {
  const stat = statSync(path);
  if (!stat.isDirectory()) return stat.mtimeMs;
  return readdirSync(path).reduce((max, name) => Math.max(max, newestMtime(join(path, name))), 0);
};

const needsBuild = () => {
  if (!existsSync(BUILD_ID)) return true;
  const builtAt = statSync(BUILD_ID).mtimeMs;
  return WATCHED.some((path) => existsSync(path) && newestMtime(path) > builtAt);
};

if (needsBuild()) {
  console.log("Building (first run or code changed)…");
  const build = spawnSync("npx", ["next", "build"], { stdio: "inherit" });
  if (build.status !== 0) process.exit(build.status ?? 1);
}

const server = spawn("npx", ["next", "start", "-H", "127.0.0.1", "-p", PORT], { stdio: "inherit" });

const openWhenReady = async () => {
  for (let i = 0; i < 60; i++) {
    try {
      await fetch(URL);
      console.log(`\nChess Coach is running at ${URL} (Ctrl+C to stop)`);
      if (process.platform === "darwin" && !process.env.NO_OPEN) spawn("open", [URL]);
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  console.error(`The server didn't come up on ${URL}.`);
};

openWhenReady();
const stop = () => server.kill("SIGINT");
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
server.on("exit", (code) => process.exit(code ?? 0));

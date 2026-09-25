/**
 * Smoke test for the Claude link.
 *   npx tsx scripts/coach-smoke.ts --ping [model]
 *     Proves the Agent SDK runs on the local Claude plan login, with no tools
 *     and none of ~/.claude loaded, and prints what the call cost.
 *   npx tsx scripts/coach-smoke.ts --review [model]
 *     Runs a full coach review of the fixture trap game and prints it.
 */
import { Chess } from "chess.js";
import { runStructured, CoachRunError } from "../src/lib/coach/server/claude";
import { runReview } from "../src/lib/coach/server/review";
import { buildReviewPacket } from "../src/lib/coach/packet";
import { DEFAULT_COACH_MODEL, isCoachModel } from "../src/lib/coach/models";
import { TRAP_PGN, trapEval } from "../tests/coach/fixtures";

const PING_SCHEMA = {
  type: "object",
  properties: {
    answer: { type: "string" },
    bestFirstMove: { type: "string" },
  },
  required: ["answer", "bestFirstMove"],
  additionalProperties: false,
};

const ping = async (modelArg?: string) => {
  const model = isCoachModel(modelArg) ? modelArg : DEFAULT_COACH_MODEL;
  const result = await runStructured({
    systemPrompt: "You are a terse chess assistant. Reply only via the schema.",
    prompt: "Say hello in five words and name one popular first move for White in SAN.",
    jsonSchema: PING_SCHEMA,
    model,
    maxBudgetUsd: 0.1,
  });

  console.log(JSON.stringify(result, null, 2));

  const billedToPlan = result.apiKeySource === "none";
  // StructuredOutput is how the SDK returns schema output; nothing else may load.
  const isolated =
    result.toolsAvailable.length === 1 &&
    result.toolsAvailable[0] === "StructuredOutput";
  console.log(`\nbilled to Claude plan login: ${billedToPlan ? "yes" : "NO"}`);
  console.log(`only StructuredOutput loaded: ${isolated ? "yes" : "NO"}`);
  if (!billedToPlan || !isolated) process.exitCode = 1;
};

const review = async (modelArg?: string) => {
  const model = isCoachModel(modelArg) ? modelArg : DEFAULT_COACH_MODEL;
  const game = new Chess();
  game.loadPgn(TRAP_PGN);
  const packet = buildReviewPacket({ game, gameEval: trapEval(), userSide: "w" });

  const started = Date.now();
  const result = await runReview(packet, game.history(), { model });
  console.log(JSON.stringify(result, null, 2));
  console.log(`\n${model}: $${result.costUsd.toFixed(4)} in ${((Date.now() - started) / 1000).toFixed(1)}s`);

  const unverified = result.review.moments.filter((m) => m.unverified);
  console.log(`unverified moments: ${unverified.length}/${result.review.moments.length}`);
};

const main = async () => {
  const [mode, arg] = process.argv.slice(2);
  if (mode === "--ping") return ping(arg);
  if (mode === "--review") return review(arg);
  console.error("usage: npx tsx scripts/coach-smoke.ts --ping|--review [model]");
  process.exitCode = 2;
};

main().catch((error) => {
  if (error instanceof CoachRunError) {
    console.error(`CoachRunError[${error.code}]: ${error.message}`);
  } else {
    console.error(error);
  }
  process.exitCode = 1;
});

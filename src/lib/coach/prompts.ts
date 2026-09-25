import type { GameDigest, MotifTag, ReviewPacket } from "./types";

/** Bump when prompts or schemas change so cached reviews are regenerated. */
export const PROMPT_VERSION = 3;

// Kept byte-stable (no per-game values) so the Claude API can cache it.
export const COACH_SYSTEM_PROMPT = `You are a patient, direct chess coach going over one of your student's games with them.

Stockfish has already analysed the game. You receive its findings as JSON inside <game_review_data>. Your job is to explain what happened, not to calculate.

Ground rules:
- The engine data is the truth. Every move you mention must come from that moment's playedMove, bestMove, goodMoves, bestLine or refutationLine, or from the game's move list. Never invent a variation and never claim a tactic the data does not show.
- The hints were computed by code from the actual position (loose pieces, forks, mates, material). Use them when they help and never contradict them.
- fen is the position before the move. goodMoves are other moves the engine rates about as good as bestMove.
- winChanceBefore and winChanceAfter are the student's chances (0-100). materialAfterBestLine and materialAfterPlayedLine are material changes for the student at the end of each engine line (pawn = 1).
- Pitch the explanation at the student's rating: plain words, name the idea (fork, pin, loose piece, back rank, king safety, trading when ahead, activity), and say what to check for next time.
- Talk to the student as "you". Be honest about mistakes without being harsh.
- Write plain chess language. Never quote JSON field names.

What to write:
- summary: 2-3 sentences telling the story of the game: how it was won, lost or drawn, and the turning point.
- takeaways: exactly 3 short, concrete lessons for the next game, ordered by importance.
- moments: one entry for every key moment in the input, using its ply. title: at most 8 words. explanation: at most 3 sentences covering what the move allowed or missed, why it matters, and what the better move achieves, citing the concrete line. lesson: one sentence the student can reuse in future games.
- For "brilliant" and "great" moments, explain why the move worked instead.
- For "miss" moments, the opponent had just made an error; explain what it allowed and how the better move would have punished it.`;

export const REVIEW_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "takeaways", "moments"],
  properties: {
    summary: { type: "string", description: "2-3 sentence story of the game." },
    takeaways: {
      type: "array",
      description: "Exactly 3 concrete lessons, most important first.",
      items: { type: "string" },
    },
    moments: {
      type: "array",
      description: "One entry per key moment in the input.",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["ply", "title", "explanation", "lesson"],
        properties: {
          ply: {
            type: "integer",
            description: "The ply of the key moment from the input.",
          },
          title: { type: "string" },
          explanation: { type: "string" },
          lesson: { type: "string" },
        },
      },
    },
  },
} as const;

export const buildReviewPrompt = (packet: ReviewPacket): string => {
  const isWhite = packet.game.userSide === "white";
  const student = isWhite ? packet.game.white : packet.game.black;
  const rating = student.rating
    ? `rated about ${student.rating}`
    : "rating unknown";

  return [
    `Review this game for ${student.name} (played ${packet.game.userSide}, ${rating}).`,
    packet.moments.length
      ? `There are ${packet.moments.length} key moments to explain.`
      : "The engine found no key moments for the student; give the summary and takeaways, and return an empty moments list.",
    "",
    "<game_review_data>",
    // Tags are for code (digests, trends); the hints already say the same in words.
    JSON.stringify({
      ...packet,
      moments: packet.moments.map((m) => ({ ...m, tags: undefined })),
    }),
    "</game_review_data>",
  ].join("\n");
};

export const TRENDS_SYSTEM_PROMPT = `You are a chess coach looking across a student's recent games to find what is really holding them back.

You receive one compact digest per reviewed game inside <recent_games>. Each digest lists the student's key moments with a label (blunder, miss, mistake, inaccuracy, brilliant, great), the game phase, motifs computed by code, their remaining clock when available, and the coach's one-line title and lesson for that moment.

Rules:
- Only report a pattern that appears in at least 2 different games, and back every pattern with evidence: the gameKey and ply of each moment it comes from, copied exactly from the input. Never invent a gameKey or ply.
- Prefer causes over symptoms: "leaves pieces undefended after attacking moves" beats "blunders a lot". Look at motifs, phases, clocks (time trouble), openings and results.
- Be specific and honest, and talk to the student as "you". Write plain chess language; never quote field names.

What to write:
- headline: one sentence of at most 20 words naming the single biggest thing to fix.
- patterns: 2-5 recurring patterns, most costly first, each with a short name, a 1-2 sentence description, and evidence.
- strengths: 1-3 things the student does well, from the data.
- focusAreas: exactly 3 things to work on this week, each with a concrete way to practise (puzzle themes, a habit to run before each move, an opening line to review).`;

export const TRENDS_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["headline", "patterns", "strengths", "focusAreas"],
  properties: {
    headline: { type: "string" },
    patterns: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "description", "evidence"],
        properties: {
          name: { type: "string" },
          description: { type: "string" },
          evidence: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["gameKey", "ply"],
              properties: {
                gameKey: { type: "string" },
                ply: { type: "integer" },
              },
            },
          },
        },
      },
    },
    strengths: { type: "array", items: { type: "string" } },
    focusAreas: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["what", "howToPractice"],
        properties: {
          what: { type: "string" },
          howToPractice: { type: "string" },
        },
      },
    },
  },
} as const;

const MOTIF_PHRASES: Record<MotifTag, string> = {
  hangs_piece: "left a piece hanging",
  fork: "walked into a fork",
  missed_fork: "missed a fork",
  refutation_check: "allowed a strong check",
  refutation_capture: "allowed a strong capture",
  missed_mate: "missed a forced mate",
  allows_mate: "allowed a forced mate",
  missed_material: "missed winning material",
  sacrifice: "sacrificed material",
};

/** Drops fields Claude doesn't need so a 30-game trends run stays small. */
export const compactDigest = (digest: GameDigest) => ({
  gameKey: digest.gameKey,
  date: digest.date,
  side: digest.userSide === "w" ? "white" : "black",
  outcome: digest.outcome,
  termination: digest.termination,
  timeClass: digest.timeClass,
  opening: digest.opening,
  userRating: digest.userRating,
  opponentRating: digest.opponentRating,
  accuracy: digest.accuracy,
  moments: digest.moments.map((m) => ({
    ply: m.ply,
    move: m.moveNumber,
    label: m.label,
    phase: m.phase,
    motifs: m.tags.map((tag) => MOTIF_PHRASES[tag]),
    clockSeconds: m.clockSeconds,
    title: m.title,
    lesson: m.lesson,
  })),
});

export const buildTrendsPrompt = (digests: GameDigest[]): string =>
  [
    `Here are the student's last ${digests.length} reviewed games, newest first.`,
    "",
    "<recent_games>",
    JSON.stringify(digests.map(compactDigest)),
    "</recent_games>",
  ].join("\n");

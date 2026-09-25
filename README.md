# Chess Coach

Free chess.com-style game review with a coach that explains your mistakes.
You import your chess.com (or lichess) games, Stockfish grades every move in
your browser, and Claude explains what went wrong and what the better idea was.

Built on [Chesskit](https://github.com/GuillaumeSD/Chesskit) by GuillaumeSD,
which provides the board, the in-browser Stockfish, game import, move
classification (Brilliant, Great, Best … Mistake, Blunder), accuracy and the
eval graph. This fork adds the coach.

**Stockfish decides what happened; Claude only explains it.** Claude never
calculates. It receives the engine's lines plus tactical facts computed by
code (hanging pieces, forks, missed mates), and any move it mentions that isn't
in that data is flagged as "unverified" in the UI.

## What it does

- **Coach tab** on the analysis page: a short story of the game, three
  takeaways, and an explanation for each of your blunders, mistakes, missed
  chances and brilliant moves. Click one to jump the board there. Stepping
  through moves shows the coach's note under the move.
- **Practise mistakes** (`/retry`): replays the position before each of your
  errors. Find a move the engine likes (best move, a near-equal alternative, or
  anything Stockfish confirms keeps you within 5% winning chances).
- **Trends** (`/trends`): batch-review your latest chess.com games, see where
  your errors happen (opening / middlegame / endgame, time trouble), and have
  Claude find the patterns across games, with links to every example.

## How Claude is connected

The coach runs on **your own Claude plan** through the
[Claude Agent SDK](https://code.claude.com/docs/en/agent-sdk/overview), using the
Claude Code login on this computer. Pro and Max plans include a monthly Agent SDK
credit that this spends from. There is no API key and nothing to pay separately.

Because of that, this is a **personal, local app**: the server only listens on
`127.0.0.1` and refuses requests from other devices or other websites. Anyone
who clones it uses their own Claude login.

Each call is isolated: no tools, no MCP connectors, none of your `~/.claude`
settings, hooks or CLAUDE.md, and a spending cap per run ($0.50 per game review,
$1.50 per trends run).

Measured cost on Claude Opus 5 (September 2026): about **4–8¢ per game review**
and about **7¢ for a trends run over 3 games**. Pick Sonnet 5 or Haiku 4.5 in the
Coach tab to spend less.

## Setup

Needs Node.js 22+ and [Claude Code](https://code.claude.com) logged in with
your Claude account.

```bash
claude            # once: run /login with your Pro or Max account, then exit
npm install
npm run app       # builds on first run, starts on 127.0.0.1:3000, opens the browser
```

You don't need an `ANTHROPIC_API_KEY`. If one is set in your shell, the coach
ignores it so billing always goes to your plan.

If the coach says your limit is used up, check your plan's Agent SDK credit in
your Claude account settings.

## Everyday use

1. Open the app, click **Load game**, pick **Chess.com**, type your username and
   pick a game. Stockfish analyses it automatically (about a minute).
2. Open **Coach** (a tab on small screens, a toggle next to Moves on large
   ones) and press **Review with Claude**.
3. Press **Practise mistakes**, or open **Trends** from the menu after a few
   reviewed games.

Reviews, digests and trend reports are stored in your browser (IndexedDB), so
reopening a reviewed game costs nothing.

## Development

```bash
npm run dev            # dev server on 127.0.0.1:3000
npm test               # unit tests for the coach logic (vitest)
npm run test:coverage
npm run lint           # eslint + tsc
npm run test:e2e       # Playwright, Claude mocked (free)
npm run test:e2e:live  # Playwright, real chess.com + Claude (spends a few cents)
npx tsx scripts/coach-smoke.ts --ping     # prove the Claude link bills your plan
npx tsx scripts/coach-smoke.ts --review   # full coach review of a fixture game
```

The coach code lives in its own directories so upstream Chesskit updates can
still be merged (`git fetch upstream && git merge upstream/main`):

- `src/lib/coach/`: key-moment selection, tactical facts, review packets,
  prompts, output validation, digests, retry logic, IndexedDB storage
- `src/lib/coach/server/`: the Agent SDK runner and API-route guards (server only)
- `src/pages/api/coach/`: `review` and `trends` routes
- `src/sections/analysis/panelBody/coachTab/`, `src/sections/retry/`, `src/sections/trends/`

Changes to upstream files are small: the Coach tab wiring on the analysis page,
two menu entries, stubbed-out Sentry/Firebase, local-only `next.config.ts`, a
default engine depth of 16, and a fix for a race where live-position analysis
could cancel a full-game analysis and freeze it at 97%.

## License

Like Chesskit, this is licensed under the GNU Affero General Public License 3.
See [copying](COPYING.md). Chesskit is © GuillaumeSD and contributors.

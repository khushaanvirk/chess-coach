import { useMemo } from "react";
import { useAtomValue } from "jotai";
import NextLink from "next/link";
import {
  Alert,
  Box,
  Button,
  Grid2 as Grid,
  LinearProgress,
  Stack,
  Typography,
} from "@mui/material";
import Board from "@/components/board";
import { useScreenSize } from "@/hooks/useScreenSize";
import { Color } from "@/types/enums";
import LabelBadge from "@/sections/analysis/panelBody/coachTab/labelBadge";
import {
  retryBoardAtom,
  retryPositionAtom,
  useRetryTrainer,
  type AttemptState,
} from "./useRetryTrainer";
import type { Drill } from "@/lib/coach/retry";

interface Props {
  gameKey?: string;
}

const sideName = (drill: Drill) => (drill.userSide === "w" ? "White" : "Black");

const feedback = (
  attempt: AttemptState,
  drill: Drill
): { severity: "success" | "info" | "warning"; text: string } | null => {
  const best = drill.moment.bestMove;
  switch (attempt.kind) {
    case "best":
      return {
        severity: "success",
        text: `${attempt.san} is the engine's top move. Nicely found.`,
      };
    case "good":
      return {
        severity: "success",
        text:
          best && attempt.san !== best
            ? `${attempt.san} works. The engine's first choice was ${best}.`
            : `${attempt.san} works.`,
      };
    case "played":
      return {
        severity: "warning",
        text: `${attempt.san} is what you played in the game. Look for something better.`,
      };
    case "wrong":
      return {
        severity: "warning",
        text:
          attempt.winChance !== undefined
            ? `${attempt.san} leaves you with about ${Math.round(attempt.winChance)}% winning chances (best play keeps about ${Math.round(drill.moment.winChanceBefore)}%). Try again or show the answer.`
            : `${attempt.san} isn't it. Try again or show the answer.`,
      };
    case "checking":
      return {
        severity: "info",
        text: `Checking ${attempt.san} with Stockfish…`,
      };
    default:
      return null;
  }
};

export default function RetryTrainer({ gameKey }: Props) {
  const trainer = useRetryTrainer(gameKey);
  const board = useAtomValue(retryBoardAtom);
  const screenSize = useScreenSize();
  const { drill, attempt } = trainer;

  const boardSize = useMemo(() => {
    if (window?.innerWidth < 1200)
      return Math.min(screenSize.width, screenSize.height - 150);
    return Math.min(screenSize.width - 700, screenSize.height * 0.9);
  }, [screenSize]);

  if (trainer.loading) {
    return <LinearProgress sx={{ marginTop: 4 }} />;
  }

  if (!trainer.drills.length) {
    return (
      <Stack alignItems="center" rowGap={2} marginTop={6}>
        <Typography variant="h5">Nothing to practise yet</Typography>
        <Typography color="text.secondary" textAlign="center" maxWidth="30rem">
          Review a game with the coach first. Your blunders, mistakes and missed
          chances land here.
        </Typography>
        <Button variant="contained" component={NextLink} href="/">
          Go to analysis
        </Button>
      </Stack>
    );
  }

  if (trainer.finished || !drill) {
    return (
      <Stack alignItems="center" rowGap={2} marginTop={6}>
        <Typography variant="h5">Session done</Typography>
        <Typography color="text.secondary">
          You found a good move on the first try in {trainer.solvedFirstTry} of{" "}
          {trainer.drills.length} positions.
        </Typography>
        <Stack direction="row" columnGap={1.5}>
          <Button variant="contained" onClick={trainer.restart}>
            Go again
          </Button>
          <Button variant="outlined" component={NextLink} href="/trends">
            See your trends
          </Button>
        </Stack>
      </Stack>
    );
  }

  const solved = attempt.kind === "best" || attempt.kind === "good";
  const canMove = attempt.kind === "waiting" && board.history().length === 0;
  const message = feedback(attempt, drill);
  const moment = drill.moment;
  const userColor = drill.userSide === "w" ? Color.White : Color.Black;

  return (
    <Grid container gap={4} justifyContent="space-evenly" alignItems="start">
      <Board
        id="RetryBoard"
        boardSize={boardSize}
        canPlay={canMove ? userColor : false}
        gameAtom={retryBoardAtom}
        whitePlayer={{ name: drill.userSide === "w" ? "You" : "Opponent" }}
        blackPlayer={{ name: drill.userSide === "b" ? "You" : "Opponent" }}
        boardOrientation={userColor}
        currentPositionAtom={retryPositionAtom}
        showBestMoveArrow={attempt.kind === "revealed"}
      />

      <Stack
        component="section"
        aria-label="Practice"
        rowGap={2.5}
        padding={3}
        borderRadius={2}
        sx={{
          backgroundColor: "secondary.main",
          width: { xs: "100%", lg: "auto" },
          maxWidth: 560,
          flex: 1,
          minWidth: { lg: 380 },
        }}
      >
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="baseline"
        >
          <Typography variant="h6" component="h1">
            Practise your mistakes
          </Typography>
          <Typography color="text.secondary" fontSize="0.85rem">
            {trainer.index + 1} of {trainer.drills.length}
          </Typography>
        </Stack>
        <LinearProgress
          variant="determinate"
          value={(trainer.index / trainer.drills.length) * 100}
        />

        <Box>
          <LabelBadge label={moment.label} />
          <Typography fontSize="1.05rem" marginTop={1}>
            Move {moment.moveNumber.replace(/\.+$/, "")} as {sideName(drill)}.
            In the game you played <strong>{moment.playedMove}</strong>. Find a
            better move.
          </Typography>
        </Box>

        {attempt.kind === "waiting" && (
          <Typography color="text.secondary" fontSize="0.9rem">
            Make your move on the board.
          </Typography>
        )}

        {message && (
          <Alert severity={message.severity} role="status">
            {message.text}
          </Alert>
        )}

        {(solved || attempt.kind === "revealed") && (
          <Box sx={{ borderLeft: "3px solid #3B9AC6", paddingLeft: 1.5 }}>
            {attempt.kind === "revealed" && moment.bestMove && (
              <Typography fontSize="0.9rem" marginBottom={0.5}>
                The engine&apos;s move: <strong>{moment.bestMove}</strong>{" "}
                (arrow on the board).
              </Typography>
            )}
            <Typography fontWeight={600} fontSize="0.95rem">
              {moment.title}
            </Typography>
            <Typography fontSize="0.875rem" lineHeight={1.55} marginTop={0.5}>
              {moment.explanation}
            </Typography>
            {moment.lesson && (
              <Typography
                fontSize="0.825rem"
                color="text.secondary"
                fontStyle="italic"
                marginTop={0.75}
              >
                {moment.lesson}
              </Typography>
            )}
          </Box>
        )}

        <Stack direction="row" columnGap={1.5} flexWrap="wrap" rowGap={1}>
          {(attempt.kind === "played" || attempt.kind === "wrong") && (
            <Button variant="outlined" onClick={trainer.retry}>
              Try again
            </Button>
          )}
          {!solved &&
            attempt.kind !== "revealed" &&
            attempt.kind !== "checking" && (
              <Button onClick={trainer.reveal}>Show answer</Button>
            )}
          {(solved || attempt.kind === "revealed") && (
            <Button variant="contained" onClick={trainer.next}>
              {trainer.index + 1 === trainer.drills.length
                ? "Finish"
                : "Next position"}
            </Button>
          )}
        </Stack>
      </Stack>
    </Grid>
  );
}

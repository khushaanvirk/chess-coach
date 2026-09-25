import {
  Alert,
  Button,
  CircularProgress,
  Grid2 as Grid,
  Grid2Props as GridProps,
  Stack,
  Typography,
} from "@mui/material";
import { Icon } from "@iconify/react";
import NextLink from "next/link";
import { COACH_MODELS } from "@/lib/coach/models";
import KeyMomentList from "./keyMomentList";
import ModelSelect from "./modelSelect";
import SummaryCard from "./summaryCard";
import { useCoachReview } from "./useCoachReview";
import { useJumpToPly } from "./useJumpToPly";

const PRACTICE_LABELS = new Set(["blunder", "mistake", "miss"]);

export default function CoachTab(props: GridProps) {
  const coach = useCoachReview();
  useJumpToPly();
  const { review, status } = coach;
  const isRunning = status === "running";

  const practiceCount =
    review?.moments.filter((m) => PRACTICE_LABELS.has(m.label)).length ?? 0;

  return (
    <Grid
      container
      size={12}
      flexGrow={1}
      alignContent="start"
      rowGap={2}
      paddingX={{ xs: 1, lg: "calc(4% - 1rem)" }}
      {...props}
      sx={
        props.hidden ? { display: "none" } : { overflowY: "auto", ...props.sx }
      }
    >
      {coach.unsupportedReason && (
        <Alert severity="info" sx={{ width: "100%" }}>
          {coach.unsupportedReason}
        </Alert>
      )}

      {!coach.canReview && !coach.unsupportedReason && (
        <Typography
          color="text.secondary"
          fontSize="0.9rem"
          width="100%"
          textAlign="center"
        >
          Load a game and let the engine finish analysing it. Then Claude can
          review it.
        </Typography>
      )}

      {status === "error" && coach.error && (
        <Alert
          severity="error"
          sx={{ width: "100%" }}
          action={
            <Button
              color="inherit"
              size="small"
              onClick={() => coach.runReview()}
            >
              Retry
            </Button>
          }
        >
          {coach.error}
        </Alert>
      )}

      {status === "needs-side" && (
        <Stack width="100%" alignItems="center" rowGap={1.5}>
          <Typography fontSize="0.95rem">
            Which side were you playing?
          </Typography>
          <Stack direction="row" columnGap={1.5}>
            <Button variant="outlined" onClick={() => coach.runReview("w")}>
              White
            </Button>
            <Button variant="outlined" onClick={() => coach.runReview("b")}>
              Black
            </Button>
          </Stack>
        </Stack>
      )}

      {isRunning && (
        <Stack
          width="100%"
          alignItems="center"
          rowGap={1.5}
          paddingY={3}
          role="status"
        >
          <CircularProgress size={28} />
          <Typography fontSize="0.95rem">
            Claude is going over your game…
          </Typography>
          <Typography fontSize="0.8rem" color="text.secondary">
            Usually 15 to 45 seconds.
          </Typography>
          <Button size="small" onClick={coach.cancel}>
            Cancel
          </Button>
        </Stack>
      )}

      {coach.canReview && !review && !isRunning && status !== "needs-side" && (
        <Stack width="100%" alignItems="center" rowGap={2} paddingY={2}>
          <Typography fontSize="0.95rem" textAlign="center" maxWidth="32rem">
            Claude explains your key mistakes and best moves using
            Stockfish&apos;s lines, then sums up what to work on. It runs on
            your Claude plan, usually a few cents of credit.
          </Typography>
          <Stack
            direction="row"
            columnGap={1.5}
            alignItems="center"
            flexWrap="wrap"
            rowGap={1.5}
          >
            <ModelSelect />
            <Button
              variant="contained"
              startIcon={<Icon icon="mdi:school-outline" />}
              onClick={() => coach.runReview()}
            >
              Review with Claude
            </Button>
          </Stack>
        </Stack>
      )}

      {review && !isRunning && (
        <Stack width="100%" rowGap={2} paddingBottom={2}>
          <SummaryCard review={review} />
          <KeyMomentList moments={review.moments} />

          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            flexWrap="wrap"
            rowGap={1}
          >
            <Typography fontSize="0.75rem" color="text.secondary">
              {COACH_MODELS[review.model].label} · ${review.costUsd.toFixed(3)}{" "}
              of plan credit · engine depth {review.engine.depth}
            </Typography>
            <Stack direction="row" columnGap={1}>
              {practiceCount > 0 && coach.gameKey && (
                <Button
                  size="small"
                  variant="outlined"
                  component={NextLink}
                  href={`/retry?gameKey=${encodeURIComponent(coach.gameKey)}`}
                  startIcon={<Icon icon="mdi:target" />}
                >
                  Practice {practiceCount}{" "}
                  {practiceCount === 1 ? "mistake" : "mistakes"}
                </Button>
              )}
              <Button size="small" onClick={() => coach.runReview()}>
                Regenerate
              </Button>
            </Stack>
          </Stack>
        </Stack>
      )}
    </Grid>
  );
}

import { useState } from "react";
import {
  Alert,
  Button,
  LinearProgress,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { getKnownUsernames } from "@/lib/coach/states";
import type { BatchItem, BatchReview } from "./useBatchReview";

interface Props {
  batch: BatchReview;
}

const BATCH_SIZES = [3, 5, 10, 20];

const STATUS_TEXT: Record<BatchItem["status"], string> = {
  queued: "Waiting",
  analysing: "Stockfish analysing",
  reviewing: "Claude reviewing",
  done: "Reviewed",
  error: "Failed",
};

export default function BatchPanel({ batch }: Props) {
  const [username, setUsername] = useState(() => getKnownUsernames()[0] ?? "");
  const [count, setCount] = useState(5);

  return (
    <Stack component="section" aria-label="Review recent games" rowGap={2}>
      <Typography variant="h6" component="h2">
        Review your recent games
      </Typography>
      <Typography fontSize="0.875rem" color="text.secondary" maxWidth="40rem">
        Pulls your latest chess.com games, runs Stockfish on each, then has
        Claude review them. Takes a minute or two per game and a few cents of
        plan credit each. Games you already reviewed are skipped.
      </Typography>

      <Stack
        direction="row"
        columnGap={1.5}
        rowGap={1.5}
        flexWrap="wrap"
        alignItems="center"
      >
        <TextField
          size="small"
          label="Chess.com username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          disabled={batch.running}
        />
        <TextField
          select
          size="small"
          label="Games"
          value={count}
          onChange={(e) => setCount(Number(e.target.value))}
          disabled={batch.running}
          sx={{ minWidth: 90 }}
        >
          {BATCH_SIZES.map((n) => (
            <MenuItem key={n} value={n}>
              {n}
            </MenuItem>
          ))}
        </TextField>
        {batch.running ? (
          <Button variant="outlined" onClick={batch.cancel}>
            Stop
          </Button>
        ) : (
          <Button
            variant="contained"
            disabled={!username.trim() || !batch.engineReady}
            onClick={() => batch.start(username, count)}
          >
            {batch.engineReady ? `Review my last ${count}` : "Loading engine…"}
          </Button>
        )}
      </Stack>

      {batch.notice && <Alert severity="info">{batch.notice}</Alert>}

      {batch.items.length > 0 && (
        <Stack
          component="ol"
          rowGap={1}
          sx={{ listStyle: "none", padding: 0, margin: 0 }}
        >
          {batch.items.map((item) => (
            <Stack component="li" key={item.gameKey} rowGap={0.5}>
              <Stack
                direction="row"
                justifyContent="space-between"
                columnGap={2}
              >
                <Typography fontSize="0.875rem">{item.title}</Typography>
                <Typography
                  fontSize="0.8rem"
                  color={
                    item.status === "error" ? "error.main" : "text.secondary"
                  }
                >
                  {STATUS_TEXT[item.status]}
                  {item.message ? ` · ${item.message}` : ""}
                </Typography>
              </Stack>
              {(item.status === "analysing" || item.status === "reviewing") && (
                <LinearProgress
                  variant={
                    item.status === "analysing"
                      ? "determinate"
                      : "indeterminate"
                  }
                  value={item.progress}
                />
              )}
            </Stack>
          ))}
        </Stack>
      )}
    </Stack>
  );
}

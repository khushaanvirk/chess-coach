import { useState } from "react";
import NextLink from "next/link";
import {
  Alert,
  Button,
  CircularProgress,
  Divider,
  LinearProgress,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { Icon } from "@iconify/react";
import ModelSelect from "@/sections/analysis/panelBody/coachTab/modelSelect";
import BatchPanel from "./batchPanel";
import ReportView from "./reportView";
import StatsRow from "./statsRow";
import { useBatchReview } from "./useBatchReview";
import { MIN_GAMES_FOR_TRENDS, useTrendsReport } from "./useTrendsReport";

const WINDOW_SIZES = [5, 10, 20, 30];

export default function TrendsView() {
  const trends = useTrendsReport();
  const batch = useBatchReview(() => void trends.reload());
  const [lastN, setLastN] = useState(10);

  if (trends.loading) return <LinearProgress sx={{ marginTop: 4 }} />;

  const available = trends.digests.length;
  const windowSize = Math.min(lastN, available);
  const canAnalyse =
    available >= MIN_GAMES_FOR_TRENDS && !trends.running && !batch.running;

  return (
    <Stack
      maxWidth={1100}
      marginX="auto"
      paddingX={{ xs: 1, md: 3 }}
      paddingY={3}
      rowGap={4}
    >
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="end"
        flexWrap="wrap"
        rowGap={2}
      >
        <Stack rowGap={0.5}>
          <Typography variant="h4" component="h1" fontWeight={600}>
            Your trends
          </Typography>
          <Typography color="text.secondary" fontSize="0.9rem">
            What keeps showing up across your reviewed games.
          </Typography>
        </Stack>
        <Button
          variant="outlined"
          component={NextLink}
          href="/retry"
          startIcon={<Icon icon="mdi:target" />}
        >
          Practise recent mistakes
        </Button>
      </Stack>

      {available > 0 && <StatsRow digests={trends.digests} />}

      <Divider />
      <BatchPanel batch={batch} />
      <Divider />

      <Stack component="section" aria-label="Find patterns" rowGap={2}>
        <Typography variant="h6" component="h2">
          Find your patterns
        </Typography>
        {available < MIN_GAMES_FOR_TRENDS ? (
          <Typography fontSize="0.9rem" color="text.secondary">
            Review at least {MIN_GAMES_FOR_TRENDS} games (above, or one at a
            time from the analysis page) and Claude can look for what they have
            in common.
          </Typography>
        ) : (
          <Stack
            direction="row"
            columnGap={1.5}
            rowGap={1.5}
            flexWrap="wrap"
            alignItems="center"
          >
            <TextField
              select
              size="small"
              label="Look at"
              value={windowSize}
              onChange={(e) => setLastN(Number(e.target.value))}
              sx={{ minWidth: 150 }}
            >
              {[
                ...new Set([
                  ...WINDOW_SIZES.filter((n) => n < available),
                  available,
                ]),
              ].map((n) => (
                <MenuItem key={n} value={n}>
                  last {n} games
                </MenuItem>
              ))}
            </TextField>
            <ModelSelect disabled={trends.running} />
            <Button
              variant="contained"
              disabled={!canAnalyse}
              onClick={() => trends.analyse(windowSize)}
            >
              {trends.report ? "Refresh patterns" : "Find my patterns"}
            </Button>
          </Stack>
        )}

        {trends.running && (
          <Stack
            direction="row"
            columnGap={1.5}
            alignItems="center"
            role="status"
          >
            <CircularProgress size={20} />
            <Typography fontSize="0.9rem">
              Claude is reading your last {windowSize} games…
            </Typography>
            <Button size="small" onClick={trends.cancel}>
              Cancel
            </Button>
          </Stack>
        )}
        {trends.error && <Alert severity="error">{trends.error}</Alert>}
      </Stack>

      {trends.report && !trends.running && (
        <ReportView report={trends.report} digests={trends.digests} />
      )}
    </Stack>
  );
}

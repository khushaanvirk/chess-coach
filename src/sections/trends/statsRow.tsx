import { Box, Stack, Typography } from "@mui/material";
import { summarizeDigests, TIME_TROUBLE_SECONDS } from "@/lib/coach/digest";
import type { GameDigest, GamePhase } from "@/lib/coach/types";

interface Props {
  digests: GameDigest[];
}

const PHASE_COLORS: Record<GamePhase, string> = {
  opening: "#dbac86",
  middlegame: "#3B9AC6",
  endgame: "#9b7fd4",
};

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Box minWidth={110}>
      <Typography fontSize="1.6rem" fontWeight={600} lineHeight={1.2}>
        {value}
      </Typography>
      <Typography
        fontSize="0.75rem"
        color="text.secondary"
        textTransform="uppercase"
        letterSpacing="0.06em"
      >
        {label}
      </Typography>
    </Box>
  );
}

export default function StatsRow({ digests }: Props) {
  const stats = summarizeDigests(digests);
  const phases = Object.entries(stats.errorPhases) as [GamePhase, number][];
  const totalErrors = phases.reduce((sum, [, n]) => sum + n, 0);

  return (
    <Stack component="section" aria-label="Stats" rowGap={2.5}>
      <Stack direction="row" flexWrap="wrap" columnGap={4} rowGap={2}>
        <Stat label="Games reviewed" value={`${stats.games}`} />
        <Stat
          label="Won · lost · drawn"
          value={`${stats.record.win}·${stats.record.loss}·${stats.record.draw}`}
        />
        <Stat label="Avg accuracy" value={`${stats.averageAccuracy}%`} />
        <Stat label="Errors per game" value={`${stats.errorsPerGame}`} />
        <Stat
          label={`Errors under ${TIME_TROUBLE_SECONDS}s`}
          value={`${stats.timeTroubleErrors}`}
        />
      </Stack>

      {totalErrors > 0 && (
        <Box>
          <Typography
            fontSize="0.8rem"
            color="text.secondary"
            marginBottom={0.75}
          >
            Where your blunders, mistakes and misses happen
          </Typography>
          <Stack
            direction="row"
            height={10}
            borderRadius={5}
            overflow="hidden"
            role="img"
            aria-label={phases.map(([p, n]) => `${p} ${n}`).join(", ")}
          >
            {phases
              .filter(([, n]) => n > 0)
              .map(([phase, n]) => (
                <Box
                  key={phase}
                  sx={{
                    width: `${(n / totalErrors) * 100}%`,
                    backgroundColor: PHASE_COLORS[phase],
                  }}
                />
              ))}
          </Stack>
          <Stack
            direction="row"
            columnGap={2.5}
            marginTop={0.75}
            flexWrap="wrap"
          >
            {phases.map(([phase, n]) => (
              <Stack
                key={phase}
                direction="row"
                alignItems="center"
                columnGap={0.75}
              >
                <Box
                  sx={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    backgroundColor: PHASE_COLORS[phase],
                  }}
                />
                <Typography fontSize="0.8rem" textTransform="capitalize">
                  {phase} {Math.round((n / totalErrors) * 100)}%
                </Typography>
              </Stack>
            ))}
          </Stack>
        </Box>
      )}
    </Stack>
  );
}

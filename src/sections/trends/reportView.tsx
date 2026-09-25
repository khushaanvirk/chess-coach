import { Box, Chip, Stack, Typography } from "@mui/material";
import NextLink from "next/link";
import { COACH_MODELS } from "@/lib/coach/models";
import type { GameDigest, TrendsReport } from "@/lib/coach/types";

interface Props {
  report: TrendsReport;
  digests: GameDigest[];
}

const LONG_HEADLINE = 90;

const evidenceLabel = (digest: GameDigest | undefined, ply: number): string => {
  const moment = digest?.moments.find((m) => m.ply === ply);
  const opponent = digest ? `vs ${digest.opponentName}` : "game";
  return moment
    ? `${opponent} · ${moment.moveNumber} ${moment.label}`
    : opponent;
};

export default function ReportView({ report, digests }: Props) {
  const byKey = new Map(digests.map((d) => [d.gameKey, d]));

  return (
    <Stack component="section" aria-label="Trends report" rowGap={3}>
      <Typography
        variant={report.headline.length > LONG_HEADLINE ? "h5" : "h4"}
        component="h2"
        fontWeight={600}
        lineHeight={1.25}
        maxWidth="48rem"
      >
        {report.headline}
      </Typography>

      <Stack rowGap={2}>
        {report.patterns.map((pattern) => (
          <Box
            key={pattern.name}
            component="article"
            sx={{
              borderLeft: "3px solid #df5353",
              paddingLeft: 2,
              paddingY: 0.5,
            }}
          >
            <Typography fontWeight={600} fontSize="1.05rem">
              {pattern.name}
            </Typography>
            <Typography fontSize="0.9rem" lineHeight={1.55} marginTop={0.5}>
              {pattern.description}
            </Typography>
            <Stack direction="row" flexWrap="wrap" gap={0.75} marginTop={1}>
              {pattern.evidence.map(({ gameKey, ply }) => {
                const digest = byKey.get(gameKey);
                const label = evidenceLabel(digest, ply);
                return digest?.gameId !== undefined ? (
                  <Chip
                    key={`${gameKey}#${ply}`}
                    size="small"
                    variant="outlined"
                    clickable
                    component={NextLink}
                    href={`/?gameId=${digest.gameId}&ply=${ply}`}
                    label={label}
                  />
                ) : (
                  <Chip
                    key={`${gameKey}#${ply}`}
                    size="small"
                    variant="outlined"
                    label={label}
                  />
                );
              })}
            </Stack>
          </Box>
        ))}
      </Stack>

      <Stack direction={{ xs: "column", md: "row" }} gap={4}>
        <Box flex={1}>
          <Typography variant="h6" component="h3" marginBottom={1}>
            Work on this week
          </Typography>
          <Stack
            component="ol"
            rowGap={1.5}
            sx={{ paddingLeft: 2.5, margin: 0 }}
          >
            {report.focusAreas.map((area) => (
              <Box component="li" key={area.what}>
                <Typography fontWeight={600} fontSize="0.95rem">
                  {area.what}
                </Typography>
                <Typography
                  fontSize="0.875rem"
                  color="text.secondary"
                  lineHeight={1.5}
                >
                  {area.howToPractice}
                </Typography>
              </Box>
            ))}
          </Stack>
        </Box>

        {report.strengths.length > 0 && (
          <Box flex={1}>
            <Typography variant="h6" component="h3" marginBottom={1}>
              What you do well
            </Typography>
            <Stack
              component="ul"
              rowGap={1}
              sx={{ paddingLeft: 2.5, margin: 0 }}
            >
              {report.strengths.map((strength) => (
                <Typography
                  component="li"
                  key={strength}
                  fontSize="0.9rem"
                  lineHeight={1.5}
                >
                  {strength}
                </Typography>
              ))}
            </Stack>
          </Box>
        )}
      </Stack>

      <Typography fontSize="0.75rem" color="text.secondary">
        {report.gameKeys.length} games · {COACH_MODELS[report.model].label} · $
        {report.costUsd.toFixed(3)} of plan credit ·{" "}
        {new Date(report.createdAt).toLocaleString()}
      </Typography>
    </Stack>
  );
}

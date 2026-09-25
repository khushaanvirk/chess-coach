import { Box, Stack, Typography } from "@mui/material";
import type { CoachReview } from "@/lib/coach/types";

interface Props {
  review: CoachReview;
}

export default function SummaryCard({ review }: Props) {
  return (
    <Box
      component="section"
      aria-label="Game summary"
      sx={{
        borderRadius: 2,
        padding: 2,
        backgroundColor: "rgba(59, 154, 198, 0.08)",
        borderLeft: "3px solid #3B9AC6",
      }}
    >
      <Typography fontSize="0.95rem" lineHeight={1.55}>
        {review.summary}
      </Typography>

      {review.takeaways.length > 0 && (
        <Stack
          component="ol"
          rowGap={0.75}
          sx={{ margin: "12px 0 0", paddingLeft: 2.5 }}
        >
          {review.takeaways.map((takeaway) => (
            <Typography
              component="li"
              key={takeaway}
              fontSize="0.875rem"
              lineHeight={1.5}
            >
              {takeaway}
            </Typography>
          ))}
        </Stack>
      )}
    </Box>
  );
}

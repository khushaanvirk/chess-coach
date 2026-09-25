import { Box, Typography } from "@mui/material";
import { useAtomValue } from "jotai";
import { currentCoachReviewAtom } from "@/lib/coach/states";
import { currentPositionAtom } from "@/sections/analysis/states";
import LabelBadge from "./labelBadge";
import { LABEL_META } from "./labels";

/** The coach's note for the move just played on the board, if it was a key moment. */
export default function CoachMoveNote() {
  const review = useAtomValue(currentCoachReviewAtom);
  const position = useAtomValue(currentPositionAtom);

  const ply = (position.currentMoveIdx ?? 0) - 1;
  const moment = review?.moments.find((m) => m.ply === ply);
  if (!moment) return null;

  return (
    <Box
      component="aside"
      aria-label="Coach note"
      sx={{
        maxWidth: "28rem",
        borderLeft: `3px solid ${LABEL_META[moment.label].color}`,
        paddingLeft: 1.5,
        paddingY: 0.5,
      }}
    >
      <LabelBadge label={moment.label} />
      <Typography fontWeight={600} fontSize="0.9rem" marginTop={0.5}>
        {moment.title}
      </Typography>
      <Typography fontSize="0.85rem" lineHeight={1.5} marginTop={0.25}>
        {moment.explanation}
      </Typography>
    </Box>
  );
}

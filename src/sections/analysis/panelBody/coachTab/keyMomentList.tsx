import { Box, ButtonBase, Stack, Tooltip, Typography } from "@mui/material";
import { useAtomValue } from "jotai";
import { useChessActions } from "@/hooks/useChessActions";
import {
  boardAtom,
  currentPositionAtom,
  gameAtom,
} from "@/sections/analysis/states";
import type { ReviewedMoment } from "@/lib/coach/types";
import LabelBadge from "./labelBadge";
import { LABEL_META } from "./labels";

interface Props {
  moments: ReviewedMoment[];
}

export default function KeyMomentList({ moments }: Props) {
  const game = useAtomValue(gameAtom);
  const position = useAtomValue(currentPositionAtom);
  const { goToMove } = useChessActions(boardAtom);

  if (moments.length === 0) {
    return (
      <Typography
        fontSize="0.9rem"
        color="text.secondary"
        textAlign="center"
        paddingY={2}
      >
        Clean game: no mistakes worth flagging on your side.
      </Typography>
    );
  }

  return (
    <Stack
      component="ol"
      rowGap={1}
      sx={{ listStyle: "none", margin: 0, padding: 0 }}
    >
      {moments.map((moment) => {
        const isCurrent = position.currentMoveIdx === moment.ply + 1;
        const color = LABEL_META[moment.label].color;

        return (
          <Box component="li" key={moment.ply}>
            <ButtonBase
              onClick={() => goToMove(moment.ply + 1, game)}
              aria-current={isCurrent ? "step" : undefined}
              sx={(theme) => ({
                display: "block",
                width: "100%",
                textAlign: "left",
                borderRadius: 2,
                padding: 1.5,
                borderLeft: `3px solid ${color}`,
                backgroundColor: isCurrent
                  ? theme.palette.mode === "dark"
                    ? "rgba(255,255,255,0.08)"
                    : "rgba(0,0,0,0.06)"
                  : "transparent",
                transition: "background-color 150ms ease-out",
                "&:hover": {
                  backgroundColor:
                    theme.palette.mode === "dark"
                      ? "rgba(255,255,255,0.05)"
                      : "rgba(0,0,0,0.04)",
                },
                "&:focus-visible": {
                  outline: `2px solid ${color}`,
                  outlineOffset: 2,
                },
              })}
            >
              <Stack
                direction="row"
                alignItems="center"
                columnGap={1.5}
                flexWrap="wrap"
              >
                <LabelBadge label={moment.label} />
                <Typography
                  component="span"
                  fontSize="0.85rem"
                  fontWeight={600}
                >
                  {moment.moveNumber}
                  {moment.playedMove}
                </Typography>
                {moment.bestMove && (
                  <Typography
                    component="span"
                    fontSize="0.8rem"
                    color="text.secondary"
                  >
                    best was <strong>{moment.bestMove}</strong>
                  </Typography>
                )}
                {moment.unverified && (
                  <Tooltip
                    title={`Mentions ${moment.unverifiedMoves.join(", ")}, which isn't in the engine's lines. Check it on the board.`}
                  >
                    <Typography
                      component="span"
                      fontSize="0.7rem"
                      sx={{
                        border: "1px solid",
                        borderColor: "warning.main",
                        color: "warning.main",
                        borderRadius: 1,
                        paddingX: 0.6,
                      }}
                    >
                      unverified
                    </Typography>
                  </Tooltip>
                )}
              </Stack>

              <Typography fontWeight={600} fontSize="0.95rem" marginTop={0.75}>
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
            </ButtonBase>
          </Box>
        );
      })}
    </Stack>
  );
}

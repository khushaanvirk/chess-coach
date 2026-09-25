import { Box, Stack, Typography } from "@mui/material";
import Image from "next/image";
import type { MomentLabel } from "@/lib/coach/types";
import { LABEL_META } from "./labels";

interface Props {
  label: MomentLabel;
  showText?: boolean;
}

export default function LabelBadge({ label, showText = true }: Props) {
  const meta = LABEL_META[label];

  return (
    <Stack direction="row" alignItems="center" columnGap={0.6} flexShrink={0}>
      {meta.icon ? (
        <Image src={meta.icon} alt="" width={16} height={16} />
      ) : (
        <Box
          aria-hidden
          sx={{
            width: 16,
            height: 16,
            borderRadius: "50%",
            backgroundColor: meta.color,
          }}
        />
      )}
      {showText && (
        <Typography
          component="span"
          fontSize="0.75rem"
          fontWeight={600}
          letterSpacing="0.02em"
          sx={{ color: meta.color, textTransform: "uppercase" }}
        >
          {meta.text}
        </Typography>
      )}
    </Stack>
  );
}

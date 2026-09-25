import { MenuItem, TextField } from "@mui/material";
import { useAtom } from "jotai";
import { COACH_MODELS, isCoachModel } from "@/lib/coach/models";
import { coachModelAtom } from "@/lib/coach/states";

interface Props {
  disabled?: boolean;
}

export default function ModelSelect({ disabled }: Props) {
  const [model, setModel] = useAtom(coachModelAtom);

  return (
    <TextField
      select
      size="small"
      label="Coach model"
      value={model}
      disabled={disabled}
      onChange={(event) => {
        if (isCoachModel(event.target.value)) setModel(event.target.value);
      }}
      sx={{ minWidth: 200 }}
    >
      {Object.entries(COACH_MODELS).map(([id, info]) => (
        <MenuItem key={id} value={id}>
          {info.label}
        </MenuItem>
      ))}
    </TextField>
  );
}

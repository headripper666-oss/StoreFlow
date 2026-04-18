import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import RadioButtonUncheckedIcon from "@mui/icons-material/RadioButtonUnchecked";
import { Box, ButtonBase, Typography } from "@mui/material";

interface CheckButtonProps {
  checked: boolean;
  label: string;
  sublabel?: string;
  onToggle: () => void;
  disabled?: boolean;
}

export function CheckButton({
  checked,
  label,
  sublabel,
  onToggle,
  disabled,
}: CheckButtonProps) {
  return (
    <ButtonBase
      onClick={onToggle}
      disabled={disabled}
      sx={{
        display: "flex",
        alignItems: "center",
        width: "100%",
        minHeight: 64,
        px: 2,
        py: 1,
        gap: 2,
        textAlign: "left",
        borderRadius: 0,
        transition: "background-color 0.15s",
        "&:active": { backgroundColor: "rgba(0,0,0,0.04)" },
        "&.Mui-disabled": { opacity: 0.5 },
      }}
    >
      {checked ? (
        <CheckCircleIcon
          sx={{
            color: "primary.main",
            fontSize: 32,
            flexShrink: 0,
            transition: "transform 0.15s",
          }}
        />
      ) : (
        <RadioButtonUncheckedIcon
          sx={{
            color: "text.disabled",
            fontSize: 32,
            flexShrink: 0,
          }}
        />
      )}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography
          variant="body1"
          sx={{
            fontWeight: checked ? 400 : 500,
            color: checked ? "text.disabled" : "text.primary",
            textDecoration: checked ? "line-through" : "none",
            lineHeight: 1.3,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {label}
        </Typography>
        {sublabel && (
          <Typography
            variant="body2"
            sx={{
              color: checked ? "text.disabled" : "text.secondary",
              opacity: checked ? 0.6 : 1,
            }}
          >
            {sublabel}
          </Typography>
        )}
      </Box>
    </ButtonBase>
  );
}

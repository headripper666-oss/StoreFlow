import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import RadioButtonUncheckedIcon from "@mui/icons-material/RadioButtonUnchecked";
import { Box, ButtonBase, Typography } from "@mui/material";
import { useEffect, useRef, useState } from "react";

interface CheckButtonProps {
  checked: boolean;
  label: string;
  sublabel?: string;
  badge?: string;
  onToggle: () => void;
  disabled?: boolean;
  strikeThrough?: boolean;
  marquee?: boolean;
}

export function CheckButton({
  checked,
  label,
  sublabel,
  badge,
  onToggle,
  disabled,
  strikeThrough = true,
  marquee = false,
}: CheckButtonProps) {
  const isStruckThrough = checked && strikeThrough;

  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLElement>(null);
  const [scrollDist, setScrollDist] = useState(0);

  useEffect(() => {
    if (!marquee) { setScrollDist(0); return; }
    const measure = () => {
      if (!containerRef.current || !textRef.current) return;
      setScrollDist(Math.max(0, textRef.current.scrollWidth - containerRef.current.offsetWidth));
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [label, marquee]);

  const isAnimated = marquee && scrollDist > 0;
  // Total duration: scroll at 50px/s takes 47% of the cycle (rest = pauses)
  const duration = Math.max(4, scrollDist / 50 / 0.47);

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
      <Box
        ref={marquee ? containerRef : undefined}
        sx={{ flex: 1, minWidth: 0, ...(marquee && { overflow: "hidden" }) }}
      >
        {marquee ? (
          <Typography
            ref={textRef}
            component="span"
            variant="body1"
            sx={{
              display: "inline-block",
              whiteSpace: "nowrap",
              fontWeight: isStruckThrough ? 400 : 500,
              color: isStruckThrough ? "text.disabled" : "text.primary",
              textDecoration: isStruckThrough ? "line-through" : "none",
              lineHeight: 1.3,
              ...(isAnimated && {
                "--mq-d": `-${scrollDist}px`,
                animationName: "marqueeScroll",
                animationDuration: `${duration.toFixed(2)}s`,
                animationTimingFunction: "linear",
                animationIterationCount: "infinite",
                "@keyframes marqueeScroll": {
                  "0%, 8%": { transform: "translateX(0)" },
                  "55%": { transform: "translateX(var(--mq-d))" },
                  "72%": { transform: "translateX(var(--mq-d))" },
                  "73%, 100%": { transform: "translateX(0)" },
                },
              }),
            }}
          >
            {label}
          </Typography>
        ) : (
          <Typography
            variant="body1"
            sx={{
              fontWeight: isStruckThrough ? 400 : 500,
              color: isStruckThrough ? "text.disabled" : "text.primary",
              textDecoration: isStruckThrough ? "line-through" : "none",
              lineHeight: 1.3,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {label}
          </Typography>
        )}
        {sublabel && (
          <Typography
            variant="body2"
            sx={{
              color: isStruckThrough ? "text.disabled" : "text.secondary",
              opacity: isStruckThrough ? 0.6 : 1,
            }}
          >
            {sublabel}
          </Typography>
        )}
      </Box>
      {badge && (
        <Typography
          variant="caption"
          sx={{
            fontWeight: 700,
            color: isStruckThrough ? "text.disabled" : "primary.main",
            bgcolor: isStruckThrough ? "action.hover" : "rgba(28, 61, 48, 0.08)",
            px: 1,
            py: 0.5,
            borderRadius: 1,
            flexShrink: 0,
          }}
        >
          {badge}
        </Typography>
      )}
    </ButtonBase>
  );
}

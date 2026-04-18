import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Chip,
  Typography,
} from "@mui/material";
import type { DisplayItem, Rayon } from "../../types";
import { ProductItem } from "./ProductItem";

interface RayonSectionProps {
  rayon: Rayon;
  items: DisplayItem[];
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  disabled?: boolean;
}

export function RayonSection({
  rayon,
  items,
  onToggle,
  onDelete,
  disabled,
}: RayonSectionProps) {
  const uncheckedCount = items.filter((i) => !i.checked).length;
  const hasUnchecked = uncheckedCount > 0;

  const sorted = [
    ...items.filter((i) => !i.checked),
    ...items.filter((i) => i.checked),
  ];

  return (
    <Accordion
      defaultExpanded={hasUnchecked}
      disableGutters
      sx={{
        mb: 0.5,
        borderRadius: "12px !important",
        overflow: "hidden",
        border: "1px solid rgba(0,0,0,0.06)",
      }}
    >
      <AccordionSummary
        expandIcon={<ExpandMoreIcon />}
        sx={{
          minHeight: 56,
          px: 2,
          backgroundColor: "background.paper",
          "&.Mui-expanded": { minHeight: 56 },
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flex: 1 }}>
          <Typography
            sx={{ fontSize: "1.4rem", lineHeight: 1 }}
            role="img"
            aria-hidden
          >
            {rayon.icon}
          </Typography>
          <Typography variant="subtitle1" sx={{ flex: 1 }}>
            {rayon.label}
          </Typography>
          {uncheckedCount > 0 && (
            <Chip
              label={uncheckedCount}
              size="small"
              color="primary"
              sx={{ height: 22, fontSize: "0.72rem", fontWeight: 700 }}
            />
          )}
        </Box>
      </AccordionSummary>
      <AccordionDetails sx={{ p: 0, backgroundColor: "background.paper" }}>
        {sorted.map((item, idx) => (
          <ProductItem
            key={item.id}
            item={item}
            onToggle={() => onToggle(item.id)}
            onDelete={() => onDelete(item.id)}
            disabled={disabled}
            isLast={idx === sorted.length - 1}
          />
        ))}
      </AccordionDetails>
    </Accordion>
  );
}

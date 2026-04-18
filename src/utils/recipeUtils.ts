const DISCRETE_UNITS = new Set([
  "pcs",
  "œuf",
  "œufs",
  "tranche",
  "tranches",
  "feuille",
  "feuilles",
  "gousse",
  "gousses",
  "sachet",
  "sachets",
]);

export function roundQuantity(raw: number, unit: string): number {
  if (DISCRETE_UNITS.has(unit.toLowerCase())) {
    // Round to nearest 0.5 for countable items
    return Math.round(raw * 2) / 2;
  }
  // Round to at most 2 decimal places, strip trailing zeros
  return parseFloat(raw.toFixed(2));
}

export function formatQuantity(quantity: number): string {
  // Display integers without decimal, floats without trailing zeros
  return Number.isInteger(quantity) ? String(quantity) : String(quantity);
}

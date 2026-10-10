import type { CatalogProduct, RecipeIngredient } from "../types";

export const DEFAULT_TAGS = [
  "poulet",
  "boeuf",
  "porc",
  "agneau",
  "poisson",
  "vegetarien",
  "pates",
  "soupe",
  "oeufs",
  "dessert",
  "autre",
] as const;

export const TAG_LABELS: Record<string, { emoji: string; label: string }> = {
  poulet: { emoji: "🐔", label: "Poulet & volaille" },
  boeuf: { emoji: "🥩", label: "Bœuf" },
  porc: { emoji: "🐷", label: "Porc & charcuterie" },
  agneau: { emoji: "🐑", label: "Agneau" },
  poisson: { emoji: "🐟", label: "Poissons & fruits de mer" },
  vegetarien: { emoji: "🥦", label: "Végétarien" },
  pates: { emoji: "🍝", label: "Pâtes" },
  soupe: { emoji: "🥣", label: "Soupes" },
  oeufs: { emoji: "🥚", label: "Œufs & fromage" },
  dessert: { emoji: "🍰", label: "Desserts" },
  autre: { emoji: "🌍", label: "Autre" },
};

export function tagDisplay(tag: string): string {
  const info = TAG_LABELS[tag];
  return info ? `${info.emoji} ${info.label}` : tag;
}

const SYNONYM_MAP: Array<{ tag: string; keywords: string[] }> = [
  { tag: "poulet", keywords: ["poulet", "dinde", "canard", "volaille"] },
  {
    tag: "boeuf",
    keywords: ["boeuf", "steak", "bifteck", "entrecote"],
  },
  {
    tag: "porc",
    keywords: ["porc", "jambon", "lardon", "lardons", "saucisse", "chorizo", "bacon"],
  },
  { tag: "agneau", keywords: ["agneau", "mouton"] },
  {
    tag: "poisson",
    keywords: ["saumon", "thon", "cabillaud", "crevette", "moule", "poisson", "merlu", "sardine"],
  },
  { tag: "oeufs", keywords: ["oeuf", "quiche", "omelette"] },
  {
    tag: "soupe",
    keywords: ["soupe", "potage", "veloute", "bouillon"],
  },
  {
    tag: "dessert",
    keywords: ["gateau", "tarte", "crepe", "chocolat", "brownie", "cookie"],
  },
  {
    tag: "pates",
    keywords: ["pates", "spaghetti", "nouilles", "tagliatelle", "tagliatelles", "fettuccine", "rigatoni", "lasagne"],
  },
];

export function capitalize(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

export function findInCatalog(
  name: string,
  catalog: CatalogProduct[],
): CatalogProduct | null {
  const normName = normalize(name);
  for (const p of catalog) {
    if (normalize(p.name) === normName) return p;
    if ((p.aliases ?? []).some((a) => normalize(a) === normName)) return p;
  }
  return null;
}

export function detectTags(
  recipe: { name: string; ingredients: Pick<RecipeIngredient, "name">[] },
  knownTags: string[],
): string[] {
  const tokens = normalize(
    [recipe.name, ...recipe.ingredients.map((i) => i.name)].join(" "),
  );
  const result = new Set<string>();

  // Level 1: synonym matching
  for (const { tag, keywords } of SYNONYM_MAP) {
    if (keywords.some((kw) => tokens.includes(normalize(kw)))) {
      result.add(tag);
    }
  }

  // Level 2: direct match against known tags (min 3 chars to avoid false positives)
  for (const tag of knownTags) {
    if (tag.length >= 3 && tokens.includes(normalize(tag))) {
      result.add(tag);
    }
  }

  return [...result];
}

const DISCRETE_UNITS = new Set([
  "pcs",
  "oeuf",
  "oeufs",
  "tranche",
  "tranches",
  "feuille",
  "feuilles",
  "gousse",
  "gousses",
  "sachet",
  "sachets",
]);

// Units that all mean "one piece" — treated as equivalent when merging list items
// (compared after normalize(), so diacritics are already stripped: pièce→piece, unité→unite)
const COUNT_UNITS = new Set(["", "unite", "unites", "piece", "pieces", "pc", "pcs", "x"]);

export function normalizeUnit(unit: string): string {
  const norm = normalize(unit.trim());
  return COUNT_UNITS.has(norm) ? "" : norm;
}

export function roundQuantity(raw: number, unit: string): number {
  if (DISCRETE_UNITS.has(unit.toLowerCase())) {
    return Math.round(raw * 2) / 2;
  }
  return parseFloat(raw.toFixed(2));
}

export function formatQuantity(quantity: number): string {
  return Number.isInteger(quantity) ? String(quantity) : String(quantity);
}

export function computeRecipeCalories(
  ingredients: RecipeIngredient[],
  guests: number,
  baseServings: number,
): number | null {
  const scale = baseServings > 0 ? guests / baseServings : 1;
  let total = 0;
  let hasAny = false;
  for (const ing of ingredients) {
    if (ing.caloriesPerUnit !== undefined) {
      total += ing.caloriesPerUnit * ing.quantity * scale;
      hasAny = true;
    }
  }
  return hasAny ? Math.round(total) : null;
}

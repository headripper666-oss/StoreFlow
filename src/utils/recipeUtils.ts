import type { RecipeCategory, RecipeIngredient } from "../types";

export const CATEGORY_LABELS: Record<
  RecipeCategory,
  { emoji: string; label: string }
> = {
  poulet: { emoji: "🐔", label: "Poulet & volaille" },
  boeuf: { emoji: "🥩", label: "Bœuf" },
  porc: { emoji: "🐷", label: "Porc & charcuterie" },
  agneau: { emoji: "🐑", label: "Agneau & veau" },
  poisson: { emoji: "🐟", label: "Poissons & fruits de mer" },
  vegetarien: { emoji: "🥦", label: "Végétarien" },
  pates: { emoji: "🍝", label: "Pâtes & riz" },
  soupe: { emoji: "🥣", label: "Soupes" },
  oeufs: { emoji: "🥚", label: "Œufs & fromage" },
  dessert: { emoji: "🍰", label: "Desserts" },
  autre: { emoji: "🌍", label: "Autre" },
};

const CATEGORY_ORDER: RecipeCategory[] = [
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
];

const KEYWORDS: Record<RecipeCategory, string[]> = {
  poulet: ["poulet", "dinde", "canard", "volaille"],
  boeuf: [
    "bœuf",
    "boeuf",
    "steak",
    "veau",
    "bifteck",
    "entrecote",
    "entrecôte",
  ],
  porc: ["porc", "jambon", "lardon", "lardons", "saucisse", "chorizo", "bacon"],
  agneau: ["agneau", "mouton"],
  poisson: [
    "saumon",
    "thon",
    "cabillaud",
    "crevette",
    "moule",
    "poisson",
    "merlu",
    "sardine",
  ],
  oeufs: ["oeuf", "œuf", "quiche", "omelette"],
  soupe: ["soupe", "potage", "veloute", "velouté", "bouillon"],
  dessert: [
    "gateau",
    "gâteau",
    "tarte",
    "crepe",
    "crêpe",
    "chocolat",
    "brownie",
    "cookie",
  ],
  pates: [
    "pates",
    "pâtes",
    "spaghetti",
    "riz",
    "risotto",
    "nouilles",
    "tagliatelle",
    "fettuccine",
  ],
  vegetarien: [],
  autre: [],
};

const MEAT_FISH_CATEGORIES: RecipeCategory[] = [
  "poulet",
  "boeuf",
  "porc",
  "agneau",
  "poisson",
];

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function detectCategory(recipe: {
  name: string;
  ingredients: Pick<RecipeIngredient, "name">[];
}): RecipeCategory {
  const tokens = [recipe.name, ...recipe.ingredients.map((i) => i.name)]
    .map(normalize)
    .join(" ");

  for (const category of CATEGORY_ORDER) {
    const kws = KEYWORDS[category];
    if (kws.length === 0) continue;
    if (kws.some((kw) => tokens.includes(normalize(kw)))) return category;
  }

  // Végétarien = aucun ingrédient viande/poisson détecté
  const hasMeatOrFish = MEAT_FISH_CATEGORIES.some((cat) =>
    KEYWORDS[cat].some((kw) => tokens.includes(normalize(kw))),
  );
  if (!hasMeatOrFish) return "vegetarien";

  return "autre";
}

export { CATEGORY_ORDER };

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

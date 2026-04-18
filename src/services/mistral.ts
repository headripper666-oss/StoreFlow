import type { ParsedProduct, ParsedRecipe } from "../types";

export async function parseProductsFromText(
  rawText: string,
): Promise<ParsedProduct[]> {
  const url = import.meta.env.VITE_NETLIFY_FUNCTION_URL;

  if (!url) {
    throw new Error("VITE_NETLIFY_FUNCTION_URL est non configuré");
  }

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rawText }),
  });

  if (!res.ok) {
    throw new Error(`Erreur lors de l'analyse : ${res.status}`);
  }

  const data = await res.json();
  return data.products as ParsedProduct[];
}

export async function parseRecipeFromText(
  rawText: string,
): Promise<ParsedRecipe> {
  const baseUrl = import.meta.env.VITE_NETLIFY_FUNCTION_URL;

  if (!baseUrl) {
    throw new Error("VITE_NETLIFY_FUNCTION_URL est non configuré");
  }

  const url = baseUrl.replace(/\/[^/]+$/, "/parse-recipe");

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rawText }),
  });

  if (!res.ok) {
    throw new Error(`Erreur lors de l'analyse de la recette : ${res.status}`);
  }

  return (await res.json()) as ParsedRecipe;
}

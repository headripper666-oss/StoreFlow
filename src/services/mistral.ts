import type { ParsedProduct, ParsedRecipe } from "../types";

export async function parseProductsFromText(
  rawText: string,
): Promise<ParsedProduct[]> {
  const url = import.meta.env.VITE_NETLIFY_FUNCTION_URL || "/api/parse-products";

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
  const baseUrl = import.meta.env.VITE_NETLIFY_FUNCTION_URL || "/api/parse-products";
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

export async function parseRecipeFromImage(
  imageBase64: string,
  mimeType: string,
): Promise<ParsedRecipe> {
  const baseUrl = import.meta.env.VITE_NETLIFY_FUNCTION_URL || "/api/parse-products";
  const url = baseUrl.replace(/\/[^/]+$/, "/parse-recipe-image");

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ imageBase64, mimeType }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error || `Erreur lors de l'analyse de l'image : ${res.status}`);
  }

  return (await res.json()) as ParsedRecipe;
}

export async function parseRecipeStepsFromImage(
  imageBase64: string,
  mimeType: string,
): Promise<{ steps: string[] }> {
  const baseUrl = import.meta.env.VITE_NETLIFY_FUNCTION_URL || "/api/parse-products";
  const url = baseUrl.replace(/\/[^/]+$/, "/parse-recipe-steps");

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ imageBase64, mimeType }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error || `Erreur lors de l'analyse des étapes : ${res.status}`);
  }

  return (await res.json()) as { steps: string[] };
}

export async function parseRecipeStepsFromUrl(
  url: string,
): Promise<{ steps: string[] }> {
  const baseUrl = import.meta.env.VITE_NETLIFY_FUNCTION_URL || "/api/parse-products";
  const endpoint = baseUrl.replace(/\/[^/]+$/, "/parse-recipe-steps-url");

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error || `Erreur lors de l'extraction des étapes : ${res.status}`);
  }

  return (await res.json()) as { steps: string[] };
}

import type { Config, Context } from "@netlify/functions";

const MISTRAL_URL = "https://api.mistral.ai/v1/chat/completions";

const SYSTEM_PROMPT = `Tu es un assistant culinaire qui structure des recettes françaises.
À partir du texte brut fourni (recette collée depuis un blog, un livre, une photo OCR, etc.), extrais la recette et retourne un JSON valide avec ce format exact:
{
  "name": "string (nom de la recette en français)",
  "servings": number (nombre de personnes — 4 si non précisé),
  "ingredients": [
    {
      "name": "string (ingrédient en français, naturel)",
      "quantity": number (quantité pour le nombre de personnes indiqué dans servings),
      "unit": "string (g, kg, mL, cL, L, pcs, sachet, c. à soupe, c. à café, etc. — 'pcs' si non précisé)",
      "rayonId": "string (un des IDs ci-dessous)"
    }
  ]
}

IDs de rayons disponibles (choisir le plus approprié):
- fruits-legumes : Fruits, légumes, herbes fraîches, ail, oignon, échalote
- boulangerie : Pain, viennoiseries, pâtes à tarte, pâtisseries fraîches
- boucherie : Viande, poisson, charcuterie, lardons, jambon, traiteur frais
- cremerie : Lait, fromage, beurre, crème, yaourts, œufs, fromage râpé
- epicerie-seche : Pâtes, riz, conserves, huile, farine, épices, sucre, céréales, bouillon cube, concentré de tomate
- surgeles : Surgelés
- boissons : Eau, jus, sodas, alcool, vin, bière, café, thé
- hygiene : Produits de beauté, hygiène corporelle
- entretien : Produits ménagers, lessive
- autre : Tout ce qui ne rentre pas dans les catégories précédentes

Règles:
- Si les quantités sont données par personne dans le texte, les multiplier par le nombre de servings
- Si le nombre de personnes est ambigu, choisir 4
- Ne jamais inventer d'ingrédients absents du texte
- Utiliser des unités françaises standard
- Le nom de la recette doit être court et naturel (ex: "Poulet rôti aux herbes", "Tarte aux pommes")`;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
};

export default async (req: Request, _context: Context) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: CORS_HEADERS,
    });
  }

  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "MISTRAL_API_KEY not configured" }),
      {
        status: 500,
        headers: CORS_HEADERS,
      },
    );
  }

  let rawText: string;
  try {
    const body = await req.json();
    rawText = body.rawText as string;
    if (
      !rawText ||
      typeof rawText !== "string" ||
      rawText.trim().length === 0
    ) {
      return new Response(JSON.stringify({ error: "rawText is required" }), {
        status: 400,
        headers: CORS_HEADERS,
      });
    }
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: CORS_HEADERS,
    });
  }

  const mistralRes = await fetch(MISTRAL_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "mistral-small-latest",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: rawText },
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
    }),
  });

  if (!mistralRes.ok) {
    const errText = await mistralRes.text();
    return new Response(
      JSON.stringify({
        error: `Mistral API error: ${mistralRes.status}`,
        details: errText,
      }),
      {
        status: 502,
        headers: CORS_HEADERS,
      },
    );
  }

  const mistralData = await mistralRes.json();
  const content = mistralData.choices?.[0]?.message?.content;

  if (!content) {
    return new Response(
      JSON.stringify({ error: "Empty response from Mistral" }),
      {
        status: 502,
        headers: CORS_HEADERS,
      },
    );
  }

  const parsed = JSON.parse(content);

  return new Response(JSON.stringify(parsed), {
    status: 200,
    headers: CORS_HEADERS,
  });
};

export const config: Config = {
  path: "/api/parse-recipe",
};

import type { Config, Context } from "@netlify/functions";

const MISTRAL_URL = "https://api.mistral.ai/v1/chat/completions";

const SYSTEM_PROMPT = `Tu es un assistant qui structure des listes de courses françaises.
À partir du texte brut fourni, extrais chaque produit et retourne un JSON valide avec ce format exact:
{
  "products": [
    {
      "name": "string (nom du produit en français, naturel)",
      "quantity": number (1 si non précisé),
      "unit": "string (kg, g, L, mL, pcs, sachet, boîte, etc. — 'pcs' si non précisé)",
      "rayonId": "string (un des IDs ci-dessous)",
      "confidence": "high" | "medium" | "low"
    }
  ]
}

IDs de rayons disponibles (choisir le plus approprié):
- fruits-legumes : Fruits, légumes, herbes fraîches
- boulangerie : Pain, viennoiseries, pâtisseries fraîches
- boucherie : Viande, poisson, charcuterie, traiteur frais
- cremerie : Lait, fromage, beurre, crème, yaourts, œufs
- epicerie-seche : Pâtes, riz, conserves, huile, farine, épices, céréales
- surgeles : Surgelés
- boissons : Eau, jus, sodas, alcool, café, thé
- hygiene : Produits de beauté, hygiène corporelle, médicaments
- entretien : Produits ménagers, lessive, papier toilette, sacs poubelle
- autre : Tout ce qui ne rentre pas dans les catégories précédentes

Règles:
- confidence "high" = produit clairement identifié avec rayon évident
- confidence "medium" = produit identifié mais rayon incertain
- confidence "low" = produit ambigu ou difficile à catégoriser
- Ne jamais inventer de produits qui ne sont pas dans le texte
- Un produit par ligne dans le texte source = un item dans la liste`;

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
  path: "/api/parse-products",
};

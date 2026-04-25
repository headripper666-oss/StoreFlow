import json
import re
from pathlib import Path

import pandas as pd

# === CONFIG ===
EXCEL_PATH = "Repas.xlsx"      # chemin vers ton fichier
SHEET_NAME = "Recettes"        # nom de la feuille
OUTPUT_JSON = "recettes.json"  # fichier de sortie
DEFAULT_SERVINGS = 1
DEFAULT_CREATED_AT = "2026-01-01T00:00:00.000Z"

# Mots-clés qui indiquent plutôt un "produit" qu'un repas
EXCLUDE_KEYWORDS = [
    "huile", "gel douche", "shampoing", "dentifrice", "lessive",
    "sopalin", "pq", "papier", "lingette", "vinaigre", "eau micellaire",
    "crème", "lait corps", "bloc wc", "serviette hygi", "protège slip",
    "tampons", "mouchoirs", "croquette", "compote", "cake", "gateau",
    "chips", "cacahuètes", "tuc", "3d", "pringle", "doritos", "biscuits",
    "apéro", "champagne", "rhum", "vodka", "bière", "panaché", "freixenet"
]

def slugify(name: str) -> str:
    """Transforme un nom de recette en slug pour l'id."""
    name = name.lower()
    name = name.replace("œ", "oe").replace("é", "e").replace("è", "e").replace("ê", "e")
    name = name.replace("à", "a").replace("â", "a").replace("î", "i").replace("ô", "o").replace("ù", "u")
    name = re.sub(r"[^a-z0-9]+", "-", name)
    name = re.sub(r"-+", "-", name).strip("-")
    return name

def is_probable_meal(name: str) -> bool:
    """Heuristique simple pour distinguer un repas d'un simple produit."""
    if not name:
        return False
    name_l = name.lower().strip()

    # Exclure ce qui contient certains mots-clés "courses"
    for kw in EXCLUDE_KEYWORDS:
        if kw in name_l:
            return False

    # Exclure les noms très courts (ex: "Sel", "Poivre")
    if len(name_l) <= 3:
        return False

    # Ex: "Huile d'olive", "Sel" -> déjà couverts par les mots-clés / longueur
    return True

def parse_header(header: str):
    """
    À partir d'un header du type '02- Bœuf haché (g)' ou '07- Oeuf',
    retourne (name, unit).
    """
    if header is None or str(header).strip() == "":
        return None, None

    text = str(header).strip()

    # Retirer le préfixe 'NN- '
    text = re.sub(r"^\d+\s*-\s*", "", text).strip()

    # Chercher une unité entre parenthèses à la fin
    m = re.search(r"\(([^)]+)\)\s*$", text)
    if m:
        unit = m.group(1).strip()
        name = re.sub(r"\([^)]+\)\s*$", "", text).strip()
    else:
        unit = None
        name = text

    return name, unit

def main():
    # Lecture de la feuille Recettes
    df = pd.read_excel(EXCEL_PATH, sheet_name=SHEET_NAME)  # [file:1]

    # S'assurer qu'il existe une colonne 'Plat'
    if "Plat" not in df.columns:
        raise ValueError("La feuille 'Recettes' doit contenir une colonne 'Plat'.")

    recipes = []

    # Préparer la liste des colonnes ingrédients (toutes sauf 'Plat')
    ingredient_columns = [col for col in df.columns if col != "Plat"]

    for _, row in df.iterrows():
        plat = row.get("Plat")

        if not isinstance(plat, str) or plat.strip() == "":
            continue

        plat_name = plat.strip()

        # Filtrer les “vrais repas”
        if not is_probable_meal(plat_name):
            continue

        ingredients = []

        for col in ingredient_columns:
            value = row.get(col)

            # On ignore les cellules vides / NaN / 0
            if pd.isna(value) or value == 0:
                continue

            header_name, unit = parse_header(col)
            if not header_name:
                continue

            try:
                quantity = float(value)
            except (TypeError, ValueError):
                # Si ce n'est pas numérique, on skip (ou on pourrait mettre 1 par défaut)
                continue

            ingredient = {
                "name": header_name,
                "quantity": quantity,
                "unit": unit if unit is not None else "pcs",
                "rayonId": None
            }
            ingredients.append(ingredient)

        if not ingredients:
            # Si aucune quantité n'est renseignée, on n'ajoute pas la recette
            continue

        recipe_obj = {
            "id": f"recipe-{slugify(plat_name)}",
            "name": plat_name,
            "servings": DEFAULT_SERVINGS,
            "createdAt": DEFAULT_CREATED_AT,
            "ingredients": ingredients
        }
        recipes.append(recipe_obj)

    # Écriture du JSON
    output_path = Path(OUTPUT_JSON)
    output_path.write_text(json.dumps(recipes, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"{len(recipes)} recettes exportées dans {OUTPUT_JSON}")

if __name__ == "__main__":
    main()
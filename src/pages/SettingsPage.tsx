import { Box, Container, Tab, Tabs, Typography } from "@mui/material";
import { useState } from "react";
import { ArticlesRayonManager } from "../components/settings/ArticlesRayonManager";
import { TagsManager } from "../components/settings/TagsManager";
import { RayonSettingsPage } from "./RayonSettingsPage";
import type {
  CatalogProduct,
  EssentialItem,
  ListItem,
  Rayon,
  Recipe,
} from "../types";

interface SettingsPageProps {
  // Onglet Rayons
  rayons: Rayon[];
  essentials: EssentialItem[];
  listItems: ListItem[];
  isSaving: boolean;
  onSaveRayons: (rayons: Rayon[]) => Promise<void>;
  // Onglet Tags
  recipes: Recipe[];
  isSavingRecipes: boolean;
  onRenameTag: (oldTag: string, newTag: string) => Promise<void>;
  onDeleteTag: (tag: string) => Promise<void>;
  // Onglet Articles
  personalList: ListItem[];
  catalog: CatalogProduct[];
  onUpdateEssentialRayon: (id: string, rayonId: string) => Promise<void>;
  onUpdateRecipeIngredientRayon: (name: string, rayonId: string) => Promise<void>;
  onUpdateListItemRayon: (id: string, rayonId: string) => Promise<void>;
  onUpdateCatalogProductRayon: (id: string, rayonId: string) => Promise<void>;
  onUpdateEssentialPrice: (id: string, price: number | undefined) => Promise<void>;
  onUpdateListItemPrice: (id: string, price: number | undefined) => Promise<void>;
  onUpdateCatalogProductPrice: (id: string, price: number | undefined) => Promise<void>;
  onUpdateRecipeIngredientPrice: (name: string, price: number | undefined) => Promise<void>;
  onUpdateRecipeIngredientCalories: (name: string, calories: number | undefined) => Promise<void>;
  onUpdateCatalogProductUnit: (id: string, unit: string) => Promise<void>;
  onUpdateRecipeIngredientUnit: (name: string, unit: string) => Promise<void>;
  onUpdateEssentialUnit: (id: string, unit: string) => Promise<void>;
  onUpdateListItemUnit: (id: string, unit: string) => Promise<void>;
  onUpdateRecipe: (recipe: Recipe) => Promise<void>;
}

export function SettingsPage({
  rayons,
  essentials,
  listItems,
  isSaving,
  onSaveRayons,
  recipes,
  isSavingRecipes,
  onRenameTag,
  onDeleteTag,
  personalList,
  catalog,
  onUpdateEssentialRayon,
  onUpdateRecipeIngredientRayon,
  onUpdateListItemRayon,
  onUpdateCatalogProductRayon,
  onUpdateEssentialPrice,
  onUpdateListItemPrice,
  onUpdateCatalogProductPrice,
  onUpdateRecipeIngredientPrice,
  onUpdateRecipeIngredientCalories,
  onUpdateCatalogProductUnit,
  onUpdateRecipeIngredientUnit,
  onUpdateEssentialUnit,
  onUpdateListItemUnit,
  onUpdateRecipe,
}: SettingsPageProps) {
  const [tab, setTab] = useState(0);

  return (
    <Container maxWidth={false} sx={{ py: 2, pb: { xs: 10, lg: 3 }, maxWidth: { xs: "100%", lg: 1100 }, mx: "auto" }}>
      <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
        Réglages
      </Typography>

      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        sx={{ mb: 3, borderBottom: 1, borderColor: "divider" }}
      >
        <Tab label="Rayons" sx={{ textTransform: "none", fontWeight: 600 }} />
        <Tab label="Tags" sx={{ textTransform: "none", fontWeight: 600 }} />
        <Tab label="Catalogue" sx={{ textTransform: "none", fontWeight: 600 }} />
      </Tabs>

      <Box hidden={tab !== 0}>
        <RayonSettingsPage
          rayons={rayons}
          essentials={essentials}
          listItems={listItems}
          recipes={recipes}
          onSave={onSaveRayons}
          isSaving={isSaving}
        />
      </Box>

      <Box hidden={tab !== 1}>
        <TagsManager
          recipes={recipes}
          isSaving={isSavingRecipes}
          onRenameTag={onRenameTag}
          onDeleteTag={onDeleteTag}
        />
      </Box>

      <Box hidden={tab !== 2}>
        <ArticlesRayonManager
          essentials={essentials}
          personalList={personalList}
          catalog={catalog}
          recipes={recipes}
          rayons={rayons}
          isSaving={isSaving || isSavingRecipes}
          onUpdateEssentialRayon={onUpdateEssentialRayon}
          onUpdateRecipeIngredientRayon={onUpdateRecipeIngredientRayon}
          onUpdateListItemRayon={onUpdateListItemRayon}
          onUpdateCatalogProductRayon={onUpdateCatalogProductRayon}
          onUpdateEssentialPrice={onUpdateEssentialPrice}
          onUpdateListItemPrice={onUpdateListItemPrice}
          onUpdateCatalogProductPrice={onUpdateCatalogProductPrice}
          onUpdateRecipeIngredientPrice={onUpdateRecipeIngredientPrice}
          onUpdateRecipeIngredientCalories={onUpdateRecipeIngredientCalories}
          onUpdateCatalogProductUnit={onUpdateCatalogProductUnit}
          onUpdateRecipeIngredientUnit={onUpdateRecipeIngredientUnit}
          onUpdateEssentialUnit={onUpdateEssentialUnit}
          onUpdateListItemUnit={onUpdateListItemUnit}
          onUpdateRecipe={onUpdateRecipe}
        />
      </Box>
    </Container>
  );
}

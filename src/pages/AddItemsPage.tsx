import { Box, Container, Tab, Tabs, Typography } from "@mui/material";
import { useState } from "react";
import { ManualAddForm } from "../components/add/ManualAddForm";
import { ParsedPreview } from "../components/add/ParsedPreview";
import { TextPasteInput } from "../components/add/TextPasteInput";
import type { CatalogProduct, ListItem, ParsedProduct, Rayon } from "../types";
import { parseProductsFromText } from "../services/mistral";

interface AddItemsPageProps {
  rayons: Rayon[];
  catalog?: CatalogProduct[];
  onAdd: (
    items: Omit<ListItem, "id" | "addedAt" | "checked">[],
  ) => Promise<void>;
  onAddFromParsed: (parsed: ParsedProduct[]) => Promise<void>;
  isSaving: boolean;
}

export function AddItemsPage({
  rayons,
  catalog = [],
  onAdd,
  onAddFromParsed,
  isSaving,
}: AddItemsPageProps) {
  const [tab, setTab] = useState(0);
  const [isParsing, setIsParsing] = useState(false);
  const [parsedProducts, setParsedProducts] = useState<ParsedProduct[] | null>(
    null,
  );

  const handleParseText = async (text: string) => {
    setIsParsing(true);
    try {
      const products = await parseProductsFromText(text);
      setParsedProducts(products);
    } finally {
      setIsParsing(false);
    }
  };

  const handleConfirmParsed = async (products: ParsedProduct[]) => {
    await onAddFromParsed(products);
    setParsedProducts(null);
  };

  const handleSingleAdd = async (
    item: Omit<ListItem, "id" | "addedAt" | "checked">,
  ) => {
    await onAdd([item]);
  };

  return (
    <Container maxWidth="sm" sx={{ py: 2 }}>
      <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
        Ajouter des articles
      </Typography>

      <Tabs
        value={tab}
        onChange={(_, v) => {
          setTab(v);
          setParsedProducts(null);
        }}
        sx={{ mb: 3, borderBottom: 1, borderColor: "divider" }}
      >
        <Tab
          label="Coller du texte"
          sx={{ textTransform: "none", fontWeight: 600 }}
        />
        <Tab
          label="Ajout manuel"
          sx={{ textTransform: "none", fontWeight: 600 }}
        />
      </Tabs>

      <Box hidden={tab !== 0}>
        {parsedProducts ? (
          <ParsedPreview
            products={parsedProducts}
            rayons={rayons}
            onConfirm={handleConfirmParsed}
            onCancel={() => setParsedProducts(null)}
            isSaving={isSaving}
          />
        ) : (
          <TextPasteInput onParsed={handleParseText} isLoading={isParsing} />
        )}
      </Box>

      <Box hidden={tab !== 1}>
        <ManualAddForm
          rayons={rayons}
          catalog={catalog}
          onAdd={handleSingleAdd}
          isSaving={isSaving}
        />
      </Box>
    </Container>
  );
}

import type { Rayon } from "../types";

export const DEFAULT_RAYONS: Rayon[] = [
  { id: "fruits-legumes", label: "Fruits & Légumes", order: 1, icon: "🥦" },
  { id: "boulangerie", label: "Boulangerie", order: 2, icon: "🥖" },
  { id: "boucherie", label: "Boucherie / Poissonnerie", order: 3, icon: "🥩" },
  { id: "cremerie", label: "Crèmerie", order: 4, icon: "🧀" },
  { id: "epicerie-seche", label: "Épicerie Sèche", order: 5, icon: "🥫" },
  { id: "surgeles", label: "Surgelés", order: 6, icon: "🧊" },
  { id: "boissons", label: "Boissons", order: 7, icon: "🥤" },
  { id: "hygiene", label: "Hygiène / Beauté", order: 8, icon: "🧴" },
  { id: "entretien", label: "Entretien", order: 9, icon: "🧹" },
  { id: "autre", label: "Autre", order: 10, icon: "📦" },
];

export const DEFAULT_ESSENTIALS = [
  { id: "ess-pain", name: "Pain", rayonId: "boulangerie", checked: false },
  { id: "ess-lait", name: "Lait", rayonId: "cremerie", checked: false },
  { id: "ess-beurre", name: "Beurre", rayonId: "cremerie", checked: false },
  { id: "ess-oeufs", name: "Œufs", rayonId: "cremerie", checked: false },
  { id: "ess-yaourts", name: "Yaourts", rayonId: "cremerie", checked: false },
  {
    id: "ess-tomates",
    name: "Tomates",
    rayonId: "fruits-legumes",
    checked: false,
  },
  {
    id: "ess-bananes",
    name: "Bananes",
    rayonId: "fruits-legumes",
    checked: false,
  },
  {
    id: "ess-pommes",
    name: "Pommes",
    rayonId: "fruits-legumes",
    checked: false,
  },
  { id: "ess-pates", name: "Pâtes", rayonId: "epicerie-seche", checked: false },
  { id: "ess-riz", name: "Riz", rayonId: "epicerie-seche", checked: false },
  { id: "ess-eau", name: "Eau (pack)", rayonId: "boissons", checked: false },
  { id: "ess-pq", name: "Papier toilette", rayonId: "hygiene", checked: false },
];

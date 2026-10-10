import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // GitHub Pages sert l'app sous /StoreFlow/ ; le N150 sous /
  base: process.env.VITE_BASE ?? "/",
  plugins: [react()],
});

import path from "path";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import { templateLoaderPlugin } from "./src/data/vite-plugin-templates";
import { provisionApiPlugin } from "./src/data/vite-plugin-provision";

export default defineConfig({
  plugins: [react(), tailwindcss(), templateLoaderPlugin(), provisionApiPlugin()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});

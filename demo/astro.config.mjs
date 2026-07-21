// @ts-check
import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import suraido from "suraido";

export default defineConfig({
  integrations: [
    suraido({
      theme: "midnight", // "midnight" | "light" | "./path/to/your-theme.css"
      math: true, // set false to drop KaTeX (<Math> renders raw LaTeX)
    }),
    react(), // enables React islands (used by suraido/react charts)
  ],
});

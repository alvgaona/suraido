// @ts-check
import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import suraido from "suraido";

export default defineConfig({
  integrations: [
    suraido({
      theme: "./src/theme.css", // dual-mode (dark #101010 ↔ light) editorial theme
      fonts: { sans: "geist", mono: "geist-mono", serif: "fraunces" }, // Fraunces = display
      math: true, // set false to drop KaTeX (<Math> renders raw LaTeX)
    }),
    react(), // enables React islands (used by suraido/react charts)
  ],
});

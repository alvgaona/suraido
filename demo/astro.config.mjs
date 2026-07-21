// @ts-check
import { defineConfig } from "astro/config";
import suraido from "suraido";

export default defineConfig({
  integrations: [
    suraido({
      theme: "midnight", // "midnight" | "light" | "./path/to/your-theme.css"
      math: true, // set false to drop KaTeX (<Math> renders raw LaTeX)
    }),
  ],
});

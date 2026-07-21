// @ts-check
import { defineConfig } from "astro/config";
import suraido from "suraido";

export default defineConfig({
  // Set `math: false` to drop KaTeX (no stylesheet; <Math> renders raw LaTeX).
  integrations: [suraido({ math: true })],
});

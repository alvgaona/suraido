// @ts-check
import { defineConfig } from "astro/config";
import suraido from "suraido";

export default defineConfig({
  integrations: [suraido({ theme: "pitch" })],
});

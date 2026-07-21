import { createRequire } from "node:module";
import type { AstroIntegration } from "astro";
import tailwindcss from "@tailwindcss/vite";

const require = createRequire(import.meta.url);

export interface SuraidoOptions {
  /** Enable KaTeX/LaTeX math: the `<Math>` component + its stylesheet. Default: true. */
  math?: boolean;
}

const VIRTUAL_ID = "virtual:suraido/options";
const RESOLVED_ID = "\0" + VIRTUAL_ID;

/**
 * The suraido integration: wires Tailwind v4, injects the /presenter route, and
 * toggles optional features. Add it to astro.config: `integrations: [suraido()]`.
 */
export default function suraido(options: SuraidoOptions = {}): AstroIntegration {
  const math = options.math ?? true;
  return {
    name: "suraido",
    hooks: {
      "astro:config:setup": ({ updateConfig, injectRoute, injectScript }) => {
        updateConfig({
          vite: {
            plugins: [
              tailwindcss(),
              {
                // Expose resolved options to suraido's own components (e.g. <Math>).
                name: "suraido:options",
                resolveId(id) {
                  if (id === VIRTUAL_ID) return RESOLVED_ID;
                },
                load(id) {
                  if (id === RESOLVED_ID) return `export const math = ${JSON.stringify(math)};`;
                },
              },
            ],
          },
        });
        injectRoute({ pattern: "/presenter", entrypoint: "suraido/Presenter.astro" });
        // Load the KaTeX stylesheet globally only when math is enabled. Resolve
        // to an absolute path — the injected page-ssr module can't resolve the
        // bare (transitive) `katex` specifier.
        if (math) {
          const katexCss = require.resolve("katex/dist/katex.min.css");
          injectScript("page-ssr", `import ${JSON.stringify(katexCss)};`);
        }
      },
    },
  };
}

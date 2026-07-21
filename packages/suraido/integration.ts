import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { AstroIntegration } from "astro";
import tailwindcss from "@tailwindcss/vite";

const require = createRequire(import.meta.url);

export interface SuraidoOptions {
  /**
   * Color theme. A built-in preset name (`"midnight"` | `"light"`) or a path to
   * your own `.css` file (relative to the project root) that sets the `--deck-*`
   * variables. Default: `"midnight"`.
   */
  theme?: string;
  /** Enable KaTeX/LaTeX math: the `<Math>` component + its stylesheet. Default: true. */
  math?: boolean;
}

const VIRTUAL_ID = "virtual:suraido/options";
const RESOLVED_ID = "\0" + VIRTUAL_ID;

/**
 * The suraido integration: wires Tailwind v4, injects the /presenter route, the
 * theme, and optional features. Add it to astro.config: `integrations: [suraido()]`.
 */
export default function suraido(options: SuraidoOptions = {}): AstroIntegration {
  const math = options.math ?? true;
  const theme = options.theme ?? "midnight";
  return {
    name: "suraido",
    hooks: {
      "astro:config:setup": ({ config, updateConfig, injectRoute, injectScript }) => {
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

        // Theme: a built-in preset (bundled) or a custom .css file (project-relative).
        // Injected globally so it sets the --deck-* variables the deck reads.
        const themePath = theme.endsWith(".css")
          ? fileURLToPath(new URL(theme, config.root))
          : fileURLToPath(new URL(`./themes/${theme}.css`, import.meta.url));
        if (!existsSync(themePath)) {
          throw new Error(
            `suraido: theme "${theme}" not found. Use a built-in ("midnight" | "light") or a path to a .css file.`,
          );
        }
        injectScript("page-ssr", `import ${JSON.stringify(themePath)};`);

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

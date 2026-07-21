import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
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

const V_OPTIONS = "virtual:suraido/options";
const V_THEME = "virtual:suraido/theme.css";
const resolved = (id: string) => "\0" + id;

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
        // Resolve the theme: built-in preset (bundled) or project-relative .css.
        const themePath = theme.endsWith(".css")
          ? fileURLToPath(new URL(theme, config.root))
          : fileURLToPath(new URL(`./themes/${theme}.css`, import.meta.url));
        if (!existsSync(themePath)) {
          throw new Error(
            `suraido: theme "${theme}" not found. Use a built-in ("midnight" | "light") or a path to a .css file.`,
          );
        }

        updateConfig({
          vite: {
            plugins: [
              tailwindcss(),
              {
                // Virtual modules: options for components (<Math>) and the theme
                // CSS. The theme is inlined here (not served from disk) so it
                // loads reliably in dev + build regardless of Vite fs limits.
                name: "suraido:virtual",
                resolveId(id) {
                  if (id === V_OPTIONS || id === V_THEME) return resolved(id);
                },
                load(id) {
                  if (id === resolved(V_OPTIONS)) return `export const math = ${JSON.stringify(math)};`;
                  if (id === resolved(V_THEME)) return readFileSync(themePath, "utf8");
                },
              },
            ],
          },
        });
        injectRoute({ pattern: "/presenter", entrypoint: "suraido/Presenter.astro" });

        // KaTeX stylesheet, globally, only when math is enabled (it lives in
        // node_modules, so an absolute-path import is fine).
        if (math) {
          const katexCss = require.resolve("katex/dist/katex.min.css");
          injectScript("page-ssr", `import ${JSON.stringify(katexCss)};`);
        }
      },
    },
  };
}

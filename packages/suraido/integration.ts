import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { AstroIntegration } from "astro";
import tailwindcss from "@tailwindcss/vite";
import react from "@astrojs/react";

const require = createRequire(import.meta.url);

export interface SuraidoOptions {
  /**
   * Color theme. A built-in preset name (`"midnight"` | `"light"` | `"branding"`
   * | `"pitch"` | `"marketing"`) or a path to your own `.css` file (relative to
   * the project root) that sets the `--deck-*` variables. Default: `"midnight"`.
   */
  theme?: ThemePreset | (string & {});
  /**
   * Fonts for the three slots (the `--deck-font`, `--deck-font-mono`,
   * `--deck-font-serif` variables). Each value is either a **bundled font key**
   * (suraido self-hosts and loads it — only the ones you pick are shipped) or a
   * raw CSS `font-family` string (you load it yourself). Bundled keys:
   * `"inter"`, `"geist"`, `"jetbrains-mono"`, `"geist-mono"`, `"geist-pixel"`.
   * Defaults: sans → Inter, mono → JetBrains Mono, serif → system.
   */
  fonts?: { sans?: FontValue; mono?: FontValue; serif?: FontValue };
  /**
   * Design width of a slide, in CSS px. You author against this width and the
   * deck scales it to fill the browser, so it doubles as the presentation
   * scale: a **smaller** width renders everything **bigger**. Default: `1920`.
   */
  width?: number;
  /** Enable KaTeX/LaTeX math: the `<Math>` component + its stylesheet. Default: true. */
  math?: boolean;
  /**
   * How one slide gives way to the next.
   *
   * - `"fade"` (default) — the incoming slide fades in.
   * - `"slide"` — it also travels in from the direction you're moving, while
   *   the outgoing one leaves the other way.
   *
   * Either way, `prefers-reduced-motion: reduce` drops the motion.
   */
  transition?: Transition;
}

/** Themes suraido ships in `themes/` — the `theme` option also takes a `.css` path. */
type ThemePreset = "midnight" | "light" | "branding" | "pitch" | "marketing";
const THEMES: ThemePreset[] = ["midnight", "light", "branding", "pitch", "marketing"];

/** Fonts suraido bundles (self-hosted via Fontsource, loaded only when selected). */
/** Slide-to-slide transitions suraido ships. */
export type Transition = "fade" | "slide";
const TRANSITIONS: Transition[] = ["fade", "slide"];

type BundledFont = "inter" | "geist" | "jetbrains-mono" | "geist-mono" | "geist-pixel" | "fraunces";
// A bundled key (with autocomplete) or any raw CSS font-family string.
type FontValue = BundledFont | (string & {});
type Slot = "sans" | "mono" | "serif";

const FONTS: Record<BundledFont, { pkg: string; family: string }> = {
  inter: { pkg: "@fontsource-variable/inter", family: '"Inter Variable"' },
  geist: { pkg: "@fontsource-variable/geist", family: '"Geist Variable"' },
  "jetbrains-mono": { pkg: "@fontsource-variable/jetbrains-mono", family: '"JetBrains Mono Variable"' },
  "geist-mono": { pkg: "@fontsource-variable/geist-mono", family: '"Geist Mono Variable"' },
  "geist-pixel": { pkg: "@fontsource/geist-pixel", family: '"Geist Pixel"' },
  fraunces: { pkg: "@fontsource-variable/fraunces", family: '"Fraunces Variable"' },
};

const FALLBACK: Record<Slot, string> = {
  sans: "system-ui, -apple-system, sans-serif",
  mono: "ui-monospace, SFMono-Regular, monospace",
  serif: 'Georgia, "Times New Roman", serif',
};

// Default font per slot (serif stays system → no override, uses the theme's).
const DEFAULT_FONT: Partial<Record<Slot, BundledFont>> = { sans: "inter", mono: "jetbrains-mono" };

const V_OPTIONS = "virtual:suraido/options";
const V_THEME = "virtual:suraido/theme.css";
const resolved = (id: string) => "\0" + id;

/** Resolve one slot to its CSS family + (if bundled) the package to load. */
function resolveSlot(value: FontValue | undefined, slot: Slot): { family?: string; pkg?: string } {
  const key = value ?? DEFAULT_FONT[slot];
  if (!key) return {};
  const bundled = (FONTS as Record<string, { pkg: string; family: string }>)[key];
  if (bundled) return { family: `${bundled.family}, ${FALLBACK[slot]}`, pkg: bundled.pkg };
  return { family: key }; // raw font-family string — the user loads it themselves
}

function fontOverrides(slots: Record<Slot, { family?: string }>): string {
  const decls = [
    slots.sans.family && `--deck-font:${slots.sans.family};`,
    slots.mono.family && `--deck-font-mono:${slots.mono.family};`,
    slots.serif.family && `--deck-font-serif:${slots.serif.family};`,
  ].filter(Boolean);
  return decls.length ? `\n:root{${decls.join("")}}` : "";
}

/**
 * The suraido integration: wires Tailwind v4, injects the /presenter route, the
 * theme, and optional features. Add it to astro.config: `integrations: [suraido()]`.
 */
export default function suraido(options: SuraidoOptions = {}): AstroIntegration {
  const math = options.math ?? true;
  const theme = options.theme ?? "midnight";
  const fonts = options.fonts;
  const width = options.width ?? 1920;
  if (!Number.isFinite(width) || width <= 0) {
    throw new Error(`suraido: \`width\` must be a positive number of CSS px (got ${options.width}).`);
  }
  const transition = options.transition ?? "fade";
  if (!TRANSITIONS.includes(transition)) {
    throw new Error(`suraido: \`transition\` must be one of ${TRANSITIONS.join(" | ")} (got ${options.transition}).`);
  }
  return {
    name: "suraido",
    hooks: {
      "astro:config:setup": ({ config, updateConfig, injectRoute, injectScript }) => {
        // The command palette (⌘K) is a React island, so React rendering has to
        // be available. Add @astrojs/react ourselves unless the deck already
        // did — so the palette is genuinely built-in, not something every deck
        // has to wire up.
        if (!config.integrations.some((i) => i.name === "@astrojs/react")) {
          updateConfig({ integrations: [react()] });
        }

        // Resolve the theme: built-in preset (bundled) or project-relative .css.
        const themePath = theme.endsWith(".css")
          ? fileURLToPath(new URL(theme, config.root))
          : fileURLToPath(new URL(`./themes/${theme}.css`, import.meta.url));
        if (!existsSync(themePath)) {
          throw new Error(
            `suraido: theme "${theme}" not found. Use a built-in (${THEMES.join(" | ")}) or a path to a .css file.`,
          );
        }

        // Resolve the three font slots (defaults: Inter sans + JetBrains mono).
        const slots = {
          sans: resolveSlot(fonts?.sans, "sans"),
          mono: resolveSlot(fonts?.mono, "mono"),
          serif: resolveSlot(fonts?.serif, "serif"),
        };
        // Both the runtime and the CSS need the design width.
        const themeCss = `\n:root{--deck-width:${width}px}` + fontOverrides(slots);

        // Self-host only the bundled fonts actually selected (deduped).
        const pkgs = new Set([slots.sans.pkg, slots.mono.pkg, slots.serif.pkg].filter(Boolean) as string[]);
        const katexCss = math ? require.resolve("katex/dist/katex.min.css") : null;

        // These assets live wherever suraido resolved them — which is inside
        // *its* node_modules when a deck links a checkout instead of installing
        // from npm. Vite's dev server refuses to serve files outside the project
        // root, so the woff2 files 404 in `astro dev` (the build bundles them,
        // so it looks fine). Allow the directories we inject from.
        //
        // The project root has to be listed too: setting `fs.allow` at all
        // opts out of the default Vite would have computed, so omitting it
        // locks the deck out of its own src/ and node_modules.
        const assetDirs = [
          fileURLToPath(config.root),
          // suraido's own source, so a linked checkout can serve its runtime and
          // the command-palette island (react/CommandPalette.tsx) in dev. Without
          // this the island 403s and fails to hydrate — the .tsx is a runtime
          // dynamic import, so unlike statically-imported components it hits the
          // fs.allow check.
          fileURLToPath(new URL(".", import.meta.url)),
          ...[...pkgs.values(), ...(katexCss ? ["katex/dist/katex.min.css"] : [])].map((id) =>
            dirname(require.resolve(id)),
          ),
        ];

        updateConfig({
          vite: {
            server: { fs: { allow: assetDirs } },
            // Fontsource ships CSS-only packages; keep them bundled so Vite
            // processes the .css import instead of externalizing it to Node's
            // ESM loader (which can't load .css) during dev SSR.
            ssr: { noExternal: [/@fontsource/] },
            // The palette island (react/CommandPalette.tsx) lives in suraido, so
            // cmdk + Radix resolve React from suraido's node_modules, while the
            // app's @astrojs/react renderer uses the app's copy. Two React
            // instances break hooks ("Invalid hook call") in dev SSR — bundling
            // hides it, so it only bites `astro dev`. Dedupe to one copy.
            resolve: { noExternal: [/@fontsource/], dedupe: ["react", "react-dom"] },
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
                  if (id === resolved(V_OPTIONS))
                    return [
                      `export const math = ${JSON.stringify(math)};`,
                      `export const width = ${JSON.stringify(width)};`,
                      `export const transition = ${JSON.stringify(transition)};`,
                    ].join("\n");
                  if (id === resolved(V_THEME)) {
                    // The theme is inlined from disk, so declare the real file as a
                    // dependency — otherwise Vite has no idea this virtual module
                    // came from it and would serve the first read forever.
                    this.addWatchFile(themePath);
                    return readFileSync(themePath, "utf8") + themeCss;
                  }
                },
                // …and push an update when that file actually changes.
                handleHotUpdate({ file, server }) {
                  if (file !== themePath) return;
                  const mod = server.moduleGraph.getModuleById(resolved(V_THEME));
                  if (!mod) return;
                  server.moduleGraph.invalidateModule(mod);
                  return [mod];
                },
              },
            ],
          },
        });
        injectRoute({ pattern: "/presenter", entrypoint: "suraido/Presenter.astro" });

        // Injected by resolved absolute path so Vite processes the CSS + its
        // woff2. `assetDirs` above keeps those paths servable in dev.
        for (const pkg of pkgs) {
          injectScript("page-ssr", `import ${JSON.stringify(require.resolve(pkg))};`);
        }

        // KaTeX stylesheet, globally, only when math is enabled (it lives in
        // node_modules, so an absolute-path import is fine).
        if (katexCss) {
          injectScript("page-ssr", `import ${JSON.stringify(katexCss)};`);
        }
      },
    },
  };
}

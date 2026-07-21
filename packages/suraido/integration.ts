import type { AstroIntegration } from "astro";
import tailwindcss from "@tailwindcss/vite";

/**
 * The suraido integration: wires Tailwind v4 and injects the presenter
 * route. Add it to your astro.config: `integrations: [deck()]`.
 */
export default function deck(): AstroIntegration {
  return {
    name: "suraido",
    hooks: {
      "astro:config:setup": ({ updateConfig, injectRoute }) => {
        updateConfig({ vite: { plugins: [tailwindcss()] } });
        injectRoute({
          pattern: "/presenter",
          entrypoint: "suraido/Presenter.astro",
        });
      },
    },
  };
}

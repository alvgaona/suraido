# suraido

**スライド** — a slide framework on [Astro](https://astro.build).

Author slides as components; the deck runs as a **single Astro page** with a client-side runtime — letterbox
scaling, navigation, fragments, an overview grid, **native-resolution portals**, a presenter view, and PDF
export. Named for the Japanese word for "slide."

```
packages/suraido/   the framework — components, DeckLayout, runtime, Presenter, PDF export,
                    KaTeX <Math>, and an Astro integration.
demo/               a suraido deck about suraido (dev playground + showcase).
```

## Quick start

```bash
bun install
bun run dev       # serve the demo (astro dev, HMR)
bun run build     # static site → demo/dist
bun run export    # static build + deck.pdf  (needs `bunx playwright install chromium`)
```

## Use it in your own deck

```js
// astro.config.mjs
import suraido from "suraido";           // wires Tailwind v4 + injects the /presenter route
export default defineConfig({ integrations: [suraido()] });
```

```astro
---
// src/pages/index.astro
import DeckLayout from "suraido/DeckLayout.astro";
import Slide from "suraido/components/Slide.astro";
import Cover from "suraido/components/Cover.astro";
import Math from "suraido/components/Math.astro";
---
<DeckLayout title="My talk">
  <Cover eyebrow="…" title="…" lead="…" number={false} />
  <Slide title="Transforms">
    <Math display expr={"T^{W}_{C} = T^{W}_{A}\\, T^{A}_{B}\\, T^{B}_{C}"} />
  </Slide>
</DeckLayout>
```

## Components

`Slide` · `Cover` · `Section` · `Statement` · `Columns` · `Card` · `Callout` · `Stat` · `Quote` · `Badge` ·
`Figure` · `Steps` + `Step` (fragments) · `Portal` (native-resolution embeds) · `Math` (KaTeX, build-time).

Underneath, components emit `deck-*` utility classes on a themeable `--deck-*` variable contract — usable
directly too. Code highlighting is Astro's built-in `<Code>` (Shiki).

## Runtime

`←/→` navigate (→ steps through `<Steps>` fragments first) · `Home`/`End` jump · `F` fullscreen ·
`O` overview grid · `P` presenter · `#3` deep-links a slide.

## Status

Early — the framework builds and runs (scaffold, component library, runtime parity, packaged as `suraido`).
Next: tests, CI, docs, and a `create-suraido` scaffolder. Contributions welcome once the API settles.

## License

[MIT](./LICENSE) © Alvaro Gaona

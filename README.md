# suraido

**スライド** — a slide framework on [Astro](https://astro.build).

Author slides as components; the deck runs as a **single Astro page** with a client-side runtime — letterbox
scaling, navigation, fragments, an overview grid, **native-resolution portals**, a presenter view, and PDF
export. Named for the Japanese word for "slide."

```
packages/suraido/   the framework — components, DeckLayout, runtime, Presenter, PDF export,
                    KaTeX <Math>, and an Astro integration.
demo/               a suraido deck about suraido (dev playground + showcase).
packages/create-suraido/   the `npm create suraido` scaffolder.
```

## Create a deck

```bash
npm create suraido@latest my-deck      # or: bun create suraido my-deck
cd my-deck
npm run dev                            # http://localhost:4321
```

Scaffolds an Astro project wired to suraido with a starter deck. `--no-install` / `--no-git` skip the prompts.

## Use it in an existing project

```js
// astro.config.mjs
import suraido from "suraido";           // wires Tailwind v4 + injects the /presenter route
export default defineConfig({ integrations: [suraido()] });
```

**Options:**

| Option  | Default      | Description |
|---------|--------------|-------------|
| `theme` | `"midnight"` | Color theme. A built-in preset (`"midnight"` \| `"light"`) or a path to your own `.css` file (project-relative) that sets the `--deck-*` variables. |
| `fonts` | Inter / JetBrains Mono / serif | Fonts for the three slots: `{ sans, mono, serif }`. Each is a bundled key or a raw `font-family` string. |
| `math`  | `true`       | KaTeX/LaTeX support (the `<Math>` component + its stylesheet). Set `false` to drop KaTeX entirely — `<Math>` renders the raw LaTeX. |

```js
export default defineConfig({
  integrations: [suraido({ theme: "light", math: false })],
});
```

A custom theme is just a CSS file setting the variable contract:

```css
/* my-theme.css → suraido({ theme: "./my-theme.css" }) */
:root {
  --deck-bg: #0d1117;
  --deck-fg: #e6edf3;
  --deck-accent: #ff7b72;
  /* …see the built-ins for the full list… */
}
```

### Fonts

Three font slots — **`--deck-font`** (sans), **`--deck-font-mono`**, **`--deck-font-serif`** — with matching
`.deck-sans` / `.deck-mono` / `.deck-serif` utility classes. Defaults: **Inter** + **JetBrains Mono**, serif =
system.

**Bundled fonts** — pass a key and suraido self-hosts it; only the fonts you actually pick are shipped:

| Key | Font | Good for |
|-----|------|----------|
| `inter`          | Inter (variable)         | sans (default) |
| `geist`          | Geist (variable)         | sans |
| `jetbrains-mono` | JetBrains Mono (variable)| mono (default) |
| `geist-mono`     | Geist Mono (variable)    | mono |
| `geist-pixel`    | Geist Pixel              | display / accents |

```js
export default defineConfig({
  integrations: [suraido({ fonts: { sans: "geist", mono: "geist-mono" } })],
});
```

**Your own font** — load it (Fontsource is easiest) and pass a raw `font-family` string instead of a key:

```js
import "@fontsource-variable/fraunces"; // you load it; suraido just points the slot at it
export default defineConfig({
  integrations: [suraido({ fonts: { serif: '"Fraunces Variable", Georgia, serif' } })],
});
```

### One slide per file (recommended)

Drop each slide in `src/slides/` — suraido collects them **in filename order** (`01-`, `02-`, …):

```astro
---
// src/pages/index.astro
import Deck from "suraido/Deck.astro";
import { collectSlides } from "suraido/slides";
const slides = collectSlides(import.meta.glob("../slides/*.astro", { eager: true }));
---
<Deck title="My talk" slides={slides} />
```

```astro
---
// src/slides/01-cover.astro
import Cover from "suraido/components/Cover.astro";
---
<Cover eyebrow="…" title="Hello." lead="…" number={false} />
```

Reorder or drop slides by renaming/removing files — no central list to keep in sync.

### Or all in one file

Prefer everything inline? Use `DeckLayout` directly:

```astro
---
import DeckLayout from "suraido/DeckLayout.astro";
import Slide from "suraido/components/Slide.astro";
import Math from "suraido/components/Math.astro";
---
<DeckLayout title="My talk">
  <Slide title="Transforms">
    <Math display expr={"T^{W}_{C} = T^{W}_{A}\\, T^{A}_{B}\\, T^{B}_{C}"} />
  </Slide>
</DeckLayout>
```

## Components

- **Layouts:** `Cover` · `Section` · `Statement` · `Slide`
- **Content:** `Columns` · `Grid` · `Card` · `Callout` · `Stat` · `Quote` · `Badge` · `List` · `Table` ·
  `Figure` · `Image` · `Video` · `Steps` + `Step` (fragments)
- **Data:** `Timeline` + `Event` · charts → see below
- **Rich:** `Portal` (native-resolution embeds) · `Math` (KaTeX, build-time) · `<Code>` (Shiki, from
  `astro:components`)

Underneath, components emit `deck-*` utility classes on a themeable `--deck-*` variable contract — usable
directly too.

### Charts (React islands)

Charts use battle-tested [Recharts](https://recharts.org) via React islands — opt-in, so decks that don't
use them stay React-free. Add `@astrojs/react` and install the peers:

```bash
npx astro add react
npm i recharts
```

```astro
---
import { BarChart } from "suraido/react";
---
<BarChart
  client:only="react"
  x="label"
  series={[{ key: "value", label: "Share %" }]}
  data={[{ label: "Static", value: 100 }, { label: "Islands", value: 42 }]}
/>
```

Series colors follow the theme (`--deck-*`). `react`, `react-dom`, and `recharts` are **optional** peer
dependencies — only needed if you import `suraido/react`.

## Runtime

`←/→` navigate (→ steps through `<Steps>` fragments first) · `Home`/`End` jump · `F` fullscreen ·
`O` overview grid · `P` presenter · `#3` deep-links a slide.

## Develop this repo

```bash
bun install
bun run dev         # serve the demo (astro dev, HMR)
bun run build       # static build
bun run typecheck   # astro check
bun run export      # static build + deck.pdf (needs `bunx playwright install chromium`)
```

## Status

Early. The framework builds and runs (component library, runtime parity), is packaged as `suraido`, has CI
(typecheck + build) and a `create-suraido` scaffolder. Next: tests, docs, and npm publish. Contributions
welcome once the API settles.

## License

[MIT](./LICENSE) © Alvaro Gaona

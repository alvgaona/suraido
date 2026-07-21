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

| Option | Default | Description |
|--------|---------|-------------|
| `math` | `true`  | KaTeX/LaTeX support (the `<Math>` component + its stylesheet). Set `false` to drop KaTeX entirely — no stylesheet is loaded and `<Math>` renders the raw LaTeX. |

```js
export default defineConfig({ integrations: [suraido({ math: false })] });
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

`Slide` · `Cover` · `Section` · `Statement` · `Columns` · `Card` · `Callout` · `Stat` · `Quote` · `Badge` ·
`Figure` · `Steps` + `Step` (fragments) · `Portal` (native-resolution embeds) · `Math` (KaTeX, build-time).

Underneath, components emit `deck-*` utility classes on a themeable `--deck-*` variable contract — usable
directly too. Code highlighting is Astro's built-in `<Code>` (Shiki).

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

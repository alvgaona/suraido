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

### Templates

The scaffolder asks which template to start from (or pass `--template <name>`):

| Template | Theme | What you get |
|----------|-------|--------------|
| `default`   | `midnight`  | A minimal starter deck — four slides. |
| `branding`  | `branding`  | Brand guidelines: mission, personality, logo rules, color, type scale, voice, applications. |
| `pitch`     | `pitch`     | Investor pitch: problem, solution, market, traction, model, competition, team, ask. |
| `marketing` | `marketing` | Campaign plan: insight, positioning, pillars, funnel, channels, timeline, KPIs. |

```bash
npm create suraido@latest my-pitch -- --template pitch
```

Each template is just an `astro.config.mjs` plus `src/slides/` — the copy is placeholder text, meant to be
rewritten. Already have a deck? You don't need the scaffolder: every template's look ships as a built-in
theme, so `suraido({ theme: "pitch" })` gets you the palette without touching your slides.

## Use it in an existing project

```js
// astro.config.mjs
import suraido from "suraido";           // wires Tailwind v4 + injects the /presenter route
export default defineConfig({ integrations: [suraido()] });
```

**Options:**

| Option  | Default      | Description |
|---------|--------------|-------------|
| `theme` | `"midnight"` | Color theme. A built-in preset (`"midnight"` \| `"light"` \| `"branding"` \| `"pitch"` \| `"marketing"`) or a path to your own `.css` file (project-relative) that sets the `--deck-*` variables. |
| `fonts` | Inter / JetBrains Mono / serif | Fonts for the three slots: `{ sans, mono, serif }`. Each is a bundled key or a raw `font-family` string. |
| `width` | `1920`       | Design width of a slide, in CSS px — you author against it and the deck scales it to fill the browser. Doubles as the presentation scale: a **smaller** width renders everything **bigger**. |
| `math`  | `true`       | KaTeX/LaTeX support (the `<Math>` component + its stylesheet). Set `false` to drop KaTeX entirely — `<Math>` renders the raw LaTeX. |

```js
export default defineConfig({
  integrations: [suraido({ theme: "light", math: false })],
});
```

**Built-in themes:** `midnight` (warm dark, default) · `light` (warm paper) · `branding` (studio black, serif
display — pair with `fonts: { serif: "fraunces" }`) · `pitch` (crisp projector-safe light) · `marketing`
(violet dark).

A custom theme is just a CSS file setting the variable contract:

```css
/* my-theme.css → suraido({ theme: "./my-theme.css" }) */
:root {
  --deck-bg: #0d1117;
  --deck-fg: #e6edf3;
  --deck-accent: #ff7b72;
  --deck-font-display: var(--deck-font-serif); /* font for big headings (defaults to sans) */
  /* …see the built-ins for the full list… */
}
```

**Dark / light in one deck.** Define both palettes in one file and opt into the chrome's toggle with
`--deck-supports-toggle: 1`. suraido then shows a toggle (also the `T` key), follows the OS preference, and
remembers the choice:

```css
:root {
  --deck-bg: #101010; /* … dark palette … */
  --deck-supports-toggle: 1;
}
:root[data-theme="light"] {
  --deck-bg: #f4f2eb; /* … light palette … */
}
/* Optional no-JS fallback: @media (prefers-color-scheme: light) { :root:not([data-theme]) { … } } */
```

### Sizing

**Everything at once.** Slides are authored against a fixed design width (`1920` by default) that the deck
scales to fill the browser. So the `width` option *is* the presentation scale — drop it and every slide,
including all type, gets proportionally bigger:

```js
suraido({ width: 1600 }) // ~1.2× larger on screen; still fills the window
```

**One component.** suraido declares an explicit cascade order, so overriding never turns into a specificity
fight:

```
Tailwind base (preflight)  <  deck-* components  <  your deck's slide styles  <  Tailwind utilities  <  your CSS
```

Two consequences worth knowing: `class="deck-title text-6xl"` does what it looks like — the **utility wins** —
and unlayered CSS (your stylesheet or theme file) beats everything, so you can restyle any `deck-*` component
with no `!important`, even though suraido's stylesheet loads first:

```css
/* my-theme.css → suraido({ theme: "./my-theme.css" }) */
.deck-title { font-size: 64px; }
.deck-lead  { font-size: 26px; line-height: 1.4; }
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
// src/slides/01-cover.astro — Cover is yours, in src/components/
import Cover from "../components/Cover.astro";
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

- **Layout:** `Slide` — the only slide-level component. suraido ships **no** `Cover`/`Section`/`Statement`:
  what a cover or a divider looks like is a design decision, so the scaffolder puts those in your project
  (`src/components/`) as ordinary compositions over `Slide` for you to edit.
- **Content:** `Columns` · `Grid` · `Card` · `Callout` · `Stat` · `Quote` · `Badge` · `List` + `ListItem` ·
  `Table` · `Figure` · `Image` · `Video` · `Steps` + `Step` (fragments)

```astro
<List reveal>            <!-- `reveal` steps the items; `ordered` makes it an <ol> -->
  <ListItem>Items take real markup — <code class="deck-kbd">inline</code> or components</ListItem>
  <ListItem>No HTML strings to escape</ListItem>
</List>
```
- **Data:** `Timeline` + `Event` · charts and diagrams → see below
- **Math:** `Math` (KaTeX, build-time) · theorem environments → see below
- **Rich:** `Portal` (native-resolution embeds) · `CodeBlock` (Shiki in a
  macOS-style window: traffic lights, optional `title`, copy button, opt-in `numbers`) · `Mermaid`

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

### Theorem environments

amsthm-style environments: `Theorem` · `Lemma` · `Corollary` · `Proposition` · `Conjecture` ·
`Definition` · `Example` · `Remark` · `Proof`.

```astro
<Definition name="Prime">
  An integer <Math expr={"p > 1"} /> is prime when its only divisors are 1 and <Math expr={"p"} />.
</Definition>

<Theorem name="Euclid">There are infinitely many primes.</Theorem>

<Proof>Suppose the primes are finite… — a contradiction.</Proof>
```

They **number themselves** off a shared CSS counter in document order (`Definition 1`, `Theorem 2`, …), so
there is no state to keep in sync. Pass `number="3.1"` to set one yourself, or `number={false}` to drop it.
Following amsthm, theorem-like statements are set in italics and definitions upright; `Proof` is unboxed and
closes with ∎.

Need one that isn't listed? `TheoremBox` is the same box with a free label:

```astro
<TheoremBox kind="Axiom">Every deck has a cover slide.</TheoremBox>
```

### Diagrams (Mermaid)

Flowcharts, sequence diagrams and the rest via [Mermaid](https://mermaid.js.org) — same deal: opt-in, so
decks without diagrams ship none of it.

```bash
npm i mermaid
```

Each diagram lives in its own `.mmd` file, imported with Vite's `?raw` — so you get Mermaid syntax
highlighting, formatters and linters leave it alone, and it arrives already typed as a `string` (no setup):

```astro
---
import Mermaid from "suraido/components/Mermaid.astro";
import flow from "../diagrams/pipeline.mmd?raw";
---
<Mermaid chart={flow} caption="how a deck is built" />
```

Diagrams are themed from the `--deck-*` palette and **re-render when you flip dark/light**, so they never
end up as a dark diagram on a light slide. `mermaid` is an **optional** peer dependency.

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

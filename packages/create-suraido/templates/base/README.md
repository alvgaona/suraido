# suraido deck

A slide deck built with [suraido](https://github.com/alvgaona/suraido).

```bash
npm run dev      # http://localhost:4321
npm run build    # static site → dist/
```

Each slide is a file in `src/slides/`, collected in filename order (`01-`, `02-`, …). Add, remove, or reorder
slides by editing files there. Compose from components (`Cover`, `Section`, `Slide`, `Card`, `Callout`,
`Columns`, `Stat`, `Quote`, `Steps`, `Portal`, `Math`, …).

The copy in the slides is placeholder — rewrite it. The look comes from the theme picked in
`astro.config.mjs` (`midnight` · `light` · `branding` · `pitch` · `marketing`, or a path to your own `.css`).

**Present:** `←/→` navigate · `O` overview · `P` presenter · `F` fullscreen.

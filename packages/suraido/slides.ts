// Collect slide files into an ordered list of components. Feed it the result of
// `import.meta.glob("../slides/*.astro", { eager: true })` (the glob must be
// written at the call site so Vite can statically analyze it). Slides are
// ordered by file path, so a numeric prefix (01-, 02-, …) sets the order.
type SlideModule = { default: unknown };

export function collectSlides(modules: Record<string, SlideModule>): unknown[] {
  return Object.keys(modules)
    .sort()
    .map((key) => modules[key]!.default);
}

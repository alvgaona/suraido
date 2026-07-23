declare module "virtual:suraido/options" {
  /** Whether KaTeX/LaTeX math support is enabled (see the `math` integration option). */
  export const math: boolean;
  export const width: number;
  /** Slide-to-slide transition (see the `transition` integration option). */
  export const transition: "fade" | "slide";
}

declare module "virtual:suraido/theme.css";

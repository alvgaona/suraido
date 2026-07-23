// The seam between the deck runtime (deck.ts, vanilla) and the command palette
// (react/CommandPalette.tsx, a React island). The runtime owns all deck state
// and actions; it publishes this controller on `window.__suraidoDeck` and fires
// `DECK_READY` once. The palette consumes it — so the two never drift, and the
// only React in the framework is the palette itself.

export interface SlideRef {
  /** Zero-based position in the deck. */
  index: number;
  /** The slide's `title` (from <Slide title>), or "" if unset. */
  title: string;
  /** The printed page number, or null for slides with `number={false}`. */
  page: number | null;
}

export interface DeckController {
  next(): void;
  prev(): void;
  first(): void;
  last(): void;
  goto(index: number): void;
  overview(): void;
  presenter(): void;
  fullscreen(): void;
  /** Present only when the active theme opts into light/dark (`--deck-supports-toggle`). */
  toggleTheme: (() => void) | null;
  /** Snapshot of the slides, for the palette's "Go to slide" section. */
  slides(): SlideRef[];
  /** The palette calls this so the runtime makes its own keyboard inert while open. */
  setPaletteOpen(open: boolean): void;
}

declare global {
  interface Window {
    __suraidoDeck?: DeckController;
  }
}

/** Fired on `window` once the controller is live. */
export const DECK_READY = "suraido:deck-ready";
/** Fired on `window` to ask the palette to open (e.g. the chrome ⌘K button). */
export const OPEN_PALETTE = "suraido:open-palette";

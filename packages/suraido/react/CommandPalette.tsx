import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "cmdk";
import * as ScrollArea from "@radix-ui/react-scroll-area";
import { useEffect, useState } from "react";
import { type DeckController, DECK_READY, OPEN_PALETTE } from "../deck-api";

// Suraido's built-in command palette. It runs on the real cmdk engine (fuzzy
// filtering, roving selection, a11y) but is themed with the deck's own
// `.deck-cmdk__*` classes rather than shadcn's Tailwind tokens, so it inherits
// the active theme instead of fighting it. It drives the vanilla runtime
// through the controller published on `window.__suraidoDeck` (see deck-api.ts).

type Cmd = {
  id: string;
  label: string;
  keys?: string[];
  hint?: string;
  /** Extra words to match on beyond the label. */
  keywords?: string[];
  run: (c: DeckController) => void;
};

function useController(): DeckController | null {
  const [ctrl, setCtrl] = useState<DeckController | null>(
    typeof window !== "undefined" ? (window.__suraidoDeck ?? null) : null,
  );
  useEffect(() => {
    if (ctrl) return;
    const on = () => setCtrl(window.__suraidoDeck ?? null);
    window.addEventListener(DECK_READY, on);
    return () => window.removeEventListener(DECK_READY, on);
  }, [ctrl]);
  return ctrl;
}

const NAVIGATE: Cmd[] = [
  { id: "next", label: "Next slide", keys: ["→"], keywords: ["forward", "advance"], run: (c) => c.next() },
  { id: "prev", label: "Previous slide", keys: ["←"], keywords: ["back"], run: (c) => c.prev() },
  { id: "first", label: "First slide", keys: ["Home"], keywords: ["start"], run: (c) => c.first() },
  { id: "last", label: "Last slide", keys: ["End"], run: (c) => c.last() },
];
const VIEW: Cmd[] = [
  { id: "overview", label: "Overview grid", keys: ["O"], keywords: ["thumbnails", "grid"], run: (c) => c.overview() },
  { id: "presenter", label: "Presenter view", keys: ["P"], keywords: ["notes", "speaker"], run: (c) => c.presenter() },
  { id: "fullscreen", label: "Toggle fullscreen", keys: ["F"], keywords: ["present"], run: (c) => c.fullscreen() },
];
const THEME: Cmd = {
  id: "theme",
  label: "Toggle light / dark",
  keys: ["T"],
  keywords: ["theme", "colour", "color"],
  run: (c) => c.toggleTheme?.(),
};

function Keys({ keys }: { keys: string[] }) {
  return (
    <span className="deck-cmdk__keys">
      {keys.map((k) => (
        <kbd key={k}>{k}</kbd>
      ))}
    </span>
  );
}

function Row({ cmd, onRun }: { cmd: Cmd; onRun: (cmd: Cmd) => void }) {
  return (
    <CommandItem
      className="deck-cmdk__item"
      value={`${cmd.label} ${(cmd.keywords ?? []).join(" ")}`}
      keywords={cmd.keywords}
      onSelect={() => onRun(cmd)}
    >
      <span className="deck-cmdk__label">{cmd.label}</span>
      {cmd.keys ? <Keys keys={cmd.keys} /> : cmd.hint ? <span className="deck-cmdk__hint">{cmd.hint}</span> : null}
    </CommandItem>
  );
}

export default function CommandPalette() {
  const controller = useController();
  const [open, setOpen] = useState(false);

  // ⌘K / Ctrl-K toggles; the chrome button opens via a custom event.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_PALETTE, onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_PALETTE, onOpen);
    };
  }, []);

  // Tell the runtime to go inert while the palette is open.
  useEffect(() => {
    controller?.setPaletteOpen(open);
  }, [open, controller]);

  const run = (cmd: Cmd) => {
    setOpen(false);
    // Let the dialog close before the action fires (fullscreen, presenter popup).
    requestAnimationFrame(() => controller && cmd.run(controller));
  };

  const showTheme = !!controller?.toggleTheme;

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      label="Command palette"
      className="deck-cmdk"
      overlayClassName="deck-cmdk-overlay"
      contentClassName="deck-cmdk-content"
    >
      <div className="deck-cmdk__field">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <CommandInput className="deck-cmdk__input" placeholder="Type a command…" />
      </div>
      {/* cmdk's List holds the items; the Radix ScrollArea viewport owns the
          scroll, so cmdk's keyboard scrollIntoView drives the shadcn scrollbar. */}
      <ScrollArea.Root className="deck-cmdk-scroll" type="scroll" scrollHideDelay={500}>
        <ScrollArea.Viewport className="deck-cmdk-viewport">
          <CommandList className="deck-cmdk__list">
            <CommandEmpty className="deck-cmdk__empty">No matches</CommandEmpty>
            <CommandGroup className="deck-cmdk__group" heading="Navigate">
              {NAVIGATE.map((c) => (
                <Row key={c.id} cmd={c} onRun={run} />
              ))}
            </CommandGroup>
            <CommandGroup className="deck-cmdk__group" heading="View">
              {VIEW.map((c) => (
                <Row key={c.id} cmd={c} onRun={run} />
              ))}
              {showTheme && <Row cmd={THEME} onRun={run} />}
            </CommandGroup>
          </CommandList>
        </ScrollArea.Viewport>
        <ScrollArea.Scrollbar className="deck-cmdk-bar" orientation="vertical">
          <ScrollArea.Thumb className="deck-cmdk-thumb" />
        </ScrollArea.Scrollbar>
      </ScrollArea.Root>
    </CommandDialog>
  );
}

// Client runtime for the single-page Astro deck: letterbox scaling, slide
// navigation, fragments, overview grid, native-resolution portals, and
// presenter sync (BroadcastChannel). All same-document — no iframes for slides.
import { width as BASE_W } from "virtual:suraido/options";

// Nominal 16:9 height for the design width; the live height is fluid (see fit).
const BASE_H = Math.round((BASE_W * 9) / 16);
const SYNC = "deck-sync";

type Reveal = "start" | "all";
type SyncMessage =
  | { t: "state"; index: number; step: number; total: number }
  | { t: "cmd"; cmd: "next" | "prev" | "sync" };

export function initDeck(): void {
  const canvas = document.getElementById("deck-canvas");
  const stage = document.getElementById("deck-stage");
  const progress = document.getElementById("deck-progress");
  const pageno = document.getElementById("deck-pageno");
  const overview = document.getElementById("deck-overview");
  const titleEl = document.querySelector<HTMLElement>("#deck-chrome .deck-chrome-title");
  const liveEl = document.getElementById("deck-live");
  const slides = Array.from(document.querySelectorAll<HTMLElement>(".deck-slide"));
  if (!canvas || slides.length === 0) return;

  const numberOf = new Map<number, number>();
  let numbered = 0;
  slides.forEach((el, i) => {
    if (el.dataset.number !== "false") numberOf.set(i, (numbered += 1));
  });
  const numberedTotal = numbered;

  // Media settles its height only after loading — re-fit the slide it's on.
  slides.forEach((sl) =>
    sl.querySelectorAll<HTMLElement>("img, video").forEach((m) => {
      const refit = () => { if (sl.classList.contains("is-active")) fitContent(sl); };
      m.addEventListener("load", refit);
      m.addEventListener("loadedmetadata", refit);
    }),
  );

  // Preview mode (presenter thumbnails): render a slide, but stay passive — no
  // sync channel, keyboard, or portals, so previews never drive the real deck.
  const preview = new URLSearchParams(location.search).has("preview");

  const stepOf = new Map<number, number>();
  const portals = new Map<HTMLElement, HTMLIFrameElement>(); // slot -> native iframe
  const sync = !preview && typeof BroadcastChannel !== "undefined" ? new BroadcastChannel(SYNC) : null;
  let current = 0;
  let scale = 1;
  let designH = BASE_H; // fluid design height (canvas fills the viewport width)
  let toggleTheme: (() => void) | null = null;

  // ── Theme (dark / light) ────────────────────────────────────────────
  // Applies a stored or system theme, and — only if the active theme opts in
  // via `--deck-supports-toggle` — wires the chrome toggle + `T` key.
  function initTheme(): (() => void) | null {
    const root = document.documentElement;
    const stored = (() => { try { return localStorage.getItem("deck-theme"); } catch { return null; } })();
    const system = matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
    root.dataset.theme = stored === "light" || stored === "dark" ? stored : system;
    const btn = document.getElementById("deck-theme-toggle");
    const paint = () => { if (btn) btn.textContent = root.dataset.theme === "light" ? "☾" : "☀"; };
    paint();
    if (!getComputedStyle(root).getPropertyValue("--deck-supports-toggle").trim()) return null;
    document.body.classList.add("deck-has-toggle");
    const toggle = () => {
      root.dataset.theme = root.dataset.theme === "light" ? "dark" : "light";
      try { localStorage.setItem("deck-theme", root.dataset.theme); } catch { /* ignore */ }
      paint();
    };
    btn?.addEventListener("click", toggle);
    return toggle;
  }

  // ── Scaling ─────────────────────────────────────────────────────────
  // Fill the full viewport width (design width stays 1920), and let the design
  // height flex to fill the height too — so the slide takes the whole browser,
  // no letterbox bars. Export runs at a 1920×1080 viewport, keeping a true 16:9.
  function fit() {
    scale = window.innerWidth / BASE_W;
    designH = window.innerHeight / scale;
    canvas!.style.height = `${designH}px`;
    canvas!.style.transform = `translate(-50%, -50%) scale(${scale})`;
    canvas!.style.visibility = "visible";
    fitContent(slides[current]!);
    positionPortals();
  }

  // ── Fit-to-height ──────────────────────────────────────────────────
  // If a slide's content is taller than its (fluid) height, scale the content
  // layer down so it fits — nothing overflows the frame at any window shape.
  function fitContent(slide: HTMLElement) {
    const layer = slide.querySelector<HTMLElement>(".slide-fit");
    if (!layer) return;
    layer.style.transform = "";
    const avail = layer.clientHeight;
    if (avail <= 0) return;
    const needed = layer.scrollHeight;
    if (needed > avail + 1) layer.style.transform = `scale(${avail / needed})`;
  }

  // ── Fragments (same-document) ──────────────────────────────────────
  // `<List reveal>` items step like fragments too, so <ListItem> stays plain.
  const FRAGMENTS = ".deck-fragment, .deck-list--reveal > li";
  const fragmentsIn = (i: number) =>
    Array.from(slides[i]!.querySelectorAll<HTMLElement>(FRAGMENTS));

  function applyStep(i: number) {
    const frs = fragmentsIn(i);
    const step = stepOf.get(i) ?? 0;
    frs.forEach((el, idx) => el.classList.toggle("deck-fragment--visible", idx < step));
  }
  function setFragments(i: number, reveal: Reveal) {
    stepOf.set(i, reveal === "start" ? 0 : fragmentsIn(i).length);
    applyStep(i);
  }

  // ── Portals (native resolution, positioned over their in-slide slot) ─
  function positionPortals() {
    for (const [slot, frame] of portals) {
      const r = slot.getBoundingClientRect();
      frame.style.left = `${r.left}px`;
      frame.style.top = `${r.top}px`;
      frame.style.width = `${r.width}px`;
      frame.style.height = `${r.height}px`;
    }
  }
  function updatePortals() {
    if (preview) return; // previews don't boot heavy embeds
    // Hide all, then show + (lazily create) the active slide's portals.
    for (const [, frame] of portals) frame.classList.remove("deck-portal--open");
    const slots = slides[current]!.querySelectorAll<HTMLElement>(".deck-portal-slot");
    slots.forEach((slot) => {
      let frame = portals.get(slot);
      if (!frame) {
        frame = document.createElement("iframe");
        frame.className = "deck-portal";
        frame.setAttribute("scrolling", "no");
        frame.setAttribute("allow", "cross-origin-isolated; fullscreen; autoplay; clipboard-write");
        frame.src = slot.dataset.portalSrc ?? "";
        stage!.appendChild(frame);
        portals.set(slot, frame);
      }
      frame.classList.add("deck-portal--open");
    });
    positionPortals();
  }

  // ── Render ──────────────────────────────────────────────────────────
  function render() {
    slides.forEach((el, i) => el.classList.toggle("is-active", i === current));
    const slide = slides[current]!;
    fitContent(slide);
    if (titleEl) titleEl.textContent = slide.dataset.title ?? "";
    if (progress) {
      const pct = ((current + 1) / slides.length) * 100;
      progress.style.width = `${pct}%`;
      progress.setAttribute("aria-valuenow", String(Math.round(pct)));
    }
    if (pageno) {
      if (numberOf.has(current)) {
        pageno.textContent = `${numberOf.get(current)} / ${numberedTotal}`;
        pageno.style.display = "block";
      } else {
        pageno.style.display = "none";
      }
    }
    if (liveEl) liveEl.textContent = `Slide ${current + 1} of ${slides.length}${slide.dataset.title ? `: ${slide.dataset.title}` : ""}`;
    const hash = `#${current + 1}`;
    if (location.hash !== hash) history.replaceState(null, "", hash);
    updatePortals();
    broadcast();
  }

  function go(i: number, reveal: Reveal = "all") {
    const next = Math.max(0, Math.min(slides.length - 1, i));
    if (next === current) return;
    current = next;
    render();
    setFragments(current, reveal);
  }

  function next() {
    const frs = fragmentsIn(current);
    const step = stepOf.get(current) ?? 0;
    if (step < frs.length) {
      stepOf.set(current, step + 1);
      applyStep(current);
      broadcast();
      return;
    }
    go(current + 1, "start");
  }
  function prev() {
    const step = stepOf.get(current) ?? 0;
    if (step > 0) {
      stepOf.set(current, step - 1);
      applyStep(current);
      broadcast();
      return;
    }
    go(current - 1, "all");
  }

  // ── Overview grid (scaled DOM clones) ──────────────────────────────
  const isOverviewOpen = () => overview?.classList.contains("open") ?? false;
  function buildOverview() {
    if (!overview) return;
    overview.innerHTML = "";
    const cols = 4;
    const cellScale = (window.innerWidth / cols - 30) / BASE_W;
    slides.forEach((slide, i) => {
      const cell = document.createElement("button");
      cell.className = "deck-ov-cell" + (i === current ? " is-current" : "");
      cell.style.aspectRatio = `${BASE_W} / ${designH}`; // match the live slide shape
      cell.setAttribute("aria-label", `Go to slide ${i + 1}${slide.dataset.title ? `: ${slide.dataset.title}` : ""}`);
      fitContent(slide); // so the thumbnail matches the fitted live slide
      const clone = slide.querySelector(".slide-root")!.cloneNode(true) as HTMLElement;
      clone.classList.add("deck-ov-thumb");
      clone.style.width = `${BASE_W}px`;
      clone.style.height = `${designH}px`;
      clone.style.transform = `scale(${cellScale})`;
      const label = document.createElement("div");
      label.className = "deck-ov-label";
      label.innerHTML = `<b>${numberOf.has(i) ? numberOf.get(i) : "•"}</b><span>${slide.dataset.title ?? ""}</span>`;
      cell.append(clone, label);
      cell.addEventListener("click", () => {
        closeOverview();
        go(i);
      });
      overview.appendChild(cell);
    });
  }
  function openOverview() {
    buildOverview();
    overview?.classList.add("open");
    for (const [, frame] of portals) frame.classList.remove("deck-portal--open");
  }
  function closeOverview() {
    overview?.classList.remove("open");
    updatePortals();
  }

  // ── Presenter sync ─────────────────────────────────────────────────
  function broadcast() {
    sync?.postMessage({ t: "state", index: current, step: stepOf.get(current) ?? 0, total: slides.length } satisfies SyncMessage);
  }
  if (sync) {
    sync.onmessage = (e: MessageEvent<SyncMessage>) => {
      const m = e.data;
      if (m.t !== "cmd") return;
      if (m.cmd === "next") next();
      else if (m.cmd === "prev") prev();
      else if (m.cmd === "sync") broadcast();
    };
  }
  function openPresenter() {
    window.open(`presenter/${location.hash}`, "deck-presenter", "popup,width=1280,height=800");
  }

  // ── Keyboard + chrome (skipped in passive preview mode) ────────────
  if (!preview) window.addEventListener("keydown", (e) => {
    if (isOverviewOpen() && e.key !== "o" && e.key !== "O" && e.key !== "Escape") return;
    switch (e.key) {
      case "ArrowRight": case "PageDown": case " ": e.preventDefault(); next(); break;
      case "ArrowLeft": case "PageUp": e.preventDefault(); prev(); break;
      case "Home": e.preventDefault(); go(0); break;
      case "End": e.preventDefault(); go(slides.length - 1); break;
      case "o": case "O": e.preventDefault(); isOverviewOpen() ? closeOverview() : openOverview(); break;
      case "Escape": if (isOverviewOpen()) { e.preventDefault(); closeOverview(); } break;
      case "p": case "P": e.preventDefault(); openPresenter(); break;
      case "t": case "T": e.preventDefault(); toggleTheme?.(); break;
      case "f": case "F":
        e.preventDefault();
        if (document.fullscreenElement) void document.exitFullscreen();
        else void document.documentElement.requestFullscreen();
        break;
    }
  });
  window.addEventListener("resize", fit);
  window.addEventListener("hashchange", () => {
    const n = parseInt(location.hash.slice(1), 10);
    if (!Number.isNaN(n)) go(n - 1);
  });
  let hideTimer: ReturnType<typeof setTimeout> | undefined;
  window.addEventListener("mousemove", () => {
    document.body.classList.add("deck-show-chrome");
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => document.body.classList.remove("deck-show-chrome"), 2200);
  });

  document.querySelector("[data-next]")?.addEventListener("click", () => next());
  document.querySelector("[data-prev]")?.addEventListener("click", () => prev());

  // ── Boot ────────────────────────────────────────────────────────────
  toggleTheme = initTheme();
  const start = parseInt(location.hash.slice(1), 10);
  if (!Number.isNaN(start)) current = Math.max(0, Math.min(slides.length - 1, start - 1));
  fit();
  render();
  setFragments(current, "all");
  requestAnimationFrame(fit);
  window.addEventListener("load", fit);
  document.fonts?.ready.then(() => fitContent(slides[current]!));
}

// Client runtime for the single-page Astro deck: letterbox scaling, slide
// navigation, fragments, overview grid, native-resolution portals, and
// presenter sync (BroadcastChannel). All same-document — no iframes for slides.
const BASE_W = 1920;
const BASE_H = 1080;
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

  // Preview mode (presenter thumbnails): render a slide, but stay passive — no
  // sync channel, keyboard, or portals, so previews never drive the real deck.
  const preview = new URLSearchParams(location.search).has("preview");

  const stepOf = new Map<number, number>();
  const portals = new Map<HTMLElement, HTMLIFrameElement>(); // slot -> native iframe
  const sync = !preview && typeof BroadcastChannel !== "undefined" ? new BroadcastChannel(SYNC) : null;
  let current = 0;
  let scale = 1;

  // ── Scaling ─────────────────────────────────────────────────────────
  function fit() {
    scale = Math.min(window.innerWidth / BASE_W, window.innerHeight / BASE_H);
    canvas!.style.transform = `translate(-50%, -50%) scale(${scale})`;
    canvas!.style.visibility = "visible";
    positionPortals();
  }

  // ── Fragments (same-document) ──────────────────────────────────────
  const fragmentsIn = (i: number) =>
    Array.from(slides[i]!.querySelectorAll<HTMLElement>(".deck-fragment"));

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
      cell.setAttribute("aria-label", `Go to slide ${i + 1}${slide.dataset.title ? `: ${slide.dataset.title}` : ""}`);
      const clone = slide.querySelector(".slide-root")!.cloneNode(true) as HTMLElement;
      clone.classList.add("deck-ov-thumb");
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
  const start = parseInt(location.hash.slice(1), 10);
  if (!Number.isNaN(start)) current = Math.max(0, Math.min(slides.length - 1, start - 1));
  fit();
  render();
  setFragments(current, "all");
  requestAnimationFrame(fit);
  window.addEventListener("load", fit);
}

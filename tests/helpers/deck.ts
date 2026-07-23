// Test harness: serve the built demo deck and drive it in headless Chromium.
// Requires `demo/dist` (the root `test` script builds it first).
import { chromium, type Browser, type Page } from "playwright";
import { existsSync } from "node:fs";
import { extname, join, resolve } from "node:path";

export const DIST = resolve(import.meta.dir, "../../demo/dist");

const TYPES: Record<string, string> = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "text/javascript",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".mp4": "video/mp4",
};

export interface Harness {
  origin: string;
  browser: Browser;
  /** Open the deck at a slide (1-based) in a viewport, ready to assert on. */
  open(opts: { width: number; height: number; slide?: number; colorScheme?: "light" | "dark" }): Promise<Page>;
  stop(): Promise<void>;
}

export async function startHarness(): Promise<Harness> {
  if (!existsSync(join(DIST, "index.html"))) {
    throw new Error(`suraido tests: ${DIST}/index.html missing — run \`bun run build\` first.`);
  }

  const server = Bun.serve({
    port: 0,
    idleTimeout: 60,
    async fetch(req) {
      let p = new URL(req.url).pathname;
      if (p === "/") p = "/index.html";
      if (p.endsWith("/")) p += "index.html";
      const file = Bun.file(join(DIST, p));
      if (!(await file.exists())) return new Response("404", { status: 404 });
      return new Response(file, {
        headers: { "content-type": TYPES[extname(p)] ?? "application/octet-stream" },
      });
    },
  });

  const origin = `http://localhost:${server.port}`;
  const browser = await chromium.launch();

  return {
    origin,
    browser,
    async open({ width, height, slide = 1, colorScheme }) {
      const page = await browser.newPage({ viewport: { width, height }, colorScheme });
      // Keep runs hermetic + fast: the deck's own assets are same-origin, so
      // anything else (sample image/video CDNs) is blocked rather than fetched.
      await page.route("**/*", (route) =>
        route.request().url().startsWith(origin) ? route.continue() : route.abort(),
      );
      await page.goto(`${origin}/#${slide}`, { waitUntil: "domcontentloaded" });
      await waitReady(page);
      return page;
    },
    async stop() {
      await browser.close();
      server.stop(true);
    },
  };
}

/** Wait until the runtime has scaled the canvas, activated a slide, and settled. */
export async function waitReady(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const canvas = document.getElementById("deck-canvas");
    return !!canvas && canvas.style.visibility === "visible" && !!document.querySelector(".deck-slide.is-active");
  });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(120); // let fit/auto-fit settle after fonts
}

export function slideCount(page: Page): Promise<number> {
  // Not hardcoded: the demo has a gitignored local-video slide that only exists
  // on the author's machine, so the count differs between local runs and CI.
  return page.evaluate(() => document.querySelectorAll(".deck-slide").length);
}

/** How far the active slide's content spills past its frame, in CSS px. */
export function overflowPx(page: Page): Promise<number> {
  return page.evaluate(() => {
    const root = document.querySelector<HTMLElement>(".deck-slide.is-active .slide-root");
    if (!root) return 0;
    const frame = root.getBoundingClientRect();
    let worst = 0;
    for (const el of root.querySelectorAll<HTMLElement>("*")) {
      const box = el.getBoundingClientRect();
      if (box.height === 0 && box.width === 0) continue;
      worst = Math.max(worst, box.bottom - frame.bottom, frame.top - box.top);
    }
    return Math.round(worst);
  });
}

/** The auto-fit scale applied to the active slide's content layer (1 = untouched). */
export function fitScale(page: Page): Promise<number> {
  return page.evaluate(() => {
    const layer = document.querySelector<HTMLElement>(".deck-slide.is-active .slide-fit");
    const match = layer?.style.transform.match(/scale\(([\d.]+)\)/);
    return match ? parseFloat(match[1]!) : 1;
  });
}

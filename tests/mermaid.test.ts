// Mermaid diagrams: render on the client and follow the deck's palette.
import { afterAll, beforeAll, expect, test } from "bun:test";
import type { Page } from "playwright";
import { startHarness, waitReady, type Harness } from "./helpers/deck";

let h: Harness;
beforeAll(async () => { h = await startHarness(); });
afterAll(async () => { await h.stop(); });

/** Open the demo's diagram slide, found by title so slide numbers can move. */
async function openDiagrams(colorScheme?: "light" | "dark"): Promise<Page> {
  const page = await h.open({ width: 1920, height: 1080, colorScheme });
  const index = await page.evaluate(
    () =>
      [...document.querySelectorAll<HTMLElement>(".deck-slide")].findIndex(
        (s) => s.dataset.title === "Diagrams",
      ) + 1,
  );
  expect(index).toBeGreaterThan(0);
  await page.evaluate((n) => { location.hash = `#${n}`; }, index);
  await waitReady(page);
  return page;
}

const nodeFill = (page: Page) =>
  page.evaluate(() => {
    const rect = document.querySelector<SVGElement>(".deck-mermaid svg rect");
    return rect ? getComputedStyle(rect).fill : "";
  });

test("renders the definition to inline SVG", async () => {
  const page = await openDiagrams();
  const info = await page.evaluate(() => {
    const svg = document.querySelector(".deck-mermaid svg");
    return {
      hasSvg: !!svg,
      shapes: document.querySelectorAll(".deck-mermaid svg rect").length,
      text: svg?.textContent ?? "",
      // The raw definition must not be left visible as text.
      leaked: (document.querySelector(".deck-mermaid__graph")?.textContent ?? "").includes("flowchart LR"),
    };
  });
  expect(info.hasSvg).toBe(true);
  expect(info.shapes).toBeGreaterThan(0);
  expect(info.text).toContain("PDF export"); // a node from the demo diagram
  expect(info.leaked).toBe(false);
  await page.close();
});

test("re-renders with the new palette when the theme flips", async () => {
  const page = await openDiagrams("dark");
  const before = await nodeFill(page);
  expect(before).toBeTruthy();

  await page.click("#deck-theme-toggle");
  // The MutationObserver re-renders the diagram; wait for the paint to change.
  await page.waitForFunction(
    (prev) => {
      const rect = document.querySelector<SVGElement>(".deck-mermaid svg rect");
      return !!rect && getComputedStyle(rect).fill !== prev;
    },
    before,
    { timeout: 5000 },
  );
  expect(await nodeFill(page)).not.toBe(before);
  await page.close();
});

test("diagram slides still fit the frame", async () => {
  // Diagrams are sized by Mermaid, not by us — make sure one can't push a slide
  // past its frame (auto-fit should absorb it).
  const { overflowPx } = await import("./helpers/deck");
  for (const vp of [{ width: 1920, height: 1080 }, { width: 2560, height: 940 }]) {
    const page = await h.open(vp);
    const index = await page.evaluate(
      () => [...document.querySelectorAll<HTMLElement>(".deck-slide")].findIndex((s) => s.dataset.title === "Diagrams") + 1,
    );
    await page.evaluate((n) => { location.hash = `#${n}`; }, index);
    await waitReady(page);
    expect(await overflowPx(page)).toBeLessThanOrEqual(2);
    await page.close();
  }
});

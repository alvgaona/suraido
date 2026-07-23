// The two sizing knobs: author CSS can restyle any component (cascade layer),
// and the design width drives the presentation scale.
import { afterAll, beforeAll, expect, test } from "bun:test";
import { startHarness, type Harness } from "./helpers/deck";

let h: Harness;
beforeAll(async () => { h = await startHarness(); });
afterAll(async () => { await h.stop(); });

test("author CSS overrides framework component styles without !important", async () => {
  const page = await h.open({ width: 1920, height: 1080, slide: 3 });
  const read = () =>
    page.evaluate(() => getComputedStyle(document.querySelector(".deck-slide.is-active .deck-title")!).fontSize);

  const framework = await read();
  expect(framework).not.toBe("40px");

  // Unlayered author CSS must beat the framework's @layer suraido rules —
  // same specificity, no !important, and it does not matter that the framework
  // stylesheet is loaded first.
  await page.addStyleTag({ content: ".deck-title { font-size: 40px; }" });
  expect(await read()).toBe("40px");
  await page.close();
});

test("the design width drives the canvas and the scale", async () => {
  const page = await h.open({ width: 1920, height: 1080 });
  const geom = await page.evaluate(() => {
    const canvas = document.getElementById("deck-canvas")!;
    return {
      cssVar: getComputedStyle(document.documentElement).getPropertyValue("--deck-width").trim(),
      // offsetWidth is the pre-transform design width; the rect is post-scale.
      design: canvas.offsetWidth,
      rendered: Math.round(canvas.getBoundingClientRect().width),
      viewport: window.innerWidth,
    };
  });
  // CSS and the runtime agree on one design width…
  expect(geom.cssVar).toBe(`${geom.design}px`);
  // …and whatever it is, the deck still fills the browser (scale = vw / width).
  expect(Math.abs(geom.rendered - geom.viewport)).toBeLessThanOrEqual(1);
  await page.close();
});

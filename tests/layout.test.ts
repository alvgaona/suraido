// Layout guarantees: the deck fills the browser width, and no slide's content
// ever spills out of its frame — at any window shape.
import { afterAll, beforeAll, expect, test } from "bun:test";
import { fitScale, overflowPx, slideCount, startHarness, waitReady, type Harness } from "./helpers/deck";

const VIEWPORTS = [
  { name: "16:9", width: 1920, height: 1080 },
  { name: "wide/short (design height shrinks)", width: 2560, height: 940 },
  { name: "narrow/tall (design height grows)", width: 1200, height: 1000 },
];

let h: Harness;
beforeAll(async () => { h = await startHarness(); });
afterAll(async () => { await h.stop(); });

for (const vp of VIEWPORTS) {
  test(`canvas fills the full viewport width — ${vp.name}`, async () => {
    const page = await h.open({ width: vp.width, height: vp.height });
    const box = await page.evaluate(() => {
      const r = document.getElementById("deck-canvas")!.getBoundingClientRect();
      return { left: r.left, width: r.width, vw: window.innerWidth };
    });
    // No letterbox bars: the canvas starts at x=0 and spans the whole width.
    expect(Math.abs(box.left)).toBeLessThanOrEqual(1);
    expect(Math.abs(box.width - box.vw)).toBeLessThanOrEqual(1);
    await page.close();
  });

  test(`no slide overflows its frame — ${vp.name}`, async () => {
    const page = await h.open({ width: vp.width, height: vp.height });
    const total = await slideCount(page);
    expect(total).toBeGreaterThan(0);

    const spills: string[] = [];
    for (let i = 1; i <= total; i++) {
      await page.evaluate((n) => { location.hash = `#${n}`; }, i);
      await waitReady(page);
      const over = await overflowPx(page);
      // Auto-fit scales content down when it is too tall; a couple of px of
      // sub-pixel rounding is fine, anything more is a real spill.
      if (over > 2) {
        const title = await page.evaluate(
          () => (document.querySelector(".deck-slide.is-active") as HTMLElement)?.dataset.title ?? "",
        );
        spills.push(`slide ${i} "${title}" overflows by ${over}px`);
      }
    }
    expect(spills).toEqual([]);
    await page.close();
  });

  test(`auto-fit only ever scales down — ${vp.name}`, async () => {
    const page = await h.open({ width: vp.width, height: vp.height });
    const total = await slideCount(page);
    for (let i = 1; i <= total; i++) {
      await page.evaluate((n) => { location.hash = `#${n}`; }, i);
      await waitReady(page);
      expect(await fitScale(page)).toBeLessThanOrEqual(1);
    }
    await page.close();
  });
}

test("auto-fit is a no-op when the content already fits", async () => {
  // The cover is deliberately sparse — at 16:9 it must render untouched, or
  // we are shrinking slides that had no need to shrink.
  const page = await h.open({ width: 1920, height: 1080, slide: 1 });
  expect(await fitScale(page)).toBe(1);
  await page.close();
});

test("auto-fit engages when content is too tall", async () => {
  // Doesn't rely on any particular slide being dense (the demo's tallest slide
  // is gitignored, so CI would otherwise never exercise this path): force the
  // overflow, then check the runtime clamps it back inside the frame.
  const page = await h.open({ width: 1920, height: 1080, slide: 1 });
  expect(await fitScale(page)).toBe(1);

  await page.evaluate(() => {
    const probe = document.createElement("div");
    probe.style.height = "2000px";
    document.querySelector(".deck-slide.is-active .slide-fit")!.appendChild(probe);
    window.dispatchEvent(new Event("resize")); // runtime re-fits on resize
  });
  await page.waitForTimeout(150);

  expect(await fitScale(page)).toBeLessThan(1);
  expect(await overflowPx(page)).toBeLessThanOrEqual(2);
  await page.close();
});

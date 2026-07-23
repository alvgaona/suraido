// Component behaviour: <List> + <ListItem> render real list markup, and
// `reveal` steps the items like fragments.
import { afterAll, beforeAll, expect, test } from "bun:test";
import { startHarness, waitReady, type Harness } from "./helpers/deck";

let h: Harness;
beforeAll(async () => { h = await startHarness(); });
afterAll(async () => { await h.stop(); });

const LISTS_SLIDE = "Lists & tables";

const slideNumber = (page: import("playwright").Page, title: string) =>
  page.evaluate(
    (t) => [...document.querySelectorAll<HTMLElement>(".deck-slide")].findIndex((s) => s.dataset.title === t) + 1,
    title,
  );

test("<ListItem> children render as real list items, markup intact", async () => {
  const page = await h.open({ width: 1920, height: 1080 });
  const n = await slideNumber(page, LISTS_SLIDE);
  expect(n).toBeGreaterThan(0);
  await page.evaluate((i) => { location.hash = `#${i}`; }, n);
  await waitReady(page);

  const list = await page.evaluate(() => {
    const ul = document.querySelector(".deck-slide.is-active .deck-list")!;
    return {
      tag: ul.tagName,
      items: ul.querySelectorAll(":scope > li").length,
      // Children keep their markup — the whole point over HTML-string items.
      inlineMarkup: ul.querySelectorAll(":scope > li .deck-kbd").length,
      // Bullets survive Tailwind's preflight reset.
      listStyle: getComputedStyle(ul).listStyleType,
    };
  });
  expect(list.tag).toBe("UL");
  expect(list.items).toBe(3);
  expect(list.inlineMarkup).toBeGreaterThan(0);
  expect(list.listStyle).toBe("disc");
  await page.close();
});

test("<List reveal> steps its items one at a time", async () => {
  const page = await h.open({ width: 1920, height: 1080 });
  const n = await slideNumber(page, LISTS_SLIDE);

  // Opt the demo's list into reveal, then walk into the slide from the one
  // before it so the runtime resets the step counter.
  await page.evaluate((i) => {
    const slide = document.querySelectorAll(".deck-slide")[i - 1]!;
    slide.querySelector(".deck-list")!.classList.add("deck-list--reveal");
    location.hash = `#${i - 1}`;
  }, n);
  await waitReady(page);

  const visible = () =>
    page.evaluate(
      (i) =>
        document
          .querySelectorAll(".deck-slide")
          [i - 1]!.querySelectorAll(".deck-list--reveal > li.deck-fragment--visible").length,
      n,
    );

  await page.keyboard.press("ArrowRight"); // enter the slide — nothing revealed yet
  await page.waitForTimeout(150);
  expect(await visible()).toBe(0);

  for (const expected of [1, 2, 3]) {
    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(150);
    expect(await visible()).toBe(expected);
  }

  // Stepping back hides them again.
  await page.keyboard.press("ArrowLeft");
  await page.waitForTimeout(150);
  expect(await visible()).toBe(2);
  await page.close();
});

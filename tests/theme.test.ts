// The dark/light toggle: follows the OS, flips, and remembers the choice.
import { afterAll, beforeAll, expect, test } from "bun:test";
import { startHarness, waitReady, type Harness } from "./helpers/deck";

let h: Harness;
beforeAll(async () => { h = await startHarness(); });
afterAll(async () => { await h.stop(); });

const themeOf = (page: import("playwright").Page) =>
  page.evaluate(() => document.documentElement.dataset.theme);

test("follows the OS preference when nothing is stored", async () => {
  for (const scheme of ["light", "dark"] as const) {
    const page = await h.open({ width: 1440, height: 900, colorScheme: scheme });
    expect(await themeOf(page)).toBe(scheme);
    await page.close();
  }
});

test("the toggle is offered for a dual-mode theme", async () => {
  const page = await h.open({ width: 1440, height: 900 });
  const state = await page.evaluate(() => ({
    optedIn: document.body.classList.contains("deck-has-toggle"),
    display: getComputedStyle(document.getElementById("deck-theme-toggle")!).display,
  }));
  expect(state.optedIn).toBe(true);
  expect(state.display).not.toBe("none");
  await page.close();
});

test("clicking flips the theme and repaints the icon", async () => {
  const page = await h.open({ width: 1440, height: 900, colorScheme: "dark" });
  expect(await themeOf(page)).toBe("dark");

  await page.click("#deck-theme-toggle");
  expect(await themeOf(page)).toBe("light");
  // The palette must actually repaint, not just the attribute flip — allow for
  // the 0.4s theme cross-fade rather than sampling mid-transition.
  await page.waitForFunction(
    () => getComputedStyle(document.body).backgroundColor !== "rgb(16, 16, 16)", // the dark #101010
    null,
    { timeout: 2000 },
  );
  // Icon shows what you'd switch to next.
  expect(await page.textContent("#deck-theme-toggle")).toBe("☾");

  await page.click("#deck-theme-toggle");
  expect(await themeOf(page)).toBe("dark");
  await page.close();
});

test("the choice survives a reload, overriding the OS preference", async () => {
  // OS says dark; the viewer picks light; a reload must keep light.
  const page = await h.open({ width: 1440, height: 900, colorScheme: "dark" });
  await page.click("#deck-theme-toggle");
  expect(await themeOf(page)).toBe("light");

  await page.reload({ waitUntil: "domcontentloaded" });
  await waitReady(page);
  expect(await themeOf(page)).toBe("light");
  await page.close();
});

test("the T key toggles too", async () => {
  const page = await h.open({ width: 1440, height: 900, colorScheme: "dark" });
  await page.keyboard.press("t");
  expect(await themeOf(page)).toBe("light");
  await page.close();
});

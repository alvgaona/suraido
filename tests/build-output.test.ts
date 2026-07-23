// What actually ships: only the fonts the deck selected, and a theme that
// carries the dual-mode contract. Pure build-output assertions, no browser.
import { expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { DIST } from "./helpers/deck";

const assets = readdirSync(join(DIST, "_astro"));
const woff2 = assets.filter((f) => f.endsWith(".woff2"));
const css = assets.filter((f) => f.endsWith(".css")).map((f) => readFileSync(join(DIST, "_astro", f), "utf8")).join("\n");

// The demo config selects geist + geist-mono + fraunces.
const shipped = (family: string) => woff2.some((f) => f.startsWith(`${family}-`));

test("ships the fonts the deck selected", () => {
  expect(shipped("geist")).toBe(true);
  expect(shipped("geist-mono")).toBe(true);
  expect(shipped("fraunces")).toBe(true);
});

test("does NOT ship bundled fonts the deck did not select", () => {
  // The whole point of the on-demand font registry: unselected families must
  // leave no woff2 behind, even though suraido depends on them.
  expect(shipped("inter")).toBe(false);
  expect(shipped("jetbrains-mono")).toBe(false);
});

test("the injected theme carries the dual-mode contract", () => {
  expect(css).toContain("--deck-supports-toggle");
  expect(css).toContain("#101010"); // the dark background
  expect(css).toMatch(/\[data-theme=["']?light["']?\]/); // quotes get minified away
});

test("the display font resolves to the serif slot", () => {
  expect(css).toContain("--deck-font-display");
  expect(css).toContain("Fraunces Variable");
});

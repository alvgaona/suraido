// What actually ships: only the fonts the deck selected, and a theme that
// carries the dual-mode contract. Pure build-output assertions, no browser.
import { expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { DIST } from "./helpers/deck";

const REPO = join(import.meta.dir, "..");

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

test("cascade order puts Tailwind utilities above framework components", () => {
  // Utilities must beat deck-* classes, or `class="deck-title text-6xl"` would
  // silently ignore the utility. Order is declared up front so it never depends
  // on import order: components < suraido < slides < utilities < unlayered.
  const css = readFileSync(join(REPO, "packages/suraido/styles/global.css"), "utf8");
  const decl = css.match(/@layer\s+([^;]+);/)?.[1] ?? "";
  const at = (name: string) => decl.split(",").findIndex((l) => l.trim() === name);
  expect(at("suraido")).toBeGreaterThan(at("base")); // beats preflight
  expect(at("utilities")).toBeGreaterThan(at("suraido")); // utilities win
  expect(at("slides")).toBeGreaterThan(at("suraido")); // a deck's own slide styles win
  expect(at("utilities")).toBeGreaterThan(at("slides"));
});

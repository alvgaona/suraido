// `npm create suraido` must produce a complete, buildable deck for every
// template — base files + the template's own config and slides.
import { afterAll, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const CLI = resolve(import.meta.dir, "../packages/create-suraido/index.js");
const TEMPLATES = ["default", "branding", "pitch", "marketing"] as const;
const BASE_FILES = ["package.json", "astro.config.mjs", "tsconfig.json", ".gitignore", "src/pages/index.astro"];

const workdir = mkdtempSync(join(tmpdir(), "suraido-scaffold-"));
afterAll(() => rmSync(workdir, { recursive: true, force: true }));

function scaffold(template: string, name: string) {
  const result = spawnSync("node", [CLI, name, "--template", template, "--no-install", "--no-git"], {
    cwd: workdir,
    encoding: "utf8",
  });
  return { ...result, dir: join(workdir, name) };
}

for (const template of TEMPLATES) {
  test(`scaffolds a complete deck — ${template}`, () => {
    const name = `deck-${template}`;
    const { status, dir, stderr } = scaffold(template, name);
    expect(status, stderr).toBe(0);

    for (const file of BASE_FILES) {
      expect(existsSync(join(dir, file)), `${template}: missing ${file}`).toBe(true);
    }
    // _gitignore is renamed on the way out — it must not survive.
    expect(existsSync(join(dir, "_gitignore"))).toBe(false);

    const slides = readdirSync(join(dir, "src/slides")).filter((f) => f.endsWith(".astro"));
    expect(slides.length).toBeGreaterThan(0);

    // The project is named after the target directory.
    expect(JSON.parse(readFileSync(join(dir, "package.json"), "utf8")).name).toBe(name);
  });
}

test("rejects an unknown template", () => {
  const { status } = scaffold("nope", "deck-nope");
  expect(status).not.toBe(0);
});

#!/usr/bin/env node
// Scaffold a new suraido slide deck. Interactive by default; flags make it
// scriptable: create-suraido <dir> [--install|--no-install] [--git|--no-git].
import { cp, readFile, readdir, rename, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { cancel, confirm, intro, isCancel, note, outro, spinner, text } from "@clack/prompts";
import color from "picocolors";

const HERE = dirname(fileURLToPath(import.meta.url));
const TEMPLATE = join(HERE, "template");

function detectPM() {
  const ua = process.env.npm_config_user_agent ?? "";
  if (ua.startsWith("bun")) return "bun";
  if (ua.startsWith("pnpm")) return "pnpm";
  if (ua.startsWith("yarn")) return "yarn";
  return "npm";
}

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const positional = args.filter((a) => !a.startsWith("-"));

const bail = (v) => {
  if (isCancel(v)) {
    cancel("Cancelled.");
    process.exit(0);
  }
  return v;
};

intro(color.bold(color.blue("create-suraido")) + color.dim(" · スライド"));

// 1. Target directory.
let dir = positional[0];
if (!dir) {
  dir = bail(
    await text({
      message: "Where should we create your deck?",
      placeholder: "my-deck",
      defaultValue: "my-deck",
      validate: (v) => (v && /[^\s]/.test(v) ? undefined : "Please enter a directory name"),
    }),
  );
}
const target = resolve(process.cwd(), dir);
if (existsSync(target) && (await readdir(target)).length > 0) {
  cancel(`${color.yellow(dir)} already exists and isn't empty.`);
  process.exit(1);
}

// 2. Options (skip prompts when flags are passed).
const install = flag("--install") ? true : flag("--no-install") ? false : bail(await confirm({ message: "Install dependencies?" }));
const git = flag("--git") ? true : flag("--no-git") ? false : bail(await confirm({ message: "Initialize a git repository?" }));

// 3. Scaffold from the bundled template.
await cp(TEMPLATE, target, { recursive: true });
await rename(join(target, "_gitignore"), join(target, ".gitignore"));
const pkgPath = join(target, "package.json");
const pkg = JSON.parse(await readFile(pkgPath, "utf8"));
pkg.name = basename(target).replace(/[^a-z0-9-~]/gi, "-").toLowerCase();
await writeFile(pkgPath, JSON.stringify(pkg, null, 2) + "\n");

const pm = detectPM();

// 4. Optional install + git.
if (install) {
  const s = spinner();
  s.start(`Installing dependencies with ${pm}`);
  const r = spawnSync(pm, ["install"], { cwd: target, stdio: "ignore" });
  r.status === 0 ? s.stop("Dependencies installed.") : s.stop(color.yellow(`${pm} install failed — run it yourself.`));
}
if (git) {
  spawnSync("git", ["init", "-q"], { cwd: target });
  spawnSync("git", ["add", "-A"], { cwd: target });
  spawnSync("git", ["commit", "-q", "-m", "initial commit"], { cwd: target });
}

// 5. Next steps.
const run = pm === "npm" ? "npm run" : pm;
note(
  [
    `${color.dim("cd")} ${dir}`,
    install ? null : `${pm} install`,
    `${run} dev      ${color.dim("# http://localhost:4321")}`,
    color.dim("edit src/pages/index.astro"),
  ]
    .filter(Boolean)
    .join("\n"),
  "Next steps",
);
outro(color.green("Deck ready.") + " " + color.dim("O = overview · P = presenter"));

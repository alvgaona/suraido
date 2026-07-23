#!/usr/bin/env node
// Scaffold a new suraido slide deck. Args/help via citty; interactive prompts
// via @clack/prompts. Flags make it scriptable:
//   create-suraido <dir> [--template default] [--pm npm|bun|pnpm|yarn] [--(no-)install] [--(no-)git]
import { cp, readFile, readdir, rename, writeFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { defineCommand, runMain } from "citty";
import { cancel, confirm, intro, isCancel, note, outro, select, spinner, text } from "@clack/prompts";
import color from "picocolors";

const HERE = dirname(fileURLToPath(import.meta.url));
const { version } = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"));

// A deck is scaffolded as `templates/base` (config, tsconfig, entry page) with
// `templates/<name>` copied over it — so shared files live in exactly one place
// and a template only ships what it changes: its astro.config + its slides.
const TEMPLATES = {
  default: "A minimal starter deck",
  branding: "Brand guidelines — identity, color, type, voice",
  pitch: "Investor pitch — problem, market, traction, ask",
  marketing: "Campaign plan — positioning, funnel, channels, KPIs",
};
const PACKAGE_MANAGERS = ["npm", "bun", "pnpm", "yarn"];

function detectPM() {
  const ua = process.env.npm_config_user_agent ?? "";
  return PACKAGE_MANAGERS.find((pm) => ua.startsWith(pm)) ?? "npm";
}

const bail = (v) => {
  if (isCancel(v)) {
    cancel("Cancelled.");
    process.exit(0);
  }
  return v;
};

const main = defineCommand({
  meta: {
    name: "create-suraido",
    version,
    description: "Scaffold a new suraido slide deck",
  },
  args: {
    dir: { type: "positional", required: false, description: "Target directory (e.g. my-deck)" },
    template: { type: "string", description: `Starter template: ${Object.keys(TEMPLATES).join(" | ")}`, valueHint: "name" },
    pm: { type: "string", description: `Package manager: ${PACKAGE_MANAGERS.join(" | ")}`, valueHint: "name" },
    install: { type: "boolean", description: "Install dependencies (--no-install to skip)" },
    git: { type: "boolean", description: "Initialize a git repository (--no-git to skip)" },
  },
  async run({ args, rawArgs }) {
    // Reliable "was this flag passed?" — independent of boolean defaulting.
    const passed = (name) => rawArgs.includes(`--${name}`) || rawArgs.includes(`--no-${name}`);

    if (args.template && !(args.template in TEMPLATES)) {
      cancel(`Unknown template ${color.yellow(args.template)}. Available: ${Object.keys(TEMPLATES).join(", ")}`);
      process.exit(1);
    }
    if (args.pm && !PACKAGE_MANAGERS.includes(args.pm)) {
      cancel(`Unknown package manager ${color.yellow(args.pm)}. Use: ${PACKAGE_MANAGERS.join(", ")}`);
      process.exit(1);
    }

    intro(color.bold(color.blue("create-suraido")) + color.dim(" · スライド"));

    // 1. Target directory.
    let dir = args.dir;
    if (!dir) {
      dir = bail(
        await text({
          message: "Where should we create your deck?",
          placeholder: "my-deck",
          defaultValue: "my-deck",
          validate: (v) => (v && /\S/.test(v) ? undefined : "Please enter a directory name"),
        }),
      );
    }
    const target = resolve(process.cwd(), dir);
    if (existsSync(target) && (await readdir(target)).length > 0) {
      cancel(`${color.yellow(dir)} already exists and isn't empty.`);
      process.exit(1);
    }

    // 2. Options — use the flag when passed, otherwise prompt.
    const template =
      args.template ??
      bail(
        await select({
          message: "Which template?",
          initialValue: "default",
          options: Object.entries(TEMPLATES).map(([value, hint]) => ({ value, label: value, hint })),
        }),
      );
    const install = passed("install") ? args.install : bail(await confirm({ message: "Install dependencies?" }));
    const git = passed("git") ? args.git : bail(await confirm({ message: "Initialize a git repository?" }));
    const pm = args.pm ?? detectPM();

    // 3. Scaffold: the shared base, then the template copied over it.
    await cp(join(HERE, "templates", "base"), target, { recursive: true });
    await cp(join(HERE, "templates", template), target, { recursive: true, force: true });
    await rename(join(target, "_gitignore"), join(target, ".gitignore"));
    const pkgPath = join(target, "package.json");
    const pkg = JSON.parse(await readFile(pkgPath, "utf8"));
    pkg.name = basename(target).replace(/[^a-z0-9-~]/gi, "-").toLowerCase();
    await writeFile(pkgPath, JSON.stringify(pkg, null, 2) + "\n");

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
        color.dim("edit src/slides/ — one file per slide"),
      ]
        .filter(Boolean)
        .join("\n"),
      "Next steps",
    );
    outro(color.green("Deck ready.") + " " + color.dim("O = overview · P = presenter"));
  },
});

runMain(main);

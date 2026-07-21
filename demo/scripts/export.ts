// Export the built deck to PDF: serve dist/, drive headless Chromium over each
// slide (via the single-page hash runtime), screenshot at 1920×1080, assemble
// with pdf-lib. Run `astro build` first (the `export` npm script does both).
import { chromium } from "playwright";
import { PDFDocument } from "pdf-lib";
import { extname, join, resolve } from "node:path";

const dist = resolve("dist");
const outPdf = resolve("deck.pdf");
const W = 1920;
const H = 1080;
const TYPES: Record<string, string> = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "text/javascript",
  ".woff2": "font/woff2",
  ".svg": "image/svg+xml",
  ".png": "image/png",
};

const server = Bun.serve({
  port: 0,
  async fetch(req) {
    let p = new URL(req.url).pathname;
    if (p === "/") p = "/index.html";
    if (p.endsWith("/")) p += "index.html";
    const f = Bun.file(join(dist, p));
    if (!(await f.exists())) return new Response("404", { status: 404 });
    return new Response(f, { headers: { "content-type": TYPES[extname(p)] ?? "application/octet-stream" } });
  },
});
const base = `http://localhost:${server.port}`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 2 });
await page.goto(`${base}/#1`, { waitUntil: "networkidle" });
const count = await page.evaluate(() => document.querySelectorAll(".deck-slide").length);

const pdf = await PDFDocument.create();
for (let i = 1; i <= count; i++) {
  await page.evaluate((n) => {
    location.hash = `#${n}`;
  }, i);
  await page.waitForTimeout(500);
  const png = await page.screenshot({ clip: { x: 0, y: 0, width: W, height: H } });
  const img = await pdf.embedPng(png);
  pdf.addPage([W, H]).drawImage(img, { x: 0, y: 0, width: W, height: H });
  console.log(`slide ${i}/${count}`);
}
await Bun.write(outPdf, await pdf.save());
console.log(`Exported ${count} slides → ${outPdf}`);
await browser.close();
server.stop();

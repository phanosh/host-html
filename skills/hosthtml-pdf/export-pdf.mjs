#!/usr/bin/env node

/**
 * export-pdf.mjs — Convert host-html slide decks to PDF
 *
 * Usage:
 *   npx puppeteer browsers install chrome  # one-time setup
 *   node export-pdf.mjs <input.html> [output.pdf] [--slides N]
 *
 * If --slides is omitted the script auto-detects the count via `.slide` elements.
 * If output is omitted it defaults to <input-basename>.pdf in the same directory.
 */

import puppeteer from 'puppeteer';
import { join, dirname, basename, resolve } from 'path';

// ── CLI args ────────────────────────────────────────────────────────
const args = process.argv.slice(2);

function flag(name) {
  const i = args.indexOf(name);
  if (i === -1) return undefined;
  const val = args.splice(i, 2)[1];
  return val;
}

const slidesFlag = flag('--slides');
const inputRel = args[0];

if (!inputRel) {
  console.error('Usage: node export-pdf.mjs <input.html> [output.pdf] [--slides N]');
  process.exit(1);
}

const INPUT = resolve(inputRel);
const OUTPUT = args[1]
  ? resolve(args[1])
  : join(dirname(INPUT), basename(INPUT, '.html') + '.pdf');

// ── Main ────────────────────────────────────────────────────────────
(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--font-render-hinting=none'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 2 });
  await page.goto('file://' + INPUT, { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 2000)); // let fonts & first-slide animations settle

  // Auto-detect slide count unless overridden
  const TOTAL = slidesFlag
    ? parseInt(slidesFlag, 10)
    : await page.evaluate(() => document.querySelectorAll('.slide').length);

  if (!TOTAL || TOTAL < 1) {
    console.error('No .slide elements found and --slides not provided.');
    await browser.close();
    process.exit(1);
  }

  console.log(`Exporting ${TOTAL} slides from: ${INPUT}`);

  const pngBuffers = [];

  for (let i = 0; i < TOTAL; i++) {
    await page.evaluate(idx => {
      const slides = document.querySelectorAll('.slide');
      slides.forEach((s, j) => {
        s.classList.toggle('active', j === idx);
        s.style.opacity = j === idx ? '1' : '0';
        s.style.pointerEvents = j === idx ? 'auto' : 'none';
      });
    }, i);

    await new Promise(r => setTimeout(r, 900)); // let reveal animations play
    const buf = await page.screenshot({ type: 'png', fullPage: false });
    pngBuffers.push(buf);
    console.log(`  Captured slide ${i + 1} / ${TOTAL}`);
  }

  await browser.close();

  // ── Assemble PDF: one page per screenshot ─────────────────────────
  const browser2 = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page2 = await browser2.newPage();

  const pages = pngBuffers.map((buf, i) => {
    const b64 = buf.toString('base64');
    const last = i === pngBuffers.length - 1;
    return `<div style="width:1280px;height:720px;overflow:hidden;${last ? '' : 'page-break-after:always;'}">
      <img src="data:image/png;base64,${b64}" style="width:1280px;height:720px;display:block;">
    </div>`;
  }).join('\n');

  await page2.setContent(`<!DOCTYPE html><html><head><style>
    *{margin:0;padding:0;box-sizing:border-box;}
    @page{size:1280px 720px;margin:0;}
    body{background:#031214;}
  </style></head><body>${pages}</body></html>`, { waitUntil: 'networkidle0' });

  await page2.pdf({
    path: OUTPUT,
    width: '1280px',
    height: '720px',
    printBackground: true,
    margin: { top: '0', right: '0', bottom: '0', left: '0' },
  });

  await browser2.close();
  console.log(`\nDone! PDF saved to: ${OUTPUT}`);
})();

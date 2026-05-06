// One-shot script: public/logo.svg → all required PNG/ICO variants
// Run: node tools/generate-logo-assets.mjs
//
// Dependencies are fetched on demand via npx; nothing global is installed.
// Requires: sharp, png-to-ico (resolved via local node_modules or npx fallback).

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const LOGO_SVG = join(ROOT, 'public/logo.svg');

// Lazy import sharp — install once if missing
let sharp;
try {
  sharp = (await import('sharp')).default;
} catch {
  console.error('sharp not installed. Run: npm i -D sharp png-to-ico');
  process.exit(1);
}

let pngToIco;
try {
  pngToIco = (await import('png-to-ico')).default;
} catch {
  console.error('png-to-ico not installed. Run: npm i -D sharp png-to-ico');
  process.exit(1);
}

const svgBuffer = readFileSync(LOGO_SVG);

async function renderSquare(size, outPath, { transparent = true } = {}) {
  mkdirSync(dirname(outPath), { recursive: true });
  const pipeline = sharp(svgBuffer, { density: 384 })
    .resize(size, size, {
      fit: 'contain',
      background: transparent ? { r: 0, g: 0, b: 0, alpha: 0 } : { r: 255, g: 255, b: 255, alpha: 1 },
    })
    .png();
  await pipeline.toFile(outPath);
  console.log(`✓ ${outPath} (${size}×${size})`);
}

async function renderOgImage(outPath) {
  const W = 1200;
  const H = 630;
  const LOGO_SIZE = 360;

  mkdirSync(dirname(outPath), { recursive: true });

  const logoPng = await sharp(svgBuffer, { density: 384 })
    .resize(LOGO_SIZE, LOGO_SIZE, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .png()
    .toBuffer();

  const canvas = sharp({
    create: { width: W, height: H, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } },
  })
    .composite([
      { input: logoPng, top: Math.round((H - LOGO_SIZE) / 2), left: Math.round((W - LOGO_SIZE) / 2) - 200 },
      {
        input: Buffer.from(
          `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="200">
            <text x="0" y="80" font-family="Poppins, Arial, sans-serif" font-size="72" font-weight="800" fill="#0f172a">NGS Plus</text>
            <text x="0" y="140" font-family="Poppins, Arial, sans-serif" font-size="28" font-weight="500" fill="#475569">Personel Devam Kontrol Sistemi</text>
          </svg>`
        ),
        top: Math.round((H - 200) / 2),
        left: Math.round((W - LOGO_SIZE) / 2) - 200 + LOGO_SIZE + 32,
      },
    ])
    .png();

  await canvas.toFile(outPath);
  console.log(`✓ ${outPath} (${W}×${H})`);
}

async function buildFavicon(icoOut) {
  // Build multi-size ICO from 16/32/48 PNGs
  const sizes = [16, 32, 48];
  const pngBuffers = await Promise.all(
    sizes.map((s) =>
      sharp(svgBuffer, { density: 384 })
        .resize(s, s, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
        .png()
        .toBuffer()
    )
  );
  const ico = await pngToIco(pngBuffers);
  writeFileSync(icoOut, ico);
  console.log(`✓ ${icoOut} (multi-size 16/32/48)`);
}

console.log('Generating logo assets from public/logo.svg ...\n');

// === Web ===
await buildFavicon(join(ROOT, 'public/favicon.ico'));
await renderSquare(32, join(ROOT, 'public/favicon-32.png'));
await renderSquare(180, join(ROOT, 'public/apple-touch-icon.png'));
await renderSquare(512, join(ROOT, 'public/logo-512.png'));
await renderOgImage(join(ROOT, 'public/opengraph-image.png'));

// === Mobile (Flutter source for flutter_launcher_icons) ===
await renderSquare(1024, join(ROOT, 'mobile/assets/images/ngs_app_icon.png'));

console.log('\nDone.');

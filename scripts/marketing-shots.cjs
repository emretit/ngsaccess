// Örnek verili UI mockup'larından 19 okunur pazarlama WebP görseli üretir.
// Çalıştırma: node scripts/marketing-shots.cjs (repo kökünden veya başka dizinden).
// Playwright/Sharp yolları PLAYWRIGHT_PATH ve SHARP_PATH ile değiştirilebilir.
// Kontak sayfası, kırpım kanıtları ve dosya listesi /tmp/landing-w2/ altına yazılır.
const { chromium } = require(process.env.PLAYWRIGHT_PATH || '/Users/emreaydin/pafta/node_modules/playwright');
const sharp = require(process.env.SHARP_PATH || '/Users/emreaydin/pafta/node_modules/sharp');
const fs = require('node:fs/promises');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const root = path.resolve(__dirname, '..');
const evidence = '/tmp/landing-w2';
const output = path.join(root, 'public/marketing');
const hiddenPreview = '.preview,.preview-note,.mock-state-buttons{display:none!important}';
const assets = [];
const captures = [];

async function open(page, dir, width = 1440, height = 1200) {
  await page.setViewportSize({ width, height });
  await page.goto(pathToFileURL(path.join(root, 'docs/ui-scan/pages', dir, 'mockup.html')).href);
  await page.evaluate(() => document.fonts.ready);
  await page.addStyleTag({ content: hiddenPreview });
}

async function prepare(page, width) {
  await page.addStyleTag({ content: `
    .sidebar,.topbar{display:none!important}.app{margin:0!important}
    main{width:${width}px!important;max-width:none!important;padding:0!important;margin:0!important}
    .table-scroll{overflow:visible!important;max-height:none!important}
    .table-section{border-radius:0!important;overflow:visible!important}
    .marketing-table{width:100%!important;min-width:0!important;table-layout:fixed!important;white-space:normal!important}
    .marketing-table th,.marketing-table td{padding:10px 8px!important;width:auto!important;overflow-wrap:normal!important;word-break:normal!important}
    .marketing-table *{font-size:12px!important;line-height:18px!important;text-overflow:clip!important;white-space:normal!important;overflow:visible!important;max-width:none!important}
    .marketing-table th,.marketing-table td{font-size:12px!important;line-height:18px!important}
    .marketing-table .badge{display:inline-flex!important;white-space:nowrap!important}
    .marketing-table .small{display:block!important}
    .marketing-table tbody tr:last-child>*{border-bottom:0!important}
    .table-section .table-foot{display:none!important}
  ` });
}

async function table(page, selector, keepColumns, widths, rows) {
  await page.locator(selector).evaluate((el, options) => {
    el.classList.add('marketing-table');
    el.querySelectorAll('colgroup').forEach(c => c.remove());
    for (const row of el.rows) {
      [...row.cells].forEach((cell, index) => {
        const position = options.keepColumns.indexOf(index + 1);
        if (position < 0) cell.style.setProperty('display', 'none', 'important');
        else {
          cell.style.setProperty('display', 'table-cell', 'important');
          cell.style.setProperty('width', options.widths[position] + '%', 'important');
        }
      });
    }
    [...el.tBodies[0].rows].slice(options.rows).forEach(row => row.style.setProperty('display', 'none', 'important'));
  }, { keepColumns, widths, rows });
}

async function capture(page, name, selector, widths, displayWidth, description, extraSelector) {
  const box = await page.locator(selector).boundingBox();
  if (!box) throw new Error(`Kırpım bulunamadı: ${selector}`);
  if (extraSelector) {
    const extra = await page.locator(extraSelector).boundingBox();
    if (!extra) throw new Error(`Kırpım başlangıcı bulunamadı: ${extraSelector}`);
    box.height = box.y + box.height - extra.y;
    box.y = extra.y;
  }
  if (name === 'ana-sayfa') Object.assign(box, { x: 0, y: 0, width: 1440, height: 900 });
  const clip = { x: Math.floor(box.x), y: Math.floor(box.y), width: Math.ceil(box.width), height: Math.ceil(box.height) };
  if (name !== 'ana-sayfa') {
    const clipped = await page.locator(selector).evaluate((el, bounds) => {
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      const bad = [];
      while (walker.nextNode()) {
        const node = walker.currentNode;
        const parent = node.parentElement;
        if (!node.textContent.trim() || !parent || parent.closest('.sr,[hidden]') || !parent.getClientRects().length) continue;
        const range = document.createRange();
        range.selectNodeContents(node);
        for (const rect of range.getClientRects()) {
          if (rect.width && (rect.left < bounds.x - 1 || rect.right > bounds.x + bounds.width + 1 || rect.top < bounds.y - 1 || rect.bottom > bounds.y + bounds.height + 1)) bad.push(node.textContent.trim());
        }
      }
      return [...new Set(bad)];
    }, clip);
    if (clipped.length) throw new Error(`${name}: kenardan taşan yazı: ${clipped.join(', ')}`);
  }
  const png = await page.screenshot({ clip, animations: 'disabled', path: path.join(evidence, name + '.png') });
  const minFont = await page.locator(selector).evaluate(el => {
    const sizes = [...el.querySelectorAll('*')].filter(node => node.getClientRects().length && [...node.childNodes].some(child => child.nodeType === Node.TEXT_NODE && child.textContent.trim())).map(node => parseFloat(getComputedStyle(node).fontSize));
    return Math.min(...sizes);
  });
  const renderedFont = minFont * displayWidth / clip.width;
  if (name !== 'ana-sayfa' && renderedFont < 10.5) throw new Error(`${name}: küçük yazı ${renderedFont.toFixed(2)} CSS px`);
  const entry = { name, selector, description, clip, displayWidth, minFont, renderedFont, ratio: clip.width / clip.height, files: [] };
  for (const width of widths) {
    const filename = `${name}-${width}.webp`;
    const budget = width >= 2400 ? 120000 : width >= 1200 ? 70000 : 35000;
    let quality = 78;
    let encoded;
    while (quality >= 30) {
      encoded = await sharp(png).resize({ width }).webp({ quality, effort: 6 }).toBuffer();
      if (encoded.length <= budget) break;
      quality -= 2;
    }
    if (encoded.length > budget) throw new Error(`${filename}: ${encoded.length} > ${budget}`);
    await fs.writeFile(path.join(output, filename), encoded);
    const metadata = await sharp(encoded).metadata();
    assets.push({ name: filename, width: metadata.width, height: metadata.height, bytes: encoded.length });
    entry.files.push({ name: filename, quality, budget, bytes: encoded.length });
  }
  captures.push(entry);
}

async function main() {
  await fs.mkdir(evidence, { recursive: true });
  await fs.mkdir(output, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, locale: 'tr-TR' });
    // Ana kare eski betikle aynı viewport ve gizlenen önizleme öğelerini kullanır.
    await open(page, '01-ana-sayfa', 1440, 900);
    await capture(page, 'ana-sayfa', 'body', [2400], 1200, '1440×900 eski ana kare; viewport kırpımı');

    await open(page, '07-canli-izleme');
    await prepare(page, 1280);
    await table(page, '.live-table', [1,2,3,4,5,6], [9,19,20,9,27,16], 6);
    await capture(page, 'crop-canli', '.table-section', [1200,2400], 1200, 'Akış başlığı + ilk 6 olay; reddetme nedenleri korunur');

    await open(page, '08-pdks-kayitlari');
    await prepare(page, 640);
    await page.addStyleTag({ content: '.filters,.status-filters{display:none!important}.page-head{margin:0 0 16px!important;align-items:center!important}.page-head h1{font-size:22px}.period{flex-wrap:wrap!important}.page-head .actions{flex-shrink:0}.pdks-table{min-width:0!important}' });
    await table(page, '.pdks-table', [2,4,5,6,8], [27,17,17,19,20], 6);
    await capture(page, 'crop-pdks', '.table-section', [600,1200], 585, 'Sayfa başlığı/Dışa aktar + dönem sekmeleri + ilk 6 kayıt; departman/fazla mesai/işlem sütunları gizli', '.page-head');

    await open(page, '05-gecis-kontrol');
    await prepare(page, 640);
    await table(page, '.access-table', [1,2,3,4,5,6], [23,17,10,16,21,13], 6);
    await capture(page, 'crop-gecis', '.table-section', [600,1200], 585, 'Kural, Tür, Kim, Nereye, Ne zaman, Durum; tüm 5 örnek kural');

    await open(page, '09-vardiyalar');
    await prepare(page, 1280);
    await page.addStyleTag({ content: '.calendar-region{overflow:visible!important;border-radius:0!important}.calendar .person-cell,.calendar .pick,.calendar thead th{position:static!important}.calendar .day-cell{padding:5px 0!important;min-height:48px!important}.calendar .num{white-space:nowrap!important}' });
    await table(page, '#calendar', [2,3,4,5,6,7,8,9], [16,12,12,12,12,12,12,12], 4);
    await capture(page, 'crop-vardiya', '#calendar-region', [1200,2400], 1200, 'Haftanın 7 günü + ilk 4 çalışan; Gece (+1), Yıllık izin, çakışma');

    await open(page, '01-ana-sayfa', 412, 1000);
    await page.addStyleTag({ content: '#dashboard-content{width:380px}.overview{display:none!important}.table-section{border-radius:0!important}.stats{margin-bottom:18px!important}.readings-table *,.stats .label,.stats small{font-size:12px!important}.readings-table .mobile-detail{font-size:12px!important}.table-foot{display:none!important}' });
    await table(page, '.readings-table', [1,2,4], [30,37,33], 3);
    await capture(page, 'ana-sayfa-m', '#dashboard-content', [700,1400], 350, 'Üst 4 özet kartı + Son kart okutmaları ilk 3 kayıt; aradaki aktivite/hızlı erişim gizli');

    await open(page, '07-canli-izleme');
    await prepare(page, 380);
    await table(page, '.live-table', [1,2,5], [23,36,41], 5);
    await capture(page, 'crop-canli-m', '.table-section', [700,1400], 350, 'Saat + Kişi/kart + Sonuç/neden, ilk 5 olay');

    await open(page, '08-pdks-kayitlari');
    await prepare(page, 380);
    await table(page, '.pdks-table', [2,4,5,8], [31,20,20,29], 6);
    await page.addStyleTag({ content: '.table-section>.section-title{padding:14px 10px!important}.table-section>.section-title *{font-size:12px!important}' });
    await capture(page, 'crop-pdks-m', '.table-section', [700,1400], 350, 'Çalışan + İlk giriş + Son çıkış + Durum, ilk 6 kayıt');

    await open(page, '05-gecis-kontrol');
    await prepare(page, 380);
    await table(page, '.access-table', [1,3,6], [54,22,24], 5);
    await capture(page, 'crop-gecis-m', '.table-section', [700,1400], 350, 'Kural + Kim + Durum, tüm 5 kural');

    await open(page, '09-vardiyalar');
    await prepare(page, 380);
    await page.addStyleTag({ content: '.calendar-region{display:block!important;overflow:visible!important;border-radius:0!important}.calendar .person-cell,.calendar .pick,.calendar thead th{position:static!important}.calendar .day-cell{padding:3px 0!important;min-height:48px!important}.calendar th,.calendar td{padding:8px 4px!important}.calendar th small{display:none!important}.calendar .num{white-space:normal!important}.calendar .day-cell>*{max-width:100%!important;min-width:0!important;overflow-wrap:break-word!important}' });
    await table(page, '#calendar', [2,3,4,5], [25,25,25,25], 4);
    await capture(page, 'crop-vardiya-m', '#calendar-region', [700,1400], 350, 'Çalışan + Pazartesi/Salı/Çarşamba; ilk 4 çalışan, Gece (+1) ve Yıllık izin');

    if (assets.length !== 19) throw new Error(`19 yerine ${assets.length} çıktı`);
    await fs.writeFile(path.join(evidence, 'assets.json'), JSON.stringify(assets, null, 2) + '\n');
    await fs.writeFile(path.join(evidence, 'crops.json'), JSON.stringify(captures, null, 2) + '\n');
    const cards = captures.map(c => `<section style="width:${c.displayWidth}px"><h2>${c.name} · ${c.displayWidth} CSS px</h2>${c.files.map(f => `<figure><figcaption>${f.name} · ${f.bytes} byte · q${f.quality}</figcaption><img width="${c.displayWidth}" src="${pathToFileURL(path.join(output, f.name)).href}"></figure>`).join('')}</section>`).join('');
    const html = `<!doctype html><html lang="tr"><meta charset="utf-8"><title>W2 — gösterim boyutunda kontrol</title><style>*{box-sizing:border-box}body{margin:0;padding:24px;background:#ececea;font:14px Arial;color:#252523}main{display:flex;flex-wrap:wrap;align-items:start;gap:24px;width:2430px}section{flex-shrink:0}h2{font-size:16px;margin:0 0 12px}figure{margin:0 0 20px}figcaption{margin-bottom:8px;font-size:12px}img{display:block;height:auto;background:white}</style><h1>Örnek mockup verileri · gerçek gösterim genişlikleri</h1><main>${cards}</main></html>`;
    await fs.writeFile(path.join(evidence, 'contact.html'), html);
    const contact = await browser.newPage({ viewport: { width: 2478, height: 1200 }, deviceScaleFactor: 1 });
    await contact.goto(pathToFileURL(path.join(evidence, 'contact.html')).href);
    await contact.locator('img').evaluateAll(images => Promise.all(images.map(img => img.decode())));
    await contact.screenshot({ path: path.join(evidence, 'contact.png'), fullPage: true });
    console.log(JSON.stringify(assets, null, 2));
  } finally {
    await browser.close();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });

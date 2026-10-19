const { chromium } = require('/Users/emreaydin/pafta/node_modules/playwright');
const fs = require('fs');
const ls = JSON.parse(fs.readFileSync('/tmp/ngs-ls.json', 'utf8'));
const OUT = '/Users/emreaydin/ngsaccess/docs/ui-scan/current';
const pages = [
  ['01','ana-sayfa','/home'],['02','kisiler','/employees'],['03','cihazlar','/devices'],
  ['04','sanal-okuyucular','/virtual-readers'],['05','gecis-kontrol','/access-control'],
  ['06','ziyaretciler','/visitors'],['07','canli-izleme','/live-monitoring'],
  ['08','pdks-kayitlari','/pdks-records'],['09','vardiyalar','/shifts'],['10','izinler','/leaves'],
  ['11','denetim-kaydi','/audit-log'],['12','admin','/system-admin'],['13','ayarlar','/settings'],
];
const SCROLL = () => {
  const els = [...document.querySelectorAll('*')].filter(e => { const s = getComputedStyle(e); return (s.overflowY === 'auto' || s.overflowY === 'scroll') && e.scrollHeight > e.clientHeight + 50; });
  els.sort((a, b) => b.clientHeight - a.clientHeight);
  const t = els[0] || document.scrollingElement; t.scrollTop += t.clientHeight * 0.85; return t.scrollTop;
};
(async () => {
  const browser = await chromium.launch();
  for (const [vw, vh, suf, scale] of [[1440, 900, '', 1], [390, 844, '-mobil', 2]]) {
    const ctx = await browser.newContext({ viewport: { width: vw, height: vh }, deviceScaleFactor: scale, isMobile: vw < 500, hasTouch: vw < 500, locale: 'tr-TR', timezoneId: 'Europe/Istanbul' });
    await ctx.addInitScript(d => { for (const [k, v] of Object.entries(d)) localStorage.setItem(k, v); }, ls);
    const page = await ctx.newPage();
    for (const [n, slug, route] of pages) {
      await page.goto('http://localhost:8081' + route, { waitUntil: 'networkidle' }).catch(() => {});
      await page.waitForTimeout(2500);
      const url = page.url();
      await page.screenshot({ path: `${OUT}/${n}-${slug}${suf}.png` });
      const st = await page.evaluate(SCROLL);
      await page.waitForTimeout(800);
      if (st > 0) await page.screenshot({ path: `${OUT}/${n}-${slug}${suf}-2.png` });
      console.log(vw, n, slug, url.replace('http://localhost:8081', ''), 'scroll', st);
    }
    await ctx.close();
  }
  await browser.close();
})();

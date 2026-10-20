import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root=dirname(fileURLToPath(import.meta.url));
const load=async path=>'data:image/svg+xml;base64,'+(await readFile(join(root,path))).toString('base64');
const [original,mark,white,ink,wordmark,micro,app,foreground]=await Promise.all([
  'source/original.svg','svg/ngsplus-mark-brand.svg','svg/ngsplus-mark-white.svg',
  'svg/ngsplus-mark-ink.svg','svg/ngsplus-wordmark-brand.svg','svg/ngsplus-micro-brand.svg',
  'platform-sources/app-icon-default.svg','platform-sources/android-foreground.svg'
].map(load));
const img=(src,x,y,w,h=w,extra='')=>`<image href="${src}" x="${x}" y="${y}" width="${w}" height="${h}" ${extra}/>`;
const text=(x,y,value,size=16,color='#626167',weight=400)=>`<text x="${x}" y="${y}" font-size="${size}" fill="${color}" font-weight="${weight}">${value}</text>`;
const rect=(x,y,w,h,color='#FFFFFF',r=12)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${color}"/>`;
const board=`<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1180" viewBox="0 0 1600 1180">
<defs><clipPath id="app-mask"><rect x="533" y="840" width="160" height="160" rx="36"/></clipPath></defs>
<rect width="1600" height="1180" fill="#F2F0ED"/>
<g font-family="Helvetica Neue, Arial, sans-serif">
${text(64,57,'NGS PLUS  /  LOGO POLISH',14,'#B00016',700)}
${text(64,119,'Tanıdık imza, temiz geometri.',42,'#18191D',600)}
${text(1536,57,'V1 · 20.10.2026',14,'#626167').replace('font-size','text-anchor="end" font-size')}
${rect(64,168,720,602)}
${text(96,208,'01 / ANA LOGO',13,'#626167',600)}
${img(mark,196,256,456)}
${text(96,743,'Bordo #B00016 · açık çember · özgün NGS harfleri',15)}
${rect(808,168,352,298,'#EAE7E3')}
${img(original,889,217,190)}
${text(984,440,'ÖNCE',13,'#626167',600).replace('font-size','text-anchor="middle" font-size')}
${rect(1184,168,352,298)}
${img(mark,1265,217,190)}
${text(1360,440,'POLISH',13,'#B00016',600).replace('font-size','text-anchor="middle" font-size')}
${rect(808,490,728,280)}
${text(840,530,'02 / YATAY KULLANIM',13,'#626167',600)}
${img(wordmark,964,566,416,143)}
${text(840,743,'Web başlığı · dar alanlar',15)}
${rect(64,794,350,308,'#18191D')}
${img(white,159,837,160)}
${text(88,1055,'Koyu zemin',20,'#FFFFFF',500)}
${text(88,1083,'Beyaz / ters logo',14,'#B7B7BF')}
${rect(438,794,350,308,'#EAE2DD')}
${img(app,533,840,160,160,'clip-path="url(#app-mask)"')}
${text(462,1055,'Uygulama ikonu',20,'#18191D',500)}
${text(462,1083,'iOS + Android',14)}
${rect(812,794,350,308)}
${rect(839,870,296,96,'#F2F0ED',8)}
${rect(852,883,270,35,'#FFFFFF',6)}
${img(micro,865,892,16)}
${text(889,906,'NGS Plus',12,'#18191D',500)}
${img(micro,909,934,16)}
${img(micro,955,925,24)}
${img(micro,1009,920,32)}
${text(836,1055,'Mikro işaret',20,'#18191D',500)}
${text(836,1083,'Favicon için N+ · 16–32 px',14)}
${rect(1186,794,350,308)}
${img(ink,1281,837,160)}
${text(1210,1055,'Tek renk',20,'#18191D',500)}
${text(1210,1083,'Belge · baskı · nötr arayüz',14)}
${text(64,1145,'SVG + PNG + ICO    /    WEB + FLUTTER',13,'#626167',600)}
${text(1536,1145,'Logo karakteri ve ana rengi korundu.',13).replace('font-size','text-anchor="end" font-size')}
</g></svg>`;
await writeFile(join(root,'review/brand-board.svg'),board);
await sharp(Buffer.from(board)).png().toFile(join(root,'review/brand-board.png'));

const appImg=async p=>'data:image/png;base64,'+(await readFile(join(root,p))).toString('base64');
const [darkApp,tinted,defaultApp]=await Promise.all([
  'flutter/assets/branding/app-icon-ios-dark.png','flutter/assets/branding/app-icon-ios-tinted.png','flutter/assets/branding/app-icon.png'
].map(appImg));
const html=`<!doctype html><html lang="tr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>NGS Plus — Logo çalışması</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#f2f0ed;color:#18191d;font:16px/1.5 system-ui,-apple-system,sans-serif}main{max-width:1200px;padding:40px 24px;margin:auto}
header{margin-bottom:32px}.eyebrow{color:#b00016;font-size:12px;font-weight:700;letter-spacing:.15em}h1{font-size:clamp(28px,4vw,46px);letter-spacing:-.04em;margin:12px 0}h2{font-size:20px;margin:0 0 18px}p{color:#626167}
section{margin:28px 0}.pair,.modes{display:grid;gap:16px;grid-template-columns:repeat(2,1fr)}figure{margin:0;background:white;border-radius:14px;padding:24px;text-align:center}figure img{height:240px;max-width:100%;object-fit:contain}figcaption{margin-top:14px;color:#626167;font-size:14px}.controls{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:20px}button,a{font:inherit}button{border:1px solid #ccc6c1;border-radius:6px;padding:8px 16px;background:transparent;color:inherit;cursor:pointer}button[aria-pressed=true]{background:#18191d;color:white;border-color:#18191d}button:focus-visible,a:focus-visible,input:focus-visible{outline:3px solid #d76270;outline-offset:4px}
#stage{height:430px;background:white;border-radius:14px;display:grid;place-items:center;overflow:hidden}#live{max-width:90%;max-height:90%}#stage.dark{background:#18191d}#stage.red{background:#b00016}
.modes{grid-template-columns:repeat(4,1fr)}.modes figure img{width:112px;height:112px}.icon{border-radius:25%}.dark-icon{background:#18191d}.maskrow{display:flex;align-items:center;justify-content:center;gap:40px;min-height:155px;flex-wrap:wrap;background:white;padding:24px;border-radius:14px}.mask{width:96px;height:96px;overflow:hidden;background:#b00016;position:relative}.mask img{position:absolute;width:144px;height:144px;max-width:none;left:-24px;top:-24px}.circle{border-radius:50%}.squircle{border-radius:24%}.rounded{border-radius:12%}.fine{font-size:13px}a{color:#8f0012}footer{border-top:1px solid #d9d4ce;padding-top:24px;display:flex;gap:24px;flex-wrap:wrap}
@media(max-width:650px){main{padding:24px 16px}.pair,.modes{grid-template-columns:repeat(2,1fr)}figure{padding:16px}figure img{height:150px}.modes figure img{width:90px;height:90px}#stage{height:330px}}
@media(prefers-reduced-motion:no-preference){#stage{transition:background .15s}}
</style><main>
<header><div class="eyebrow">NGS PLUS / LOGO POLISH / V1</div><h1>Tanıdık imza, temiz geometri.</h1><p>Açık çember, özgün NGS harfleri, sağ üstteki + ve #B00016 bordo korundu.</p></header>
<section aria-labelledby="compare"><h2 id="compare">Önce / sonra</h2><div class="pair"><figure><img src="${original}" alt="Orijinal NGS Plus logosu"><figcaption>Orijinal</figcaption></figure><figure><img src="${mark}" alt="Rötuşlanmış NGS Plus logosu"><figcaption>Polish — temiz eğriler ve dengeli boşluklar</figcaption></figure></div></section>
<section aria-labelledby="inspect"><h2 id="inspect">Zemini ve boyutu deneyin</h2><div class="controls" role="group" aria-label="Zemin"><button data-bg="light" aria-pressed="true">Açık</button><button data-bg="dark" aria-pressed="false">Koyu</button><button data-bg="red" aria-pressed="false">Bordo</button><label for="size">Boyut</label><input id="size" type="range" min="24" max="360" value="280" step="8"><output id="sizeText" for="size">280 px</output></div><div id="stage"><img id="live" src="${mark}" width="280" height="280" alt="Seçilen zeminde NGS Plus logosu"></div><p class="fine">Ana logo için 48 px ve üzeri önerilir. 16–32 px favicon alanlarında N+ mikro işareti kullanın.</p></section>
<section aria-labelledby="variants"><h2 id="variants">Kullanım biçimleri</h2><div class="modes">
<figure><img src="${wordmark}" alt="Yatay NGS Plus logosu"><figcaption>Yatay</figcaption></figure>
<figure><img src="${micro}" alt="N artı mikro işareti"><figcaption>Mikro N+</figcaption></figure>
<figure><img src="${defaultApp}" class="icon" alt="Bordo uygulama ikonu"><figcaption>Uygulama ikonu</figcaption></figure>
<figure><img src="${ink}" alt="Tek renk logo"><figcaption>Tek renk</figcaption></figure>
</div></section>
<section aria-labelledby="ios"><h2 id="ios">iOS görünümleri</h2><div class="modes">
<figure><img src="${defaultApp}" class="icon" alt="iOS varsayılan ikon"><figcaption>Varsayılan</figcaption></figure>
<figure><img src="${darkApp}" class="icon dark-icon" alt="iOS koyu ikon ön izlemesi"><figcaption>Koyu — şeffaf ön plan</figcaption></figure>
<figure><img src="${tinted}" class="icon" alt="iOS renklendirme kaynağı"><figcaption>Renklendirme kaynağı</figcaption></figure>
</div><p class="fine">Köşe maskeleri ön izleme içindir. Dosyalar kare olarak teslim edilir; son görünümü işletim sistemi uygular.</p></section>
<section aria-labelledby="android"><h2 id="android">Android maske ön izlemeleri</h2><div class="maskrow">${['circle','squircle','rounded'].map(c=>`<div class="mask ${c}"><img src="${foreground}" alt="${c} biçiminde Android ikonu"></div>`).join('')}</div><p class="fine">Ön plan, arka plan ve Android temalı ikon için tek renk katmanı ayrı hazırlanmıştır.</p></section>
<footer><a href="../svg/ngsplus-mark-brand.svg" download>Ana SVG</a><a href="../review/brand-board.png" download>Sunum görseli</a><a href="../README.md">Kullanım rehberi</a></footer>
</main><script>
const sources={light:${JSON.stringify(mark)},dark:${JSON.stringify(white)},red:${JSON.stringify(white)}};
const stage=document.getElementById('stage'),live=document.getElementById('live'),size=document.getElementById('size');
document.querySelectorAll('[data-bg]').forEach(button=>button.addEventListener('click',()=>{
 document.querySelectorAll('[data-bg]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
 stage.className=button.dataset.bg==='light'?'':button.dataset.bg;live.src=sources[button.dataset.bg];
}));
size.addEventListener('input',()=>{live.width=Number(size.value);live.height=Number(size.value);document.getElementById('sizeText').value=size.value+' px'});
</script></html>`;
await writeFile(join(root,'review/index.html'),html);
console.log('Created brand board and self-contained interactive review.');

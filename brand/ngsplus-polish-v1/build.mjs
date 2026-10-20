import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import pngToIco from 'png-to-ico';

const root = dirname(fileURLToPath(import.meta.url));
const brand = '#B00016';
const ink = '#18191D';
const ns = 'http://www.w3.org/2000/svg';
const n = 'M116 260H144L220 352V260H248V394H220L144 302V394H116Z';
const g = 'M306 260H392V283H316Q300 283 300 299V355Q300 371 316 371H366V341H337V318H395V376Q395 394 377 394H306Q272 394 272 360V294Q272 260 306 260Z';
const s = 'M447 260H525V283H454Q443 283 443 294V302Q443 310 455 312L504 318Q532 322 532 347V365Q532 394 504 394H418V371H491Q504 371 504 359V354Q504 344 492 342L444 336Q414 332 414 307V291Q414 260 447 260Z';
const plus = 'M557 150H579V183H612V205H579V238H557V205H524V183H557Z';
const ring = 'M517.9899 122.0101A280 280 0 1 0 598.4661 290.732';
const paths = [n, g, s];
const title = '<title>NGS Plus</title>';
const letters = (color) => `<g fill="${color}">${paths.map(d => `<path d="${d}"/>`).join('')}</g>`;
const symbol = (color = brand, small = false) =>
  `<path d="${ring}" fill="none" stroke="${color}" stroke-width="${small ? 28 : 22}" stroke-linecap="round"/>${letters(color)}<path fill="${color}" d="${plus}"/>`;
const svg = (width, height, body, extra = '') =>
  `<svg xmlns="${ns}" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" ${extra}>${title}${body}</svg>\n`;
const mark = (color, small = false) => svg(640, 640, symbol(color, small));
const wordmark = (color) => svg(512, 176,
  `<g transform="translate(-92 -238)">${letters(color)}</g><path fill="${color}" d="M468 22H484V44H506V60H484V82H468V60H446V44H468Z"/>`);
const micro = (color) => svg(64, 64,
  `<path fill="${color}" d="M6 17H14L31 40V17H39V53H31L14 30V53H6Z"/><path fill="${color}" d="M50 9H56V16H63V22H56V29H50V22H43V16H50Z"/>`);
const app = (background = brand, foreground = '#FFFFFF', artWidth = 794) =>
  svg(1024, 1024, `${background ? `<path fill="${background}" d="M0 0H1024V1024H0Z"/>` : ''}<g transform="translate(${(1024-artWidth)/2} ${(1024-artWidth)/2}) scale(${artWidth/640})">${symbol(foreground, true)}</g>`);
// The 58% artwork canvas places every painted pixel within the circular
// Android 66/108 safe zone. No additional generator inset is required.
const adaptive = (color = '#FFFFFF') => app(null, color, 594);
const maskable = () => app(brand, '#FFFFFF', 800);

async function save(path, contents) {
  const absolute = join(root, path);
  await mkdir(dirname(absolute), { recursive: true });
  await writeFile(absolute, contents);
  return absolute;
}
async function raster(source, path, width, height = width, opaque = false) {
  const absolute = join(root, path);
  await mkdir(dirname(absolute), { recursive: true });
  let pipeline = sharp(Buffer.from(source), { density: 288 }).resize(width, height).toColourspace('srgb');
  if (opaque) pipeline = pipeline.removeAlpha();
  await pipeline.png().toFile(absolute);
}

await mkdir(join(root, 'source'), {recursive: true});
await copyFile(join(root, '../../ngsplus_logo_vector.svg'), join(root, 'source/original.svg'));
for (const [name, color] of [['brand',brand], ['white','#FFFFFF'], ['ink',ink], ['black','#000000'], ['current', 'currentColor']]) {
  await save(`svg/ngsplus-mark-${name}.svg`, mark(color));
  await save(`svg/ngsplus-wordmark-${name}.svg`, wordmark(color));
  await save(`svg/ngsplus-micro-${name}.svg`, micro(color));
}
await save('svg/ngsplus-mark-small-brand.svg', mark(brand, true));
await save('svg/ngsplus-mark-small-white.svg', mark('#FFFFFF', true));

for (const [name, color] of [['brand', brand], ['white','#FFFFFF'], ['ink',ink]]) {
  for (const size of [256,512,1024]) {
    await raster(mark(color), `png/ngsplus-mark-${name}-${size}.png`, size);
  }
  await raster(wordmark(color), `png/ngsplus-wordmark-${name}-1024.png`,1024,352);
}

// Web delivery: adaptive favicon, traditional ICO, touch icon, PWA and social image.
for (const [name,color] of [['brand', brand],['white','#FFFFFF'],['ink',ink]]) {
  await save(`web/logo-${name}.svg`, mark(color));
  await save(`web/logo-horizontal-${name}.svg`, wordmark(color));
}
const fav = micro(brand).replace(title, `${title}<style>path{fill:${brand}}@media(prefers-color-scheme:dark){path{fill:#FFF}}</style>`);
await save('web/favicon.svg', fav);
const icoBuffers = [];
for (const size of [16,32,48]) {
  await raster(micro(brand), `web/favicon-${size}.png`, size);
  icoBuffers.push(await readFile(join(root, `web/favicon-${size}.png`)));
}
await save('web/favicon.ico', await pngToIco(icoBuffers));
await raster(app(), 'web/apple-touch-icon.png', 180,180,true);
for (const size of [192,512]) {
  await raster(app(), `web/icon-${size}.png`,size,size,true);
  await raster(maskable(), `web/icon-maskable-${size}.png`,size,size,true);
}
const og = svg(1200,630, `<path fill="#F6F4F1" d="M0 0H1200V630H0Z"/><g transform="translate(365 80) scale(.734375)">${symbol(brand)}</g>`);
await raster(og,'web/og-image.png',1200,630,true);
await save('web/site.webmanifest', JSON.stringify({
  name:'NGS Plus',short_name:'NGS Plus',lang:'tr',start_url:'/',scope:'/',display:'standalone',
  background_color:'#FFFFFF',theme_color:brand,
  icons:[192,512].flatMap(size => [
    {src:`icon-${size}.png`,sizes:`${size}x${size}`,type:'image/png',purpose:'any'},
    {src:`icon-maskable-${size}.png`,sizes:`${size}x${size}`,type:'image/png',purpose:'maskable'}
  ])
},null,2)+'\n');

// Flutter input assets. Default Apple icon is opaque with no baked corner mask.
for (const [name,color] of [['brand',brand],['white','#FFFFFF'],['ink',ink]]) {
  await save(`flutter/assets/branding/ngsplus-mark-${name}.svg`,mark(color));
  await save(`flutter/assets/branding/ngsplus-wordmark-${name}.svg`,wordmark(color));
}
await raster(app(), 'flutter/assets/branding/app-icon.png',1024,1024,true);
await raster(app(null,'#FFFFFF'), 'flutter/assets/branding/app-icon-ios-dark.png',1024);
await raster(app('#000000','#FFFFFF'), 'flutter/assets/branding/app-icon-ios-tinted.png',1024,1024,true);
await raster(adaptive(),'flutter/assets/branding/android-foreground.png',1024);
await raster(adaptive(),'flutter/assets/branding/android-monochrome.png',1024);
await raster(mark(brand),'flutter/assets/branding/splash-light.png',1024);
await raster(mark('#FFFFFF'),'flutter/assets/branding/splash-dark.png',1024);
await save('platform-sources/app-icon-default.svg',app());
await save('platform-sources/app-icon-ios-dark.svg',app(null,'#FFFFFF'));
await save('platform-sources/app-icon-ios-tinted.svg',app('#000000','#FFFFFF'));
await save('platform-sources/android-foreground.svg',adaptive());
await save('platform-sources/android-monochrome.svg',adaptive());
await save('platform-sources/android-background.svg',svg(1024,1024,`<path fill="${brand}" d="M0 0H1024V1024H0Z"/>`));
// Separate native Apple layers are provided as inputs to Icon Composer, not
// represented as a completed Liquid Glass .icon file.
await raster(svg(1024,1024,`<path fill="${brand}" d="M0 0H1024V1024H0Z"/>`),'platform-sources/apple-background.png',1024,1024,true);
await raster(app(null,'#FFFFFF'),'platform-sources/apple-foreground.png',1024);

await save('flutter/flutter_launcher_icons.yaml', `# Run from the Flutter project after copying assets/branding/ and this file.
flutter_launcher_icons:
  android: true
  ios: true
  image_path: assets/branding/app-icon.png
  min_sdk_android: 21
  adaptive_icon_background: "${brand}"
  adaptive_icon_foreground: assets/branding/android-foreground.png
  adaptive_icon_foreground_inset: 0
  adaptive_icon_monochrome: assets/branding/android-monochrome.png
  remove_alpha_ios: true
  background_color_ios: "${brand}"
  image_path_ios_dark_transparent: assets/branding/app-icon-ios-dark.png
  image_path_ios_tinted_grayscale: assets/branding/app-icon-ios-tinted.png
  desaturate_tinted_to_grayscale_ios: true
`);

await raster(mark(brand),'review/polished.png',800);
console.log('Created vector masters, web assets and Flutter sources.');

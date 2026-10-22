// Yayın öncesi: "use node"suz convex dosyalarını V8 için paketler; Node modülü sızdıranı yazar (çıktı boş olmalı).
import { build } from "esbuild";
import fs from "fs"; import path from "path";
const files=[]; (function walk(d){ for (const f of fs.readdirSync(d)) { const p=path.join(d,f); if (fs.statSync(p).isDirectory()) { if (!/_generated|node_modules/.test(p)) walk(p); } else if (/\.ts$/.test(f) && !/\.test\.ts$/.test(f) && !/\.d\.ts$/.test(f)) files.push(p); } })("convex");
const nonNode=files.filter(f=>!/^\s*(\/\/[^\n]*\n\s*)*["']use node["']/.test(fs.readFileSync(f,"utf8")));
for (const f of nonNode) {
  try { await build({ entryPoints:[f], bundle:true, write:false, platform:"browser", format:"esm", logLevel:"silent", external:["convex","convex/*","@convex-dev/*"] }); }
  catch (e) { const msg=e.errors?.map(x=>`${x.text} @ ${x.location?.file}`).join(" | "); if (/crypto|node/.test(msg)) console.log(f, "=>", msg.slice(0,200)); }
}

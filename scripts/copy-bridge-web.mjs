// Vite build çıktısını (dist/) Windows bridge'in wwwroot/ klasörüne kopyalar.
// `npm run build:hikvision-windows-bridge` içinde `vite build` sonrası çağrılır; böylece
// `dotnet publish` gömülü ngsplus arayüzünü ("/" kökü) EXE ile birlikte paketler.
//
// NOT: dist build'i bulut Convex'e bağlanır — VITE_CONVEX_URL production değeriyle build edin.
import { existsSync, rmSync, cpSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = resolve(root, "dist");
const wwwroot = resolve(root, "bridge/windows/NgAccess.HikvisionBridge/wwwroot");

if (!existsSync(dist)) {
  console.error(`[copy-bridge-web] dist bulunamadı (${dist}). Önce \`vite build\` çalıştırın.`);
  process.exit(1);
}

rmSync(wwwroot, { recursive: true, force: true });
cpSync(dist, wwwroot, { recursive: true });
console.log(`[copy-bridge-web] ngsplus arayüzü kopyalandı → ${wwwroot}`);

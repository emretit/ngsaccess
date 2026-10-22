# Drawer D2 denetimi — cihaz drawer arayüzü (SALT-OKUMA)

Sen denetçisin; kodu Codex yazdı. Hiçbir repo dosyasına YAZMA (yalnız rapor: `/tmp/d2-denetim.md`). YASAK: commit, push, deploy, `npx convex *`, DB yazma, git stash/checkout/reset.

## Girdi
- Spec: `/Users/emreaydin/ngsaccess/.claude/orca-specs/drawer-d2-frontend.md` · kaynak denetim `docs/ui-audit-devices-drawer/RAPOR.md` (B1-B22) · D1 notları `.claude/orca-specs/drawer-d1-denetim-rapor.md` §"D2'ye devredilecek UI notları"
- Değişiklik: `git -C /Users/emreaydin/ngsaccess diff -- src` + yeni dosyalar (`git status --short -- src`). Taban main `59282e5` (D1 backend commit'li). `mobile/**` ve `convex/**` inceleme dışı.
- Emre kararı: project_user YALNIZ kapı açar; diğer komutlar, ayar kaydetme, sil, konum ata, kapı planı, okuyucu ayarı yönetici.

## Bak (öncelik sırası)
1. **Rol gizleme eksiksiz mi:** project_user'da görünen ve sunucunun reddedeceği her buton/akış (drawer Genel bakış, Ayarlar formu, token kartı, satır menüsü Sil/Konum ata/ad-tık düzenleme, `LocationTree` okuyucu ayarı, `EditDoorDialog` plan bölümü, gateway kaldırma). Kapı açma project_user'da ÇALIŞIYOR mu.
2. **B1 kapanma:** ilk Kapat/Esc'te kapanıyor mu (`useDeviceDeepLink.ts` + `Devices.tsx`); URL'den derin bağlantıyla açma, başka cihaza geçiş, tarayıcı geri tuşu, proje değişince kapanma bozulmadı mı.
3. **Davranış regresyonu (B18 bölme):** taşınan komutlar aynı action'ı aynı argümanla çağırıyor mu; onay diyalogları (B11/B15) her yıkıcı komutta; `busy`/pending kilidi, 20 sn "arka planda sürüyor" ile kapatma; B21 Güncelle sonrası sekmeye dönüş + kaydedilmemiş değişiklik koruması.
4. **Veri:** B9 canlı `overview.device` kullanımı; `capped` "100+"; `limits.doorsCapped` uyarısı; D1'de kaldırılan alanlara (done/acked/latest/online) erişim kalmadı mı.
5. **Erişilebilirlik/dar ekran:** `SheetDescription`, `aria-describedby`, 44 px hedefler, sabit başlık + kayan gövde.
6. **B7/B20:** IDE şifre boş + zorunlu doğrulama çalışıyor; Hik tip alanı gizlenince kayıtta `type` ne yazılıyor (mevcut cihazın tipi ezilmiyor mu).

## Kapılar (kendin koş, sayıyla yaz)
`node_modules/.bin/tsc --noEmit -p tsconfig.app.json` · `node_modules/.bin/tsc --noEmit -p convex/tsconfig.json` · `node_modules/.bin/eslint src convex` · `node_modules/.bin/vitest run` · `npm run build`

## Rapor
`/tmp/d2-denetim.md`: P1 (yanlış davranış/güvenlik/regresyon) / P2 (kenar durum) / P3 (stil) — file:line + somut senaryo + öneri; B1-B22 için "tamam / eksik / yanlış" tablosu. `worker_done` ≤10 satır: P1/P2/P3 sayıları, en kritik 3, kapı sayıları.

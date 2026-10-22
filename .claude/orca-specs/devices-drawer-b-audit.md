# Cihazlar drawer Yol B denetimi (SALT-OKUMA)

Sen denetçisin. Hiçbir repo dosyasına YAZMA (yalnız rapor dosyan `.claude/orca-specs/devices-drawer-b-denetim-rapor.md`). YASAK: commit, push, deploy, `npx convex *`, DB yazma, git stash/checkout/reset. Localhost:8081 canlı veriye bağlı: tarayıcıya bakarsan Kaydet/Güncelle/Sil/kapı aç/token yenile/gateway kaldır gibi YAZAN hiçbir butona BASMA. Orca: `orca tab create --url http://localhost:8081/devices --json`, her komutta `--page <id>`; `orca click --element` bu sayfada güvenilmez → `orca eval` ile getBoundingClientRect merkezi + `orca mouse move --x --y` / `mouse down` / `mouse up`; kapanış sonrası durumu okumadan önce `orca screenshot --page <id>` (arka plan animasyonu durabiliyor); bitince `orca tab close --page <id>`.

## Girdi
- Değişiklik: `git -C /Users/emreaydin/ngsaccess diff 0fcaaf7 -- src` + yeni dosyalar (`git status --short -- src`). Taban main `0fcaaf7`. Yazan: Codex. `convex/**`, `mobile/**` inceleme dışı.
- Uygulanan spec: `.claude/orca-specs/devices-drawer-b.md` (9 madde) — önce onu oku; bağlam `docs/ui-audit-devices-drawer/DURUM-FORM.md` bölüm 4 (riskler).

## Odak (öncelik sırasıyla)
1. **Değişen-alan payload** (`hooks/deviceUpdatePatch.ts`, `hooks/useDeviceFormSubmission.ts`, `hooks/useDeviceFormLogic.ts` getBaseline): değişmeyen sır (devicePassword/idePassword/ehomeKey/deviceUsername/ideUser) asla gönderilmiyor mu; bilinçli temizleme (localBridge kullanıcı/şifre "" , deviceIp/description null, hikModel null) hâlâ çalışıyor mu; transport değişince gerekli alanlar gidiyor mu; baseline gerçekten açılış/son kayıt değeri mi (başarılı kayıttan sonra `form.reset(getValues())` ile yeni baseline; heartbeat ile `values` değişimi baseline'ı kaydırıp kullanıcı değişikliğini yutuyor mu); no-op'ta mutation yok ama kullanıcıya geri bildirim var mı; gateway otomatik kayıt koşulu bozulmadı mı; create yolları birebir aynı mı.
2. **Navigasyon koruması + URL senkronu** (`DeviceDetailsPanel.tsx` installNavigationGuard, `useDeviceDeepLink.ts` `useDeviceUrlSync` — guard öncesi yakalanan `navigator.replace`, `Devices.tsx`): yakalanan `replace` ref'i başka bir guard/router yeniden kurulumunda bayatlıyor mu (ör. Kişiler guard'ı açıkken ya da navigator değişince); bypass ile kullanıcı kaynaklı gezinme korumasız kalıyor mu; onaylı kapanışta çift onay; tarayıcı geri; proje değişimi; deep-link `?deviceId=` ile açılış/kapanış.
3. **Taslak kaybı**: kirli formda X/Esc/dış tık/İptal, sekme geçişi (Bilgiler↔İşlemler forceMount korunuyor mu), "Değişiklikleri geri al" yalnız formu döndürüyor mu, yeni kayıtta marka geçişleri taslağı koruyor mu, başarısız gateway retry (`savedId`/connectionError) dalı aynen mi.
4. **Yetki/rol**: project_user "Cihaz ayrıntısı", varsayılan İşlemler, form disabled, token kartı + gateway danger görünmüyor; yönetici "Cihaz düzenle".
5. **Kapanış titremesi + performans**: kapanışta içerik sabit mi; effect bağımlılıklarında döngü, her tuşta pahalı iş.

## Kapılar (kendin koş, sayıyla yaz)
`node_modules/.bin/tsc --noEmit -p tsconfig.app.json` · `node_modules/.bin/eslint src convex` · `node_modules/.bin/vitest run src/components/devices src/components/employees src/pages src/lib`

## Rapor
`.claude/orca-specs/devices-drawer-b-denetim-rapor.md`: P1 (yanlış davranış/veri kaybı/sır sızıntısı/yetki/regresyon) / P2 (kenar durum) / P3 (stil) — file:line + somut senaryo + öneri. `worker_done` ≤10 satır: P1/P2/P3 sayıları, en kritik 3 (file:line), kapı sayıları.

# Cihazlar drawer B — düzeltme turu 1 delta denetimi (SALT-OKUMA, Codex)

Hiçbir repo dosyasına YAZMA; yalnız rapor `.claude/orca-specs/devices-drawer-b-fix1-rapor.md`. YASAK: commit, push, deploy, `npx convex *`, DB yazma, git stash/checkout/reset, tarayıcıda yazan butonlar.

## Bağlam
Yol B'yi Codex yazdı, Claude sonnet denetledi (`.claude/orca-specs/devices-drawer-b-denetim-rapor.md`: P1 0 / P2 4 / P3 6). Koordinatör (Claude) aşağıdaki düzeltmeleri yaptı — yazan denetlemez, bu yüzden sen bakıyorsun. Çalışma ağacı = main `0fcaaf7` + Yol B + bu düzeltmeler (commit'siz). Delta'yı görmek için ilgili dosyaları oku; tam fark `git diff 0fcaaf7 -- src`.

## Düzeltmeler (yalnız bunları denetle)
1. P2-1 + gateway retry — `src/components/devices/hooks/useDeviceFormSubmission.ts` (`changed` bayrağı): değişiklik yoksa update atlanır ama gateway kaydı koşulu yine denenir; kayıt olduysa "Cihazın gateway bağlantısı hazırlandı", hiçbir şey olmadıysa `notify.info("Kaydedilecek değişiklik yok")`; her iki durumda `onSuccess` (baseline reset). `DeviceForm.tsx` `needsGatewayRegistration` + temiz embedded formda "Gateway'e bağla" submit butonu (eskiden her zaman görünen "Güncelle" bu yeniden denemeyi sağlıyordu).
2. P3-1 — `hooks/deviceUpdatePatch.ts`: değeri `undefined` olan anahtarlar patch'ten silinir.
3. P2-3 — `DeviceDetailsPanel.tsx` reset effect'i `resetKey` (open + deviceId + initialBrand) değişince çalışır; açıkken `isAdmin` değişimi taslağı/dirty'yi sıfırlamaz.
4. P2-2 — odak effect'i `projects` yerine `formReady` boolean'ına bağlı.
5. P3-2/P3-4 — açıklama metni picker'da "Önce cihazın markasını seçin."; `projects = queriedProjects ?? projectCache` (yeniden açılışta iskelet yok).
6. P2-4 — `src/lib/navigationGuard.ts` `unguardedReplace(navigator)` (registry'deki orijinal replace, yoksa navigator.replace; çağrı anında çözülür) + `useDeviceDeepLink.ts` `useDeviceUrlSync` bunu kullanır (eski `useRef(navigator.replace)` kaldırıldı).
7. Testler: `deviceUpdatePatch.test.ts`, `useDeviceFormSubmission.test.tsx`, `useDeviceUrlSync.test.tsx` yeni vakalar.

## Sorular
- `changed=false` + kayıt hatası yolu: hata fırlar, `savedId` set edilmez → connectionError yok; kullanıcı ne görür, döngü/çift toast var mı?
- `needsGatewayRegistration` alanları `form.watch` ile; `device.hikDevIndex` canlı güncellenince buton kaybolur mu?
- `unguardedReplace` guard kuruluyken çağrılınca guard'ın `origin` history index takibini bozar mı (replace idx değiştirmez varsayımı)? `navigationGuard.test.ts` ile çelişki?
- resetKey effect'i: aynı cihazı kapatıp yeniden açınca sıfırlanıyor mu; yeni cihaz → kapat → yeni cihaz?
- `projectCache` ile proje değişimi sonrası yanlış proje adı gösterme riski?

## Kapılar (kendin koş)
`node_modules/.bin/tsc --noEmit -p tsconfig.app.json` · `node_modules/.bin/eslint src convex` · `node_modules/.bin/vitest run src/components/devices src/components/employees src/pages src/lib`

## Rapor
P1/P2/P3 + file:line + senaryo + öneri. `worker_done` ≤8 satır.

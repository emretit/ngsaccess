# Drawer D2 — Cihaz drawer arayüzü: kapanma hatası, yapı, rol görünümü, etiketler, dosya bölme

Kaynak denetim: `docs/ui-audit-devices-drawer/RAPOR.md` (her bulgunun kanıt satırı ve önerisi orada; ÖNCE onu oku). Emre kararı 2026-10-21: bulguların HEPSİ düzeltilir; **project_user yalnız kapı açar** (sunucu tarafı D1'de yapıldı, bu iş arayüzü buna uydurur). D1 (backend) bu işten önce commit'lendi (main `59282e5`): `getOverview` kuyrukları `{count, capped}`, done/acked yok, `recentEvents` daraltılmış; audit'i action'lar yazıyor.

## Ortak kurallar (bu repo; CLAUDE.md'yi okumadığın için buraya gömüldü)
- TypeScript strict. `any` / `as any` YASAK (eslint error). Bilinmeyen veri `unknown` + narrowing. `!` non-null yerine erken return.
- Convex sonucu `any[]`'a açılmaz; `useQuery` sonucu ya da `FunctionReturnType<typeof api.X.Y>`.
- UI metinleri Türkçe, cümle düzeni (yalnız ilk harf büyük), sade. Mevcut bileşenleri kullan: `src/components/ui/**`, `ConfirmDestructive`, `SlideOverPanel` (Kişiler paneli deseni), `useAsyncAction`, `formatTrDateTime`.
- YASAK: commit, push, deploy, `npx convex *`, DB yazma, `convex/**` (bu iş yalnız frontend), `mobile/**`, git stash/checkout/reset.

## Hedef (test edilebilir)
Cihaz drawer'ı ilk Kapat/Esc'te kapanır; başlık + sekmeler sabit, gövde kayar; project_user drawer'da yalnız "Aç" komutunu ve salt-okunur ayarları görür; komut butonları ve son olaylar görünür bölümde; tüm etiketler tek sözlükle; DeviceCommandCenter bölünmüş, mevcut + yeni testler yeşil.

## Değişiklik (bulgu → iş)
1. **B1 kapanma yarışı** (`src/pages/Devices.tsx:60-66,117-125`): URL'den açma effect'i yalnız `requestedDeviceId` DEĞİŞTİĞİNDE çalışsın (ör. `lastHandledDeviceId` ref'i); kapatma URL'yi siler ve effect aynı id'yle paneli yeniden açmaz. Test: kapat → panel kapalı kalır (URL güncellemesi gecikse bile).
2. **B9 canlı veri:** Panele `deviceId` ver; ad/marka/transport kararlarının hepsi canlı `overview.device`'tan (bayat `selectedDevice` kopyası yalnız ilk açılış yedeği). Başlık adı canlı.
3. **B5 iskelet + B13 erişilebilirlik:** `SheetContent` `flex flex-col`; sabit `SheetHeader` + `TabsList`; gövde `flex-1 overflow-y-auto`; genişlik Kişiler paneliyle aynı (`SlideOverPanel` değerini oku); sr-only `SheetDescription`; kapalı butonların sebep metni `aria-describedby` ile bağlı. Form sticky "İptal/Güncelle" çubuğu tam genişlik (yüzen kutu değil).
4. **B2 + B8 rol görünümü** (`useProjectAccess().isAdmin`): project_user → Genel bakış'ta yalnız "Aç" (kapı açma) komutu; reboot/tara/eşitlik/olay tarama/kart okut/panel sync gizli. Ayarlar sekmesi salt-okunur (form `disabled`, Güncelle yok, "Gateway bağlantısını kaldır" yok), `DeviceApiTokenCard` gizli. Satır menüsünde "Cihazı sil" yalnız yönetici (`DeviceTableRow` / `DeviceList`).
5. **B4 bilgi mimarisi:** "İşlemler" (sayaçlar) → "Komut kuyruğu"; "Cihaz işlemleri" ve "Son olaylar" `<details>` dışına; `<details>` içinde yalnız ham özellik taraması. Kuyrukta `capped` ise "100+".
6. **B11 + B15 onaylar:** Yeniden başlat → `ConfirmDestructive` (cihaz adı + "Cihaz ~30-60 sn çevrimdışı olur"); Olayları tara + Kart okut → kısa onay; gateway çevrimdışıyken her komut onayına "Cihaz çevrimdışı; komut başarısız olabilir." "Gateway bağlantısını kaldır" formun en altında "Tehlikeli bölge"de. Komut 20 sn'den uzun sürerse "İşlem arka planda sürüyor, paneli kapatabilirsiniz." ve kapatmaya izin ver.
7. **B10 + B14 + B16 metin/görsel:** tek sözlük (yeni `src/components/devices/deviceLabels.ts`): cümle düzeni ("Çalışma durumu", "Eşitlik kontrolü", "Yeniden başlat", "Olayları tara", "Kart okut", "Özellikleri tara"); "Panel senkronu" her yerde; kuyruk durumları ortak (Bekliyor / İşleniyor / Başarısız); bilinmeyen olay "Cihaz olayı (kod 1031)"; başarı metni "Komut cihaza iletildi". Form: "Bölge seçin", "+ Yeni bölge oluştur", "IP adresi (isteğe bağlı)", placeholder gerçek IP gibi görünmesin ("ör. 192.168.1.x"); IDE "Panel UUID" yardım metni: "Panelin Sistem ekranındaki 15 haneli UUID — seri numarası değil". B16: tekrarlı kimlik alt metni, "1 kapı · 1 okuyucu", çift ayırıcı, `Copy` ikonlu kopyala butonu.
8. **B7:** `hooks/buildDeviceFormValues.ts:73-74` IDE varsayılan kullanıcı/şifre boş (`admin12345` kaldırılır); zorunlu alan doğrulaması kalsın.
9. **B12:** mobilde sekme, form kontrolleri, Kapat `min-h-11` (44 px).
10. **B17 + B22 ölü kod/abonelik:** `onUpdated`, `_filteredDoors`, `makeConfirmed`, `runImmediate` sarmalayıcıları, gereksiz `sm:grid-cols-2`, etkisiz `first:pt-0`, "Gelişmiş politikalar" 3 kalıcı kapalı buton silinir. `DeviceHikvisionSection` `devices.getById` aboneliği kaldırılır (çevrimiçi bilgisi overview/liste verisinden).
11. **B18 bölme + tarih:** `DeviceCommandCenter.tsx` → `deviceAdapter.ts` (marka adaptörü + tipler), `useDeviceCommands.ts` (action'lar + execute), bölüm bileşenleri (`DeviceConnectionSection`, `DeviceQueueSection`, `DeviceDoorsSection`, `DeviceEventsSection`, `DeviceActionsSection`). `formatDateTime` yerine `formatTrDateTime` + bağlama göre boş metin ("—" / "Henüz sinyal alınmadı" yalnız son sinyalde). Çevrimiçi hesabı tek yardımcı + tek `useNow` (15 sn).
12. **B20:** Hik'te cihaz tipi modelden türetilsin (model kataloğunda tip bilgisi varsa); yoksa Hik formunda tip alanı gizlensin. Seçimini raporla.
4b. **D1 denetiminden gelen rol gizlemeleri** (`.claude/orca-specs/drawer-d1-denetim-rapor.md` §"D2'ye devredilecek UI notları"): `LocationTree.tsx:92` "Okuyucu ayarlarını oku" yönetici-only; `DeviceTableRow.tsx:79` ad-tık düzenleme, "Sil", "Konum ata" `canManage` ile (project_user drawer'ı yalnız Genel bakış ile açar); `src/components/access-control/EditDoorDialog.tsx:151-163` kapı durum/doğrulama planı bölümü project_user'da gizli. Sunucu bunları artık reddediyor (`adminMutation` / `isManager`) — UI butonu göstermemeli.
4c. **getOverview yeni alanları:** kuyruk 3 hücre (done/acked yok; 2 sütunlu grid'de yetim hücre kalmasın); `limits.doorsCapped/readersCapped` true ise üstte tek satır uyarı "Bu cihazda gösterilenden fazla kapı/okuyucu var; liste kısaltıldı."; `useDeviceCommands`'ta istemci audit kalıntısı ve ölü `_label` parametresi silinir.
13. **B21:** "Güncelle" başarılı → drawer kapanmaz, Genel bakış sekmesine döner + başarı bildirimi.
14. **Testler:** mevcut `DeviceCommandCenter.audit.test.tsx`, `DeviceDetailsPanel.test.tsx`, `DeviceApiTokenCard.test.tsx`, `deviceFormUx.test.ts` güncellenir/korunur; yeni: B1 kapanma (Devices sayfası ya da çıkarılan hook), rol görünümü (project_user yalnız "Aç" görür, token kartı yok), etiket sözlüğü, `capped` "100+" gösterimi. Mevcut test deseni (renderToStaticMarkup / vitest) kullanılır.

## Ownership (yalnız bunlara yaz)
src/pages/Devices.tsx · src/components/devices/** (yeni dosyalar dahil) · src/components/access-control/EditDoorDialog.tsx (yalnız madde 4b plan bölümü gizleme) · src/lib/deviceStatus.ts (yalnız çevrimiçi yardımcısı/etiket) · bu dosyaların testleri

## Kapsam dışı
convex/** (backend D1'de bitti; eksik görürsen `ask` ile sor) · yeni cihaz komutu · Kişiler/diğer sayfalar · mobile/**.

## Kapılar (hepsini kendin koş, çıktıyı raporla)
- `node_modules/.bin/tsc --noEmit -p tsconfig.app.json` → 0
- `node_modules/.bin/tsc --noEmit -p convex/tsconfig.json` → 0
- `node_modules/.bin/eslint src convex` → 0 error
- `node_modules/.bin/vitest run` → tamamı yeşil (sayıyı yaz)
- `npm run build` → OK

## Rapor
`worker_done`'da ≤10 satır: bulgu → dosya:satır eşlemesi (B1-B22), yeni dosyalar, B20 seçimi, kapı sayıları.

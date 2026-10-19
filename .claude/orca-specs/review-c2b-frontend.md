# Görev: Faz C2b frontend denetimi (SALT-OKUMA) — 05 Geçiş Kontrol, 06 Ziyaretçiler, 07 Canlı İzleme, 09 Vardiyalar
Repo: /Users/emreaydin/ngsaccess. Codex worker'ları yazdı (spec'ler `.claude/orca-specs/c2b-common.md`, `c2b-0{5,6,7,9}-ui.md`; backend sözleşmeleri
`.claude/orca-specs/reports/c2b-0{5,6,7,9}-api.md`; UI raporları `reports/c2b-0{5,6,7,9}-ui.md`). Tasarım dili `docs/ui-scan/DESIGN_DIRECTION.md`;
hedefler `docs/ui-scan/pages/{05-gecis-kontrol,06-ziyaretciler,07-canli-izleme,09-vardiyalar}/{REPORT.md,mockup.html}`.
Bağımsız denetçisin; DİFF'i oku: `git diff -- src` + `git status --short src` (yeni dosyalar). Yeni backend henüz canlı DEĞİL (deploy onay bekliyor);
gerçek oturum ekranı yok — kod düzeyinde denetle.

## Özellikle bak
1. **Veri kaybı/yanlış yazma:** 05 kural düzenleme formu tam üye listesiyle mi kaydediyor (`getDetails` tam döner; `listRuleMembers` yalnız
   görüntüleme için) — kırpılmış listeyle `updateWithGroups` çağrısı = KRİTİK. 06 pasif kayıt düzenleme payload'ı, 09 toplu atama apply'ı
   önizlemeden sonra yeniden doğrulanan sonucu mu gösteriyor, 07 kart atama `expectedCurrentCard` gerçekten form açılışındaki değer mi.
2. **Dürüst durum dili:** 05 Hik "Gönderildi · teslim kanıtı yok" ≠ "Cihazda doğrulandı"; satırda kanıtsız "Uygulandı" yok; 06 kart maskeli;
   07 canlı akışta watermark/hasMore → "yeniden yükle", sahte yenileme yok; sayaçlarda geçici 0 yok (undefined → iskelet).
3. **Paylaşılan sözleşmeler:** `DeviceSyncStatusBanner` (02/03/06 tüketir), `src/hooks/access-rules/**` (GroupMembers/GroupDevicesManager),
   `useCardReadings`/`useProjectFilteredCardReadings`, `useVisitors`, ayarlardan taşınan vardiya tanım dosyaları + `SettingsTabs.tsx` — tüketicileri grep'le, kırılan var mı.
4. **Formlar:** react-hook-form `name`/zod alan adları değişmemiş mi; `useUnsavedChangesGuard` gerçekten bağlı mı (Escape, dış tık, kapat, proje değişimi);
   pending'de kapatma kilitli mi; alan hatası aria; başarısız mutation formu kapatmıyor mu.
5. **Önceki dalga düzeltmeleri** geri alınmış mı: proje kapsamı, URL filtre state'i, ConfirmDestructive, notify, useAsyncAction, nullable patch.
6. **Erişilebilirlik + A2 YASAKLAR:** label↔id, ikon düğmesi aria-label, klavye ile satır/hücre açma, takvim tablosu semantik başlık; sabit renk/hex/
   emoji/gradyan/kart-içinde-kart yok; `useToast` yok; 390px'te tablo dışında yatay taşma riski (min-w-0).
7. CLAUDE.md: any/as any yok, `!` yok, `FunctionReturnType<typeof api.X.Y>`.

## Kapı (kendin koş)
node_modules/.bin/tsc --noEmit -p tsconfig.app.json · node_modules/.bin/tsc --noEmit -p convex/tsconfig.json · node_modules/.bin/eslint src convex ·
npx vitest run · npx vite build

## YASAK
Dosya düzenleme yok. commit/push/deploy/DB YOK. `npx convex` koşma. Uygulamaya giriş yapma.

## worker_done (≤12 satır)
Bulgular önem sırasıyla (kritik/yüksek/orta), file:line + 1 cümle + düzeltme önerisi. Kapı sonuçları. "Canlıya hazır mı: evet/hayır".

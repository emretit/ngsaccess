# Görev: Faz C2c frontend denetimi (SALT-OKUMA) — 10 İzinler, 11 Denetim Kaydı, 12 Admin, 13 Ayarlar
Repo: /Users/emreaydin/ngsaccess. Codex worker'ları yazdı (spec'ler `.claude/orca-specs/c2c-common.md`, `c2c-1{0,1,2}-ui.md`, `c2c-13-ui.md`; backend
sözleşmeleri `.claude/orca-specs/reports/c2c-1{0,1,2}-api.md` + `c2c-api-fix.md` varsa; UI raporları `reports/c2c-1{0,1,2,3}-ui.md`). Tasarım dili
`docs/ui-scan/DESIGN_DIRECTION.md`; hedefler `docs/ui-scan/pages/{10-*,11-*,12-*,13-*}/{REPORT.md,mockup.html}`.
Bağımsız denetçisin; DİFF'i oku: `git diff -- src` + `git status --short src` (yeni/silinmiş dosyalar). Yeni backend henüz canlı DEĞİL (deploy onay bekliyor);
gerçek oturum ekranı yok — kod düzeyinde denetle. Backend (`convex/**`) ayrıca denetlendi; yalnız frontend↔backend sözleşme uyumuna bak.

## Özellikle bak
1. **Veri kaybı/yanlış yazma:** 10 izin düzenleme `expectedUpdatedAt` + `notes:null` (temizleme) doğru mu, legacy pending/rejected salt okunur mu,
   overlap hatası formu kapatmıyor mu. 12 üyelik/rol azaltma tek atomik `updateRole` mı, kendi rolünü düşürme/silme kapalı mı, cihaz claim/reassign/
   taşıma/boşaltma yanlış cihaza yazma riski, `getDeletionImpact` sonrası silme. 13 ayarlar formları kaydederken başka alanları ezmiyor mu (kısmi patch).
2. **Dürüst durum dili:** sayaçlar yalnız `truncated=false` iken kesin; boş-ama-bitmemiş tarama "sonuç yok" sanılmıyor; undefined → iskelet, geçici 0 yok;
   10 `notesHidden` admin olmayana açıklanıyor; 11 "Filtreleri temizle" projeyi koruyor, "Sistem"/silinmiş kullanıcı filtresi; dışa aktarma butonu YOK.
3. **Paylaşılan sözleşmeler / silinen dosyalar:** 13'te silinen 6 dosya (`git status --short src | grep '^ D'`) ve taşınan bileşenler — tüketicileri grep'le,
   kırık import/ölü route var mı. `AdminUsersPanel` hem Admin hem Ayarlar'da tüketiliyor (default export/props). `src/contexts/ActiveProjectContext.tsx`
   `useProjectChangeGuard` doğru kullanılmış mı (`dirty || pending`, pending'de no-op). `leaves` ↔ PDKS URL sözleşmesi (`usePdksFilterParams`).
   Vardiyalar takvimi `leaves.listForRange`, PDKS `auditLog.getPdksAuditForEmployee`, Cihazlar `projects.list` tüketicileri bozulmamış mı.
4. **Formlar + gezinme:** react-hook-form `name`/zod alan adları; `useUnsavedChangesGuard` bağlı mı (Escape, dış tık, kapat, sekme/route, proje değişimi);
   pending'de kapatma kilitli; alan hatası aria; başarısız mutation formu kapatmıyor. 10 ve 12'de yerel BrowserRouter gezinme adaptörleri
   (`src/components/leaves/lib/navigationGuard.ts`, `src/components/admin/hooks/adminNavigationGuard.ts`) — history'yi bozma/çift push/sızan listener riski;
   ikisi neredeyse aynıysa ortaklaştırma önerisi (DÜŞÜK). Router v7 dersi: URL↔state senkronlayan `useEffect` yeni açılan paneli kapatıyor mu.
5. **Önceki dalga düzeltmeleri** geri alınmış mı: proje kapsamı, URL filtre state'i, ConfirmDestructive, notify, useAsyncAction, nullable patch.
   Koordinatöre iletilmiş açıklar kapandı mı: `UserTableHeader` 390px taşma, `deviceCount` kolonu kaldırıldı mı, 10 boş sayfada otomatik devam yok.
6. **Erişilebilirlik + A2 YASAKLAR:** label↔id, ikon düğmesi aria-label, klavye ile satır açma, sekmeler (Admin 3 sekme, Ayarlar dikey bölüm menüsü)
   doğru rol/aria-selected/aria-current; sabit renk/hex/emoji/gradyan/kart-içinde-kart yok; `useToast` yok; 390px'te tablo dışında yatay taşma riski (min-w-0).
7. **Performans/kota:** dakikalık yenileme ya da `Date.now()` arg'ı her render'da yeni abonelik açıyor mu; seçici açılmadan yüklenen ağır query (11 actorOptions
   yalnız açılınca — korunmuş mu); sonsuz render döngüsü (her render'da yeni boş dizi/obje → efekt).
8. CLAUDE.md: any/as any yok, `!` yok, `FunctionReturnType<typeof api.X.Y>`, Convex sonucu `any[]`'a açılmıyor.

## Kapı (kendin koş)
node_modules/.bin/tsc --noEmit -p tsconfig.app.json · node_modules/.bin/tsc --noEmit -p convex/tsconfig.json · node_modules/.bin/eslint src convex ·
npx vitest run · npx vite build

## YASAK
Dosya düzenleme yok (rapor dosyası hariç). commit/push/deploy/DB YOK. `npx convex` koşma. Uygulamaya giriş yapma.

## Rapor
Tam rapor `.claude/orca-specs/reports/review-c2c-frontend.md` (bulgu başına: önem, file:line, sorun, somut düzeltme). `worker_done` ≤12 satır:
bulgular önem sırasıyla (kritik/yüksek/orta), file:line + 1 cümle; kapı sonuçları; "Canlıya hazır mı: evet/hayır".

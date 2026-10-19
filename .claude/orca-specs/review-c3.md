# Görev: Faz C3 denetimi (SALT-OKUMA) — sweep · rules diff · admin yarış · ui düzeltmeleri
Repo: /Users/emreaydin/ngsaccess, taban HEAD `dca4da4`. Codex worker'ları yazdı; spec'ler `.claude/orca-specs/c3-common.md`, `c3-{sweep,rules,admin,ui}.md`,
raporlar `.claude/orca-specs/reports/c3-{sweep,rules,admin,ui}.md`. Koordinatör ekledi: `SettingsFormState.tsx` baseline + `GeneralSettings.tsx` kısmi payload,
`MoveReaderDialog.tsx` dolu hedef disabled. Bağımsız denetçisin; DİFF'i oku: `git diff` + `git status --short` (yeni dosyalar). Deploy yok; kod düzeyinde denetle.

## Özellikle bak (önem sırası)
1. **Veri kaybı — rules diff (`convex/accessRules.ts`, `convex/lib/accessRuleDiff.ts`, `src/components/access-control/unified/**`):**
   editör kırpılmış/eksik listeyle hiçbir üye/cihaz/kapı SİLEBİLİR mi; diff uygulaması idempotent mi (aynı kayıt iki kez); eski `updateWithGroups`
   tam-liste yolu canlıdaki eski sekmeler için güvenli mi (`RULE_MEMBERS_TRUNCATED` vb.); `getDetails` sınırı ve truncated bayrakları dürüst mü.
2. **Cihaz senkronu — rules diff:** worker raporu: "diff kaydı tam startRuleSync'i atlıyor, yalnız değişen kişiler için Hik/IDE sync-revoke yardımcıları;
   diff kaydı yeni syncRun (Son gönderimler) üretmiyor". Doğrula: eklenen kişi cihaza GERÇEKTEN gönderiliyor mu, çıkarılan kişi cihazdan siliniyor mu,
   plan/cihaz/kapı değişiminde tam senkron korunuyor mu; Hik + IDE ikisi de. Kullanıcıya senkron sonucu dürüst gösteriliyor mu (sessiz kalma = YÜKSEK).
3. **Yarış kontrolleri:** `users.updateRole` `expectedProjectIds` (sırasız küme karşılaştırma, hata formda), Genel ayarlar kısmi payload (kayıt yokken
   tam payload, `null`=temizle, eksik=değişmedi; eski istemci tam payload ile aynı sonuç), vardiya `SHIFT_OVERLAP`/`SHIFT_CALENDAR_CONFLICT` ConvexError'ı
   eski istemcinin `OVERLAP:` / `CALENDAR:` ön ekine hâlâ uyuyor mu.
4. **Proje değişimi koruması taşıması:** `SlideOverPanel.tsx`, `DeviceDetailsPanel.tsx` artık `useProjectChangeGuard` mı; eski "projeyi geri al" kalıntısı yok mu;
   pending'de no-op.
5. **Sweep:** `notify` eşlemesi metinleri koruyor mu (destructive→error); renk token eşlemeleri anlamı koruyor mu (hata kırmızı → destructive);
   `App.css` silinmesi bir şeyi bozdu mu; IDE kurulum kartı işlevi değişmemiş.
6. **UI:** audit scope (`auditState.ts`) derin bağlantı user filtresini koruyor; Canlı/Geçmiş seçili durumu `aria-selected`/`aria-pressed`; izin formu tek etiket;
   `DeviceListErrorBoundary` retry; MoveReaderDialog dolu hedef disabled + `selectedTarget` kilidi.
7. CLAUDE.md: any/as any yok, `!` yok, `FunctionReturnType`, `filter((p): p is NonNullable…)`.

## Kapı (kendin koş)
node_modules/.bin/tsc --noEmit -p tsconfig.app.json · node_modules/.bin/tsc --noEmit -p convex/tsconfig.json · node_modules/.bin/eslint src convex ·
npx vitest run · npx vite build

## YASAK
Dosya düzenleme yok (rapor dosyası hariç). commit/push/deploy/DB YOK. `npx convex` koşma. Uygulamaya giriş yapma.

## Rapor
Tam rapor `.claude/orca-specs/reports/review-c3.md` (bulgu başına: önem, file:line, sorun, somut düzeltme). `worker_done` ≤12 satır:
bulgular önem sırasıyla (kritik/yüksek/orta), file:line + 1 cümle; kapı sonuçları; "Canlıya hazır mı: evet/hayır".

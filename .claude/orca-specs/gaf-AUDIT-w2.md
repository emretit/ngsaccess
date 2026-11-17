# Denetim 2 — Dalga 1b (FIX1, FIX3) + Faz D (D1, D2, D3) (SALT OKUMA)

## Hedef
Codex worker'larının yaptığı düzeltmeleri bağımsız denetle: bulgu gerçekten kapandı mı, yeni hata açıldı mı, DEĞİŞEN TEST BEKLENTİLERİNİN (özellikle para/saat) her biri doğru mu. Çıktı: `docs/genel-audit-2026-11-03/DENETIM-DALGA2.md` (tek yazabileceğin dosya).

## Ortam
- Dizin: /Users/emreaydin/ngsaccess (main, ortak ağaç). HEAD 4a7c1004. Değişiklikler commit'siz: `git diff HEAD -- <dosya>` + untracked dosyalar.
- Önce `CLAUDE.md`, `convex/_generated/ai/guidelines.md`. Bulgular: `docs/genel-audit-2026-11-03/03-pdks-vardiya-izin.md` (PDK-002/004/006), `04-raporlar-sgk.md` (RAP-001/002/003), `DENETIM-DALGA1.md` (Y-01, Y-06, Y-09, Y-10, ZIY-02 kalan, yüz rızası). Koordinatör kararları: `.claude/handoff-genel-audit-fix.md` "OTURUM 2" bölümü (KARAR satırları).
- Aynı anda 2 worker çalışıyor: FIX2 (`accessRules.ts`, `doors.ts`, `lib/doorTarget*.ts`, `doorStatusPlan*`) ve D4 (`lib/cardReadingProcess.ts`, `lib/pdksWorkDay.ts`, `lib/processCardReadingCore.ts`, `pdksRules.ts`, `lib/pdksRules.ts`, `readers.ts`). Bunlar KAPSAM DIŞI; onların yarım dosyalarından gelen tsc/test hatalarını yok say.
- FIX1/FIX3 dosyalarında Dalga 1 değişiklikleri de var (Denetim 1'de kontrol edildi); yalnız Y-xx deltasına odaklan.

## Kapsam (worker → dosyalar → bulgu)
- FIX1 (Y-01, Y-06): `convex/lib/gatewayBackfill.ts`, `convex/lib/gateway/events.ts`, `convex/lib/gateway/backfillState.ts`, `convex/lib/logRedact.ts`, `convex/devices.ts` (backfill mutation'ları), testler `convex/lib/gatewayBackfill.*.test.ts`, `convex/lib/gateway/events.recovery.test.ts`, `isapiResult.test.ts`, `core.redact.test.ts`.
- FIX3 (ZIY-02 kalan fail-closed, Y-09, Y-10, yüz rızası): `convex/ideSync.ts` (ideUserAccessWindow), `convex/lib/gateway/persons.ts` (hikValidityWindow), `convex/lib/hikSyncEmployee.ts` (accessWindowError kullanımı), `convex/alarms.ts`, `src/pages/Alarms.tsx`, `convex/invites.ts`, `convex/employeeFaces.ts`, testler `fixF2bIde`, `fixF2bHikEnd`, `gateway/persons.test.ts`, `alarms.test.ts`, `invites*.test.ts`, `employeeFaces.test.ts`, `src/pages/Alarms.test.tsx`.
- D1 (PDK-004, PDK-006): `convex/lib/pdksDay.ts`, `convex/lib/pdksEvidence.ts`, `convex/lib/overtimeCalc.ts`, `convex/lib/pdksHelpers.ts` (HALF_DAY_HOLIDAY_START_MINUTES = 13:00, 2429 sayılı Kanun — koordinatör kararı), testler `pdksDay.audit.test.ts`, `pdksEvidence.test.ts`, `overtimeCalc.test.ts`.
- D2 (PDK-002): `convex/lib/shiftResolver.ts`, `convex/shifts.order.test.ts`.
- D3 (RAP-001/002/003): `convex/reports.ts`, `convex/lib/legacyOvertime.ts`, `convex/sgkExport.ts`, `convex/lib/pdksPayrollQuery.ts`, testler `reports.attendance.test.ts`, `payVisibility.handlers.test.ts`, `sgkExport.test.ts`, `lib/legacyOvertime.test.ts`, `w5aFix1.test.ts`, `w5aLegacyEquivalence.test.ts` + `__snapshots__/w5aLegacyEquivalence.test.ts.snap`, `pdksEachPunch.test.ts`, `w53Integration.test.ts`, `lib/reportScope.test.ts`.

## Bakılacaklar (öncelik)
1. **Para/saat beklentileri (D1, D3):** her değişen beklentiyi elle hesapla. Örn. payVisibility özet 750→562,50, departman [1500,750,375,375]→[1125,562,50,281,25,281,25] ("13 ham saatten mola ve tolerans sonrası 3,75 saat"), reports.attendance manuel 10→9 sa / mesai 2→0, gece 8→7, w53Integration 0→7, pdksEachPunch 16→15, snapshot: sgkReport 9→8, overtimeReport 1→0, departmentReport satırı kalktı, APHB XML 1,0→0,0. Bordro motoruyla tutarlı mı, yoksa yeni bir yanlışı mı sabitliyor? Mesai özeti / departman maliyeti / bordro / APHB AYNI günü AYNI sayıyla mı gösteriyor? RAP-001 katsayı (tatil 2×, gece) gerçekten taşınıyor mu (100 TL × 60 dk tatil = 200 TL)?
2. **PDK-006:** 13:00 sınırı tüm yollarda (günlük, haftalık eşik, gece vardiyası, esnek vardiya `requiredNetMinutes/2`) tutarlı mı? Yarım günün normal kısmı haftalık eşik aşımında tatil katsayısı alıyor mu (almamalı)?
3. **PDK-004:** yalnız "manuel giriş + yönü exit olan tek ham" birleşiyor; yönsüz/`both` tek okutma ve iki ham okutma davranışı değişmedi mi?
4. **PDK-002:** startTime sıralaması gece yarısını aşan son parça ve `rest` bağlamında doğru mu (ör. 22:00–02:00 + 06:00 parçası)?
5. **Güvenlik (FIX3):** fail-closed pencere: boş/ters aralıkta cihaza giden Hik/IDE pencerenin HİÇBİR anı şimdi'den sonra ya da kayıtlı başlangıçtan önce değil mi? Saat dilimi (+3) tutarlı mı? Geçmiş bitişli aktif kişi bitişi cihaza yayıyor mu (fixF2bHikEnd expired)? Y-10 tüm hesap devralma yollarında mı? Yüz rızası: iptal sonrası yeniden rıza doğru ayrılıyor mu?
6. **FIX1:** takılı imleç kurtarması tamamlanan zamanı ilerletmeden mi? CAS yarışları, `failCount` sıfırlanması, manuel fromAll. Yeni ön-kayıt mutation'ı fonksiyon çağrısı kotasını (geçmiş kota yangınları var) anlamlı artırıyor mu?
7. **Okuma maliyeti (D3):** rapor/APHB yolunda sorgu sayısı 6→16, 9→18, 6→12. Yeni doğrudan okumalar index'li ve sınırlı mı? Devralınan sınırsız okumalar (PDK-014) bilinçli bırakıldı — yalnız yenileri değerlendir.
8. Convex kuralları: `"use node"` (`node scripts/find-node-leak.mjs`), `any`/`as any`/`!`, index'siz filter, yeni poll/cron.

## YASAK
Kod değiştirme (rapor hariç), git yazma komutları, `npx convex *`, canlı DB/cihaz/Netlify, `npm install`. Test/tsc/eslint koşabilirsin (makine yüklü: zaman aşımında tek dosya tekrar koş).

## Rapor (Türkçe)
- Üstte 2-3 cümle: kaç bulgu kapandı/kısmen/açık, yeni bulgu (P0/P1/P2).
- Tablo 1: bulgu → durum → kanıt (dosya:satır).
- Tablo 2: yeni bulgular → önem, dosya:satır, somut senaryo, en küçük düzeltme; "Olası" ayrı.
- Tablo 3: her değişen beklenti → test:satır → elle hesap → Doğru / Şüpheli.
- worker_done ≤10 satır + rapor yolu; P0/P1'leri satır satır.

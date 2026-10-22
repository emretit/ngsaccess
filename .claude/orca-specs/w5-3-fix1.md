# W5.3 DÜZELTME 1 — denetim bulguları (UYGULAMA)

Çalışma dizini: `/Users/emreaydin/orca/workspaces/ngsaccess/w5-pdks-rules` (HEAD `c8d2d4e`). İçinde W5.3 yazımı STAGED + entegrasyon UNSTAGED + `convex/w53Integration.test.ts` untracked — HEPSİNİ KORU. Senin değişikliklerin de UNSTAGED kalır; index'e dokunma.
Otoriter denetim raporu: `/tmp/w53-denetim.md` (probe'lar `/tmp/w53probe/`). Önceki raporlar: `/tmp/w53-report.md`, `/tmp/w53-int-report.md`. Başlangıç kapısı YEŞİL: tsc 0/0, eslint 0, vitest 270/2851, build OK.

## Düzeltilecekler (hepsi zorunlu)
1. **E1 (ENGEL) — aralık başında gece esnek çıkışı:** `convex/cardReadings.ts:~400, ~637, ~1334` ve `convex/lib/reportAttendance.ts:~74`. Esnek kapsamda (`tableHasFlexible`/`payrollHasFlexible`/`detailHasFlexible`/`flexible`) ham okumaları `addWorkDate(start, -1)`'den yükle (mobil `mobileAttendance.ts:126` gibi); önceki gün okumaları yalnız gruplamada kullanılır, dönem dışı kalır (önceki gün satırı/toplamı üretmez). Sabit yolda aralık ve okuma sayısı DEĞİŞMEZ. Test: 31 Mayıs 22:00 giriş + 1 Haziran 06:30 çıkış → Haziran tablo/bordro/detay/aylık rapor/SGK adaptörü: 1 Haziran boş (devamsız/inceleme değil), legacy + requirements iki modda.
2. **D1 — sabit gece → esnek geçiş:** `convex/lib/pdksWorkDay.ts:~76`. `!previousFlex` iken giriş dışı okumalarda eski sabit kural (`pdksWorkDay` anahtarı) korunur. Test: D sabit 22:00–06:00, D+1 esnek; D 22:00 giriş + D+1 06:00 çıkış → D'de giriş+çıkış, D+1 boş. Tersi (D esnek → D+1 sabit) da test edilsin.
3. **D2 — yönsüz okuma + gece esnek:** `pdksWorkDay.ts:~75-100`, `pdksFlexible.ts:~65`. Kural: önceki günün AÇIK esnek oturumu varsa ve yönsüz okuma o oturumun çıkış penceresi + `maxSpanMinutes` içindeyse: okuma D+1'in giriş penceresinde DEĞİLSE önceki güne çıkış olarak eşlenir; D+1 giriş penceresine de düşüyorsa (belirsiz) iki gün `flexibleConflict` / inceleme olur — keyfi çiftleme yok, sahte "devam" günü yok. Test: legacy D 22:00 + D+1 06:30 yönsüz → D'de 22:00–06:30 tek oturum (brüt 510 dk, net = vardiyanın mola kuralına göre), D+1 boş, SGK +1 gün; belirsiz pencere varyantı → inceleme.
4. **D3 — keşif kotası + global create yetkisi:** `convex/lib/reportScope.ts:~88-93`, `convex/lib/reportAttendance.ts:~244,255`. Esnek tanım var ama bu projede HİÇ kullanılmıyorsa (ne `employees.shiftId` ne aralıkla kesişen `shiftAssignments`) projede kişi başı sorgu açılmaz. Keşif maliyeti O(esnek tanım sayısı) bounded sorgu olmalı (ör. `shiftAssignments.by_shift` + projectId/endDate süzme, `take` sınırı + Türkçe hata; doğrudan `employees.shiftId` için gerekiyorsa bounded tek sorgu). Senaryo testi: 500 kişilik sabit proje + sistemde atanmamış 1 global esnek tanım → okuma sayısı sabit yolla aynı + yalnız keşif sorguları (sayıyı test etsin). Ayrıca `convex/shifts.ts:~409` `create`: `projectId` yoksa (global tanım) yalnız super_admin (update ile aynı kural; Türkçe hata). UI (`src/components/shifts/ShiftListSidebar.tsx:46`) her zaman projectId gönderiyor — etkilenmez.
5. **D4 — test boşluğu:** `convex/w5aLegacyEquivalence.test.ts`'e varyant: BAŞKA projede esnek tanım + atama varken sabit projenin DTO'su ve DB izi snapshot ile aynı (yalnız keşif sorguları allowlist'te). Snapshot dosyaları DEĞİŞMEZ.
6. **N2:** `pdksWorkDay.ts:~86` önceki oturum için `previous.open` kontrolü (kapanmış oturum girişsiz çıkışı yutmasın). Test: maxSpan 1400, D kapanmış oturum + D+1 07:00 girişsiz çıkış → D değişmez.
7. **N3:** `pdksWorkDay.ts:~134` esnekte yalnız çıkışı olan manuel kayıt kendi kayıt tarihinde kalır (10:00 manuel çıkış → D, D+1 değil). Test ekle.
8. **N1 (yalnız test):** `w53Integration.test.ts`'teki satır eşitliği null==null ile boşuna geçiyor → gün düzeyi hedef/eksik/fazla değerlerini ve tüm günleri ölçülmüş kapalı bir dönemde satır düzeyi eşitliği karşılaştır (non-null olduğunu da doğrula). Satır düzeyi `shortfallMinutes` anlamını DEĞİŞTİRME (UI işi; rapora not).

Yapma (bilinçli bırakıldı): N4, N5, N6, N7.

## Ortak kurallar
- TypeScript strict; `any`/`as any`/`!`/`filter(Boolean)` YASAK. Sınırsız yeni `.collect()`, cron, polling yok. Türkçe hata metinleri.
- Sabit vardiya birebirliği: `w5aLegacyEquivalence` snapshot'ları aynı, mevcut test beklentileri değişmez (yalnız ekleme). Sabit yolda okuma sırası/sayısı aynı.
- Ownership: `convex/cardReadings.ts`, `convex/dashboard.ts`, `convex/mobileAttendance.ts`, `convex/reports.ts`, `convex/shifts.ts` (yalnız create yetki satırı), `convex/lib/{pdksWorkDay,pdksFlexible,pdksDay,pdksEvidence,reportAttendance,reportScope}.ts`, test dosyaları (`convex/w53Integration.test.ts`, `convex/w5aLegacyEquivalence.test.ts`, `convex/lib/pdksFlexible.test.ts`, yeni test dosyaları).
- YASAK: `src/**`, `mobile/**`, `convex/schema.ts`, commit, push, deploy, `npx convex *`, DB yazma, `git add/stash/checkout/reset/commit`.
- Bir madde başka bir maddeyle çelişirse ya da sabit birebirliği bozmadan çözülemiyorsa DUR ve soru mesajı gönder.

## Kapılar (kendin koş)
`node_modules/.bin/tsc --noEmit -p tsconfig.app.json` → 0 · `node_modules/.bin/tsc --noEmit -p convex/tsconfig.json` → 0 · `node_modules/.bin/eslint src convex` → 0 · `node_modules/.bin/vitest run` → tamamı yeşil (sayı) · `node_modules/.bin/vite build` → OK · `git diff --check` temiz · staged index byte-eşit (başlangıç/son `git diff --cached --binary | shasum`).

## Rapor
`/tmp/w53-fix1.md`: madde başına file:line + test adı, değişen dosyalar, ek okuma etkisi. `worker_done`'da ≤10 satır.

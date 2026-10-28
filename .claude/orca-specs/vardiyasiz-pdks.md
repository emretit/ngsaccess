# Vardiyasız çalışanda PDKS yok — Codex K3 uygulama (2026-10-25)

Repo: /Users/emreaydin/ngsaccess (ana dizin, worktree YOK). Backend Convex (`convex/`), web React (`src/`).
Önce oku: `convex/_generated/ai/guidelines.md`, `.claude/design/vardiya-model.md` (§1, §5).

## Hedef (test edilebilir)
Bir çalışan-gününde dated vardiya planı yoksa (`resolvePlan` → `{kind:"none"}`) o gün için HİÇBİR PDKS verisi üretilmez
(çalışma süresi, geç/erken, devamsız, fazla mesai, eksik süre, izinli/tatil sayımı, puantaj/bordro, geç kalma e-postası);
geçiş verisi (cardReadings, geçiş listeleri/raporları, kapı erişimi, erişim kuralları) aynen kalır.

## Kurallar (Emre kararları 2026-10-25 — değiştirme)
1. **Atanmış = tarihli plan.** Kişi ataması (`shiftAssignments`, startDate..endDate) veya departman zinciri ataması
   (`departmentShiftAssignments`) o tarihte geçerliyse atanmış. Atamanın başladığı günden ÖNCEKİ ve bittiği günden SONRAKİ günler = plansız.
2. **`employees.shiftId` (tarihsiz eski alan) artık PDKS açmaz.** `convex/lib/shiftResolver.ts` `uncached()` sonundaki
   `source:"default"` dalı kalkar → `{kind:"none"}`. (Canlıda bu alanı dolu çalışan 0; formda seçici yok.) Alanı/şemayı SİLME.
   `DayPlan` tipindeki `"default"` kaynağını kullanan yerleri (UI rozetleri, testler) temizle ya da plansız davranışa çevir.
3. **Proje çalışma saatleri yedeği PDKS'den kalkar.** Bugün `shift === null` iken `settings.workStartTime/workEndTime`
   (thresholdsForShift/settingsForShift) ile hesap yapılıyor; plansız günde bu hesap YAPILMAZ. Plansız gün "absent" sayılmaz,
   "beklenen çalışan"a girmez, toplamlara girmez.
4. **`rest` planı (döngüde boş gün / hafta tatili) atanmış sayılır** — mevcut davranış korunur.
5. **PDKS tablosu (web, /pdks-records):** tamamen plansız çalışan listede KALIR, satır gri, "Vardiya atanmamış" etiketi +
   "Vardiya ata" kısayolu (mevcut vardiya planı Sheet'i `?plan=1` / mevcut atama arayüzü; çalışanı ön seçmek kolaysa seç),
   tüm sayı hücreleri "—". Kısmi dönemde (ay ortasında başlayan atama) atama öncesi günler gri "Vardiya yok" hücresi, toplam dışı.
   Durum filtresi: plansız satır "devamsız/geç/…" filtrelerine girmez; üst özet sayaçları plansızları saymaz.
6. **Raporlar / bordro / puantaj / dışa aktarma:** plansız kişi-günleri hariç; tamamen plansız kişi PDKS/puantaj/bordro
   rapor çıktısında satır üretmez. Geçiş (kapı) raporları değişmez.
7. **Ana sayfa / dashboard:** PDKS türevi metrikler (geç, devamsız, beklenen, mesai süresi, PDKS grafikleri) plansızı saymaz.
   Saf geçiş metrikleri (ör. "bugün kapıdan geçen") kalabilir — her metriği sınıflandır, raporda listele.
8. **Mobil uçlar (`convex/mobileAttendance.ts`, `convex/lib/mobileAttendance.ts`):** plansız günde PDKS özeti üretme.
   Dönüş şekli GERİYE UYUMLU kalmalı (Flutter `mobile/` bu işte DEĞİŞMEZ): yeni alan eklenebilir (opsiyonel), mevcut alanların
   tipi/anlamı bozulmaz, Flutter'ın tanımadığı yeni `status` string'i GÖNDERME. Flutter'ın bu yanıtları nasıl parse ettiğini
   `mobile/lib` altında oku (salt okuma) ve raporda yaz.
9. **Geç kalma e-postası** (`convex/lib/processCardReadingCore.ts` `notifyLateReading`): plan `none` → hiçbir şey gönderme.
10. **Elle PDKS girişi, düzeltme talebi, izin talebi AKIŞLARI DEĞİŞMEZ** (Emre: "sonra düşünürüz"). Ama plansız güne düşen
    elle kayıt / onaylı düzeltme / onaylı izin de PDKS gösterimine ve toplamlarına girmez (Kural 3 ile tutarlı). İzin bakiyesi değişmez.
11. Şema değişikliği YOK, backfill YOK, yeni Convex modülü YOK (gerekirse mevcut modüle koy).

## Bilinen çağrı noktaları (başlangıç; tam listeyi sen çıkar)
`convex/{cardReadings,pdksRecords,shiftPlans,dashboard,mobileAttendance}.ts`,
`convex/lib/{shiftResolver,processCardReadingCore,pdksManualWrite,pdksTableQuery,pdksTable,pdksPayrollQuery,pdksPayroll,
reportAttendance,pdksDay,pdksWorkDay,pdksMultiShift,pdksAvailability,pdksCalc,pdksDetail,cardReadingAudit,deviceHelpers}.ts`.
Tercih: plansız günü tek bir yerde (gün hesabı / tablo satırı çekirdeği) yakala, her çağıranda ayrı ayrı yamama.

## Ownership
- Yazabilirsin: yukarıdaki convex dosyaları + bunların testleri + yeni test dosyaları; `src/` altında PDKS / ana sayfa / rapor
  bileşenleri ve testleri (ör. `src/pages/PDKSRecords.tsx`, `src/components/pdks/**`, rapor/ana sayfa PDKS bileşenleri).
- **YAZMA (başka oturum şu an değiştiriyor):** `convex/actions/sendEmail.ts convex/adminDevices.ts convex/devices.ts
  convex/devicesMutations.characterization.test.ts convex/employeeAuth.ts convex/employeeImport.ts convex/employees.ts convex/files.ts
  convex/http.ts convex/ideSync.ts convex/leaves.ts convex/lib/deviceAssignment.ts convex/lib/deviceProvision* convex/lib/leaveValidation.test.ts
  convex/lib/reportScope.ts convex/privacyRetention.ts convex/visitors.ts convex/fixF0SideDoors.test.ts scripts/** src/components/employees/**
  src/components/shifts/calendar/useShiftCalendarData.ts src/components/visitors/** mobile/** convex/schema.ts convex/_generated/**`.
- Herhangi bir dosyayı düzenlemeden önce `git diff --stat -- <dosya>` bak: senin yapmadığın commit'siz değişiklik varsa DÜZENLEME,
  `ask` ile sor. Yasak dosyada değişiklik gerekiyorsa da `ask` ile sor (ör. reportScope.ts).

## Kapsam dışı
Flutter/mobil kod · elle giriş/düzeltme/izin talebi engelleme · şema/backfill · çalışan formu · ay döngüsü/çoklu mola gibi KIYAS açıkları.

## Kod kuralları (CLAUDE.md)
TS strict; `any`/`as any` YASAK (unknown + narrowing); `!` non-null yerine optional chaining + erken return; Convex alanları camelCase
olduğu gibi döner; `Doc|null` dizisi `filter((p): p is NonNullable<typeof p> => p !== null)`; Türkçe kullanıcı metni.

## Testler (en az)
Resolver: `employees.shiftId` dolu + atama yok → `none` · atama 15'inde başlıyor → 14'ü `none`, 15'i plan.
Gün/tablo: plansız gün → PDKS metriği yok, absent değil, toplam dışı; tamamen plansız satır `noShift` işaretli + sayılar boş.
Bordro/rapor: plansız kişi satırı yok; kısmi ay yalnız atamalı günleri sayar. Dashboard: plansız kişi geç/devamsız/beklenene girmez.
Geç e-postası: plansız → scheduler çağrılmaz. Mobil: yanıt şekli geriye uyumlu (snapshot/şekil testi). Web: gri satır + "Vardiya ata".

## Kapılar (hepsi yeşil olmalı; başka oturumun değişikliğinden gelen kırmızıyı ayır ve raporla)
```
node_modules/.bin/tsc --noEmit -p tsconfig.app.json
node_modules/.bin/tsc --noEmit -p convex
node_modules/.bin/eslint src convex
node_modules/.bin/vitest run
node scripts/find-node-leak.mjs
```

## YASAK
`git add/commit/stash/reset/checkout/switch/restore/clean` · `npx convex` (codegen dahil) · Supabase/Convex MCP · DB yazma ·
deploy · push · worktree. Commit'i koordinatör atar.

## Rapor
`.claude/reports/vardiyasiz-pdks-report.md`: değişen dosyalar (file:line), her çağrı noktası için karar, dashboard metrik
sınıflandırması, Flutter parse notu, kapı çıktıları, açık sorular. `worker_done` gövdesi ≤10 satır.

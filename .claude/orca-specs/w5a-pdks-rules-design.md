# W5a — PDKS kuralları (esnek vardiya, giriş/çıkış zorunluluğu, check point, özel export): TASARIM (SALT-OKUMA)

Sen tasarımcısın. Kod YAZMA. Tek yazacağın dosya: `{{OUT}}`.
YASAK: commit, push, deploy, `npx convex *` (dev/deploy/codegen/run), DB yazma, git stash/checkout/reset, başka dosya düzenleme.
Not: çalışma ağacında başka bir oturumun commit'siz işi var (W2 işten ayrılma: `convex/employeeTermination.ts`, `convex/lib/employment.ts`, `convex/lib/reportAttendance.ts`, `convex/cardReadings.ts`, `convex/sgkExport.ts`, `src/components/employees/**`; drawer: `src/pages/Devices.tsx` çevresi). Onları OKU ama değişmiş hallerini hesaba kat; tasarımın onlarla çakışmasın.

## Ortak kurallar (repo; CLAUDE.md'yi okumadığın için buraya gömüldü)
- TypeScript strict; `any` yasak; Convex handler'ları camelCase alan döner.
- Convex kuralları: önce `convex/_generated/ai/guidelines.md` oku. Sınırsız `.collect()` yok; okuma bütçesi sınırlı.
- Convex Free plan: function-call kotası dar → YENİ polling / sık cron önermek yasak; toplu cihaz senkron fırtınası yasak (değişiklik → tek, birleştirilmiş senkron çalıştırması).
- Canlı sistem `notable-tern-4` (dev deployment); veri canlı. Şema değişikliği yalnız opsiyonel alan + yeni tablo (migration yok, mevcut kayıtlar değişmeden çalışmaya devam eder).
- Kullanıcıya görünen metinler Türkçe.

## Hedef
1. **Esnek vardiya:** başlangıç saati serbest, günlük çalışma süresi sabit (ör. 8 sa, geçerli giriş penceresi 05:00-22:00 gibi).
2. **Giriş/çıkış zorunluluğu kuralı:** eksik okutmalı günün (yalnız giriş / yalnız çıkış / hiç) nasıl sayılacağı proje ayarı olur; bugün `pdksCalc` içinde sabit.
3. **PDKS check point:** hangi okuyucu/kapı/cihaz okutmaları PDKS'e sayılır (ör. turnike sayılır, iç kapı sayılmaz); varsayılan = hepsi (bugünkü davranış).
4. **Özel dışa aktarma:** rapor/PDKS dışa aktarmasında kolon seçici (kayıtlı şablon gerekip gerekmediğini değerlendir).

## Bağlam (kodda doğrula)
- Hesap: `convex/lib/pdksCalc.ts` (computeLateMinutes, computeEarlyExitMinutes, computeBreakViolation, resolveDayStatus), `convex/lib/overtimeCalc.ts`, `convex/lib/pdksDetail.ts`, `convex/lib/pdksPayroll.ts`, gece vardiyası (`convex/lib/pdksNight*`), `convex/lib/reportAttendance.ts` (W2 tarafından değiştiriliyor), `convex/cardReadings.ts` (getPdksTableData, getMonthlyPayrollSheet, getEmployeeAttendanceDetail), `convex/sgkExport.ts`.
- Ayarlar: `workSettings`, `overtimeRates` (overtimeBasis weekly45|dailyShift, nightShiftDayMode), `shifts` + atamalar (`convex/shifts.ts`), Ayarlar > Çalışma bölümü.
- Cihaz/kapı/okuyucu modeli: `devices`, `doors`, `readers` tabloları (kapı↔okuyucu ayrıştırması yapıldı).
- Dışa aktarma: `src/lib/reports/**`, `src/components/pdks/**` export paneli, rapor tanımları (`/reports` 16 rapor).
- Hik-Connect referansı: Timetable Normal/Flexible (çalışma süresi, geçerli check-in/out aralığı, en geç giriş, mola süresi, cross-day); General > Attendance Rule (giriş zorunlu / çıkış zorunlu; esnek vardiyada varsayılan pencere 00:00-23:59); Attendance Check Point (tüm cihazlar ↔ özel liste); Custom Export (alan seçici, ayraç, format).

## Cevaplaman gerekenler
1. **Esnek vardiya modeli ve hesap kuralları:** vardiya tanımına eklenecek alanlar; geç/erken kavramı (öneri: yok), eksik süre = devamsız süre mi, fazla mesai eşiği (günlük süre aşımı mı, weekly45 ile etkileşimi), mola düşümü, gece/cross-day, tatil ve izinle etkileşim. Senaryo tablosu (en az 8 satır: normal, geç başlayıp tam süre, erken çıkış, eksik süre, fazla süre, pencere dışı okutma, gece geçen, tek okutma).
2. **Giriş/çıkış zorunluluğu:** ayar modeli; eksik okutma senaryolarının her ayar kombinasyonunda sonucu (tablo); mevcut davranışla birebir aynı kalan varsayılan.
3. **Check point:** hangi seviyede (okuyucu / kapı / cihaz) ve neden; varsayılan; hesaplamada filtrenin uygulanacağı tek nokta; raporlar/bordro/SGK tutarlılığı; geriye dönük yeniden hesap gerekiyor mu.
4. **Özel export:** hangi ekran/rapor; kolon kataloğu; kayıtlı şablon (tablo) gerekli mi; KVKK (T.C. vb. hassas kolon varsayılan kapalı, ücret kolonu `payVisibility`'ye bağlı).
5. **Etki analizi:** dokunulacak fonksiyonlar ve test dosyaları; mevcut testlerin kırılma riski; W2 (`employedDuring`) ile birleşme noktaları.

## Çıktı
`{{OUT}}` (Türkçe, ≤250 satır), aşağıdaki soruların numaralarıyla başlıklandırılmış. İddiaları `dosya:satır` ile kanıtla; doğrulayamadığını **[teyit]** diye işaretle.
Son bölüm: **Uygulama adımları** (sıralı, her biri test edilebilir, tahmini süre) + **Emre'ye açık kararlar** (≤4 madde, her birine önerin).
`worker_done` mesajı ≤10 satır: önerilen model, en büyük 3 risk, açık kararlar, çıktı yolu.

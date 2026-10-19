# Görev: Faz C2a backend denetimi (SALT-OKUMA) — PDKS kapsam/gün durumu/biyometri ayrımı + kişi aktivite API'si
Repo: /Users/emreaydin/ngsaccess. Codex worker'ları yazdı (spec'ler `.claude/orca-specs/c2-common.md`, `c2a-pdks-api.md`, `c2a-ppl-api.md`;
raporlar `.claude/orca-specs/reports/c2a-pdks-api.md` (sonunda koordinatör düzeltmesi), `c2a-ppl-api.md`). Bağımsız denetçisin; raporu değil
DİFF'i oku: `git diff -- convex` + `git status --short convex` (yeni dosyalar). HARİÇ: `convex/lib/cardReadingAudit.ts` (başka iş).
Koordinatör ekledi: `convex/lib/pdksSource.ts` VEYA-modu mantığı (cardOrFace + kart minor → card), `convex/dashboard.ts` üç uyarı sorgusuna
opsiyonel `projectId`. Bu backend canlı Convex'e frontend'den ÖNCE/aynı anda deploy edilecek; canlıdaki eski frontend kısa süre yeni backend'i çağırabilir.
Convex kuralları: `convex/_generated/ai/guidelines.md`.

## KRİTİK BAĞLAM
1. KVKK 2026/921: mesai takibinde biyometri açık rızayla bile yasak → biyometrik doğrulamalı okuma HİÇBİR PDKS hesabına (tablo, puantaj,
   grafik, detay, bordro cetveli, SGK/APHB, zamanlanmış rapor, dashboard aktivite/uyarı, asistan veri yükü) girmemeli; ham erişim kaydı ve
   Canlı İzleme etkilenmemeli. Sızıntı = kritik bulgu.
2. Proje kapsamı: `projectId` verilince yalnız o proje (super_admin dahil) + yetki doğrulaması; verilmeyince eski davranış.

## Özellikle bak
1. `grep -rn "cardReadings" convex` → PDKS hesabına okuma taşıyan ve `filterPdksReadings`/`isPdksEligibleReading`'den GEÇMEYEN yol var mı
   (reports.ts, sgkExport.ts, actions/getChatData.ts, actions/sendScheduledReports.ts, lib/reportAttendance.ts, dashboard.ts, pdksRecords bulk import).
2. `classifyReadingSource`: Hikvision minor/verify mode tablosu doğru mu (`convex/lib/hikEventCatalog.ts` ile kıyasla); yanlış pozitif (kart
   kaydını atma) ve yanlış negatif (yüz/parmak kaydını sayma) riskleri; IDE/QR/manuel yolları.
3. `lib/pdksTable.ts` gün durumu: future/noData/weekend/holiday/absent önceliği, TR gün sınırı, sayısal totalMinutes; bordro "tek okuma artık N/0 dk"
   değişikliği (`lib/pdksPayroll.ts`) — SGK eksik gün hesabını (`lib/sgkEksikGun.ts`) bozuyor mu?
4. `pdksRecords.upsertManual`: zorunlu gerekçe (3–500), iki boş saat reddi, yetki (resolveProjectScope), audit; eski istemci `note` göndermezse net Türkçe hata.
5. `peopleActivity.ts` + `lib/peopleActivity.ts`: yetki (null vs ConvexError), bounded okumalar (take sınırları), Hik done ≠ verified, IDE ack/roster kanıtı,
   `lib/peopleHikSnapshot.ts` refactor'u silme snapshot davranışını değiştiriyor mu.
6. Geriye uyum: yeni arg'lar opsiyonel mi; dönüş şekli değişiklikleri eski frontend'i runtime'da çökertir mi (ör. yeni status değerleri, kaldırılan alan).
7. CLAUDE.md: any/as any yok, `!` yok, camelCase, `filter((p): p is NonNullable<typeof p> => p !== null)`; `.collect()` sınırsız yeni okuma var mı.
## Kapı (kendin koş)
node_modules/.bin/tsc --noEmit -p convex/tsconfig.json · node_modules/.bin/eslint convex · npx vitest run
(app tsc'de PDKS frontend dosyaları başka worker'da yapım aşamasında — onları sayma.)
## YASAK
Dosya düzenleme yok. commit/push/deploy/DB YOK.
## worker_done (≤12 satır)
Bulgular önem sırasıyla (kritik/yüksek/orta), file:line + 1 cümle + düzeltme önerisi. Kapı sonuçları. "Deploy'a hazır mı: evet/hayır".

# Denetim — Raporlar Dalga 2 (SALT OKUMA)
Repo: /Users/emreaydin/ngsaccess. Önce `CLAUDE.md`, `.claude/orca-specs/rep1-common.md`, `rep2-api.md`, `rep2-ui.md` oku; worker raporları `.claude/orca-specs/reports/rep2-{api,ui}.md`.
D1 denetimi (bağlam, tekrar etme): `.claude/orca-specs/reports/review-rep1.md`. Kod Codex worker'larınca yazıldı; raporlara değil DİFF'e ve kendi koştuğun kapılara dayan.

**Hedef:** Raporlar D2 değişikliğindeki gerçek hataları (doğruluk, yetki, KVKK, kota/payload, regresyon) önem sırasıyla dosya:satır + somut senaryo ile raporla.

## Kapsam
- `git diff -- convex/lib/pdksCalc.ts convex/lib/pdksCalc.test.ts convex/lib/pdksTable.ts convex/lib/pdksTable.test.ts convex/lib/reportAttendance.ts convex/lib/reportAttendance.test.ts convex/cardReadings.ts src/lib/reports src/components/reports src/pages/Reports.tsx`
  + yeni `src/lib/reports/pdf.test.ts`.
- ÇALIŞMA AĞACINDA BAŞKA OTURUMUN İŞİ VAR — denetleme: `convex/{invites,invites.test}.ts`, `convex/actions/sendEmail.ts`, `mobile/**`, `src/components/public/**` vb.
  `convex/cardReadings.ts` diff'inde yalnız `listReportTransactions` kısmı D2'dir.

## Odak
1. **Mola kuralı:** `computeBreakViolation` + `pdksTable` kullanımı `convex/dashboard.ts` `getBreakViolations` ile aynı sonucu veriyor mu (≥2 okutma, ≥450 dk, pencere dahil sınırlar, vardiya yoksa). Fark varsa senaryo yaz.
2. **punches:** yalnız izinli + KVKK süzgeçli okutmalar mı; sıralı mı; 24 sınırı; yön etiketi; payload büyümesi (31 gün × 300 kişi) makul mü.
3. **Mobil Okutmalar:** `sources` süzgeci enrich'ten önce mi; key'e giriyor mu; mobil/QR self check-in kayıtları (`convex/employeeCheckIn.ts`, `selfCheckIn`) gerçekten `qr`/`mobile` sınıflanıyor mu (`convex/lib/pdksSource.ts`).
4. **Aylık sayımlar:** Kişi/Departman Bazlı Devam sayımları `convex/lib/pdksPayroll.ts` kodlarıyla tutarlı mı (çift sayım, hafta tatilinde çalışma, yarım gün tatil, izinli+okutma); devam oranı paydası; departman "-" (departmansız).
5. **Regresyon:** D1'in 6 raporu (özellikle Aylık Durum gün kolonları, Ham Okutmalar cursor snapshot, istemci filtrelerinin key dışında kalması) bozulmuş mu; PDF pinned/2000 sınırı korunuyor mu.
6. **Tip/kurallar:** `any`, `as` zorlaması, `!`, `filter(Boolean)`; yeni satır türünde export/kolon seçici/PDF yolları; erişilebilirlik.

## Kapılar (kendin koş, çıktıyı rapora koy)
`node_modules/.bin/tsc --noEmit -p tsconfig.app.json` · `node_modules/.bin/tsc --noEmit -p convex/tsconfig.json` · `node_modules/.bin/eslint src/lib/reports src/components/reports src/pages/Reports.tsx convex/lib convex/cardReadings.ts` ·
`node_modules/.bin/vitest run src/lib/reports src/components/reports convex/lib/reportAttendance.test.ts convex/lib/pdksTable.test.ts convex/lib/pdksCalc.test.ts`.

## Kurallar
SALT OKUMA (rapor dosyası hariç). commit/push/deploy YOK, `npx convex` YOK, canlı DB YOK, paket kurma YOK, dev server YOK.
Bulgu: `[KRİTİK|YÜKSEK|ORTA|DÜŞÜK] dosya:satır — sorun — somut senaryo — düzeltme (1-2 satır)`; emin değilsen "OLASI". Stil bulgusu yok; en fazla 12 bulgu.
Rapor: `.claude/orca-specs/reports/review-rep2.md` + `worker_done` ≤10 satır (KRİTİK/YÜKSEK sayısı + ilk 3 bulgu).

# Görev: SALT-OKUMA denetim — UX-4 `getPdksTableData` sorgu performansı değişikliği

Repo: /Users/emreaydin/ngsaccess (Convex backend). Önce `convex/_generated/ai/guidelines.md` oku.

## Hedef
`git diff convex/cardReadings.ts` içindeki değişikliğin davranışı DEĞİŞTİRMEDİĞİNİ (aynı satırlar, aynı sonuç) ve gerçekten tam tablo taramasını kaldırdığını doğrula ya da çürüt.

## İncelenecek değişiklik (yalnız `getPdksTableData` handler'ı)
1. cardReadings: `.withIndex("by_access_time").filter(gte/lte)` → `withIndex("by_access_time", q => q.gte().lte())`; proje dalı `by_project` + filter → `by_project_access_time` aralığı. Index tanımları `convex/schema.ts`.
2. pdksRecords: çalışan başına sıralı `await` + `.filter(date)` → `Promise.all` + `by_employee_date` aralığı; harita anahtarı `empKey` yerine `String(r.employeeId)`.
3. leaves: tam tarama + `.filter(status)` → `by_status` + dönemle kesişim JS filtresi (`l.startDate <= endDate && l.endDate >= startDate`). Tüketici: `convex/lib/pdksTable.ts` (`allLeaves` kullanımları).

## Kontrol et
- Sınır semantiği (dahil/hariç, `trDayRangeISO` çıktı biçimi, string karşılaştırma) eskisiyle birebir mi?
- `String(r.employeeId)` her zaman `empKey` ile aynı mı (`buildPdksEmployeeReadingMap` anahtar üretimi)?
- Leaves ön-filtresi, pdksTable'daki gün eşleşmesinin sonucunu değiştirebilir mi?
- Convex kuralları (guidelines) ihlali var mı? Kalan `.filter` kullanımları (employees `isActive`) için index yok — not et, düzeltme önerme.

## Ownership
HİÇBİR dosyaya yazma. Salt okuma + komut koşma.

## YASAK
Dosya düzenleme / commit / push / deploy / migration / canlı DB erişimi (Convex/Supabase MCP dahil) YOK.

## Kapılar (kendin koş, sonucu raporla)
node_modules/.bin/tsc --noEmit -p convex/tsconfig.json
npx vitest run convex
(Not: paralel bir worker `src/**` düzenliyor; app tsc/eslint ara durumda kırık olabilir — onları koşma.)

## Rapor
worker_done özetinde ≤10 satır: bulgu varsa şiddet (kritik/yüksek/orta/düşük) + file:line + somut başarısızlık senaryosu; yoksa "temiz" + kapı sonuçları. `--outcome succeeded` = denetim tamamlandı (bulgu olsa da).

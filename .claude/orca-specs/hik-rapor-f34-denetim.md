# Hik raporları — Faz 3 + Faz 4 SALT-OKUMA denetimi

Sen denetçisin: HİÇBİR dosyaya yazma (rapor dosyası hariç). `git add/commit/stash/checkout/reset/restore` YOK, `npx convex` YOK, DB YOK.

## Kapsam
- Faz 3 Aylık Durum renkli Excel: `src/lib/reports/excel/statusMatrix.ts` + `statusMatrix.test.ts`, `src/lib/reports/registry.ts` (yalnız aylık rapora eklenen "Erken çıkış (gün)" kolonu). Rapor `.claude/reports/hik-rapor-f3.md`, spec `.claude/orca-specs/hik-rapor-f3-aylik-durum.md`.
- Faz 4 Kişi Devam Dökümü: `src/lib/reports/excel/personSheets.ts` + `personSheets.test.ts`. Rapor `.claude/reports/hik-rapor-f4.md`, spec `.claude/orca-specs/hik-rapor-f4-kisi-dokumu.md`.
- Koordinatörün küçük değişikliği: `src/components/reports/ReportResults.tsx` `usePdksTableSnapshot` (Aylık Özet/Kişi Dökümü tek seferlik sorgu; hata render'da fırlatılıp QuerySectionBoundary'ye gider; "Yeniden yükle" remount ile yeniden çeker).
Ortak yardımcılar: `src/lib/reports/excel/common.ts`. Hik düzenleri: `docs/hikconnect-reports/shots/attendance-status.png`, `attendance-overview.png`.

## Neye bak
1. Değer doğruluğu: Excel toplamları ekran/`countAttendance`/`PersonMonthTotals` ile aynı mı; gün hücresi kodları/dolguları; geç/erken notları; çiftler ("+k çift", eksik uç "—"); gece vardiyası; izin türü özeti.
2. exceljs: birleştirme çakışması, sayfa adı temizleme (31 karakter, yasak karakter, çakışma), 0 kişi / 1 kişi / 300+ kişi uyarı yolu (kullanıcıya Türkçe mesaj ulaşıyor mu), formül nötrleştirme TÜM metin hücrelerinde, dondurma/yazdırma.
3. `usePdksTableSnapshot`: yarış/sızıntı (unmount sonrası setState), hata yolu, `skip` ile canlı aboneliğin gerçekten kapalı olması, filtre değişince yeniden çekme.
4. Repo kuralları: `any`, `!`, `filter(Boolean)`, Türkçe metin.

## Kapılar (kendin koş)
`node_modules/.bin/tsc --noEmit -p tsconfig.app.json` · `node_modules/.bin/eslint src/lib/reports src/components/reports` · `node_modules/.bin/vitest run src/lib/reports src/components/reports`.

## Rapor
`.claude/reports/hik-rapor-f34-denetim.md`: ENGEL / ÖNEMLİ / DÜŞÜK + file:line + somut senaryo + önerilen düzeltme; yoksa "ENGEL 0". `worker_done`'da ≤10 satır + `--report-path`.

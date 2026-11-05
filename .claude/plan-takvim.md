# Plan — Geçmiş → Takvim audit uygulaması (2026-11-05)

Audit: `docs/mobile-ui-audit/takvim-audit/AUDIT_TAKVIM.md`. Specler: `.claude/orca-specs/takvim-{common,a-calendar,b-screen}.md`.
Baseline (worker öncesi çalışma ağacı): `refs/takvim/baseline` = 8be53426 → denetçi `git diff refs/takvim/baseline -- mobile/`.

## Checklist
### Faz 0 — koordinatör hazırlığı
- [x] Audit raporu + kanıt PNG'leri
- [x] l10n: 11 yeni anahtar + historyUnknownCount "Yönü belirsiz" (gen-l10n, expected_keys)
- [x] Sözleşme: `HistoryCalendar.days` parametresi + ekrandan geçiriliyor (analyze 0, hedefli 44/44)
- [x] Specler + baseline ref
### Faz 1 — Codex worker'lar (paralel, dosya sahipliği ayrı)
- [x] A takvim bileşeni (T2 durum işaretleri, lejand, T4 liste, T5 satır sayısı, T7 bugün/seçili) — gpt-6.1-sol medium
- [x] B ekran (T1 gün kartı, T3 kaydırma, T5 yükleme/yardım metni, T6 özet, T8 Bugün) — gpt-6.1-sol high
### Faz 2 — denetim (yazan denetlemez)
- [x] Claude denetimi `review-takvim.md`: 0 ENGEL / 5 DÜZELT / 5 NOT (koordinatör kapısı önce: analyze 0, 814/814)
- [x] fix1: A `ctx_043cce2751ef` (RVT-04/05 şekille ayrışan işaretler) · B `ctx_e882aeac4e91` (RVT-01/02/03 yükleme/canlı/bayat, 07, 10, testler)
### Faz 3 — koordinatör kapısı
- [x] ARB temizliği: historyCalendarLegend, historySelectDayHint + HistoryCalendar.dayCounts kaldır (ekran + 3 test)
- [x] analyze 0 · flutter test 820/820 · harness 298/298 (+4: koyu takvim, %200 takvim, gün kartı açık/koyu) · after-b yeniden (qr_* gürültü geri alındı)
- [x] Simülatöre kuruldu (iPhone 17 Pro)
- [ ] Emre görsel onayı
- [ ] Commit (Emre onayıyla) + telefona kur

## Kapsam dışı
T9 hafta tatili (Convex alanı), T10 çalışma süresi/geç kalma (ürün kararı), %200 alt bar etiket bölünmesi.

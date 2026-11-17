# GK2-A2 — Yetki Durumu sekmesi: site tasarım + mantık uyumu denetimi

## Hedef (test edilebilir)
`docs/ui-audit-gk/tur2/yetki-durumu.md` raporu + `docs/ui-audit-gk/tur2/yetki-durumu/` ekran görüntüleri yazılmış olur. Kod değişmez.

## Ownership (yalnız bunlara yazabilirsin)
- docs/ui-audit-gk/tur2/yetki-durumu.md
- docs/ui-audit-gk/tur2/yetki-durumu/ (png)

## Kapsam
- URL: http://localhost:8081/access-control?tab=status
- Kod: `src/components/access-control/unified/status/*` (StatusPage, StatusCounters, StatusFilters, StatusResults, StatusViews, EmployeeGrantSheet, RedistributeControls, RunNotice, model.ts, useStatusData.ts) + `convex/accessGrantStatus.ts`.
- Mantık soruları: sayaçlar, filtreler ve rozetler aynı durumu mu gösteriyor; "teşhis ekranı" kararı (kişi neden geçemedi: kural var mı, cihaza gitti mi, cihaz çevrimiçi mi, saat aralığında mı) uygulanmış mı; arama tüm kişileri buluyor mu (03-H1 kararı); yeniden gönderim akışı anlaşılır mı.
- Tasarım: masaüstü (pencere genişliği) + 390px; ortak bileşen kullanımı, boş/yükleme/hata durumları, kişi ayrıntı çekmecesi.

## Kapsam dışı
Kurallar ve Kapı Planları sekmeleri; sayfa başlığı sorunu (bilinen). Kod düzeltmesi.

## Kapılar
Rapor dosyası var ve Rapor biçimine uyuyor; her bulguda kanıt var.

## worker_done
≤10 satır: Yüksek+Orta bulguların tek satırlık listesi (file:line) + rapor yolu. `--report-path docs/ui-audit-gk/tur2/yetki-durumu.md`.

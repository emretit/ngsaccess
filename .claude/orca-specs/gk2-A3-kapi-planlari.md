# GK2-A3 — Kapı Planları sekmesi: site tasarım + mantık uyumu denetimi

## Hedef (test edilebilir)
`docs/ui-audit-gk/tur2/kapi-planlari.md` raporu + `docs/ui-audit-gk/tur2/kapi-planlari/` ekran görüntüleri yazılmış olur. Kod değişmez.

## Ownership (yalnız bunlara yazabilirsin)
- docs/ui-audit-gk/tur2/kapi-planlari.md
- docs/ui-audit-gk/tur2/kapi-planlari/ (png)

## Kapsam
- URL: http://localhost:8081/access-control?tab=doors
- Kod: `src/components/access-control/door-plans/*` (DoorPlansTab, DoorPlanDialog, CopyDoorPlansDialog, DoorPlanImpactSummary, bulk.ts), `src/components/access-control/door-dialog/*` (weeklyPlan), `DoorStatusPlanEditor.tsx`, `doorPlanResult.ts` + çağırdığı Convex fonksiyonları.
- Mantık soruları: 2026-10-27 kararları uygulanmış mı — tek "Kaydet ve cihaza gönder" + etki özeti (04-H2), takvimdeki tüm tatiller + önizleme (04-O3), toplu kopyada plan türü seçimi (04-O5); gönderim sonucu doğru mu gösteriliyor (04-H1: boş sonuç "uygulandı" sayılmasın); IDE/çevrimdışı/Hik olmayan kapılar için mesajlar.
- Ayrıca: sekmenin üst düğmeleri neler (koordinatör bunları ortak PageHeader'a taşıyacak — listele: metin + dosya:satır).
- Tasarım: masaüstü + 390px; tablo/satır tıklama/filtre/boş durum kalıbı, dialog düzeni, "Kurallar" sekmesiyle terim tutarlılığı.

## Kapsam dışı
Kurallar ve Yetki Durumu sekmeleri; sayfa başlığı sorunu (bilinen). Kod düzeltmesi.

## Kapılar
Rapor dosyası var ve Rapor biçimine uyuyor; her bulguda kanıt var.

## worker_done
≤10 satır: Yüksek+Orta bulguların tek satırlık listesi (file:line) + üst düğme listesi + rapor yolu. `--report-path docs/ui-audit-gk/tur2/kapi-planlari.md`.

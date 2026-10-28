# Boş tablo audit — 2026-10-28

Kural (Pafta `page-layout.md` ile aynı): liste boşken ve yüklenirken tablo + başlıklar kalır; durum mesajı gövdede
tek satır (`<TableRow><TableCell colSpan={N}>…`). Ayrıntı: [W1](W1.md) · [W2](W2.md) · [W3](W3.md) (3 Codex worker, salt-okuma).

**Toplam 28 bulgu: Y=11 · O=12 · D=5 (D'ler tartışmalı).** Doğru örnek zaten var: `src/components/devices/DeviceList.tsx:159`
(yükleme/boş durum `TableBody` içinde, `colSpan={colCount}`).

Ortak kök: tablo bileşenleri başlığı koşulsuz çiziyor, ama **parent** `length === 0 ? <EmptyState/> : <Table/>` ya da
`isLoading ? <SectionSkeleton/> : …` ile tabloyu hiç çağırmıyor. Düzeltme = parent koşulunu kaldır + tabloya durum prop'u + ortak satır.

## Y — ana listeler (11)

| # | Ekran | Konum |
| --- | --- | --- |
| W1-01 | Kişiler | `src/pages/Employees.tsx:206` |
| W1-02 | Engineering çalışanları | `src/components/employees/EngineeringDepartmentView.tsx:30` |
| W1-03 | PDKS günlük kayıtlar | `src/components/pdks/records/PdksRecordsResults.tsx:30` |
| W1-04 | İzin kayıtları | `src/components/leaves/LeaveResults.tsx:77` |
| W1-09 | Raporlar (tüm sonuç tabloları) | `src/components/reports/ReportPage.tsx:61` |
| W2-01 | Cihazlar (yalnız proje yükleme) | `src/pages/Devices.tsx:155` |
| W2-02 | Canlı İzleme okumaları | `src/components/access-control/CardReadingsTable.tsx:14` |
| W2-03 | Ziyaretçiler | `src/components/visitors/VisitorManagement.tsx:77` |
| W2-04 | Alarmlar | `src/pages/Alarms.tsx:121` |
| W2-05/06 | Denetim Kaydı (boş + ilk yükleme) | `src/components/audit/AuditResultsContent.tsx:12`, `AuditResults.tsx:31` |

## O — sekme/panel tabloları (12)

İzin talepleri (W1-05) · Vardiya planı takvimi (W1-06) · Geçiş Kontrol Kurallar (W2-07) · Kapı Planları (W2-08) ·
Yetki Durumu durum satırı (W2-09) · Admin Kullanıcılar/Cihaz havuzu/Projeler (B1-B3) · Roller matrisi (B4) ·
Tatil takvimi (B5) · Admin hata sınırı (B6) · Ayarlar/QuerySectionBoundary hata sınırı (B7).

## D — tartışmalı (5)

Departman atamaları (W1-07) · PDKS düzeltme talepleri dialog'u (W1-08) · PDKS asistanı sonuç tablosu (W1-10) ·
Dışa aktarma önizlemesi boş gövde (W1-11) · Denetim ayrıntısı değişen alanlar (W2-10).

## Uygulama önerisi

1. `src/components/shared/TableStateRow.tsx` (API taslağı W3 sonunda) + `DeviceList` ona geçer.
2. Y dalgası → O dalgası (parent koşullarını kaldır, tabloya `loading`/`empty` prop'u).
3. Hata dalı (B6/B7, QuerySectionBoundary) ayrı karar: Pafta'da da hata `ErrorState` ile tabloyu değiştiriyor,
   yalnız "veri varken hata" banner. Önerilen: hata dalını bu işin kapsamı dışında bırak.
4. Mobil kart listeleri (`ResponsiveResults` mobile) boş kutu göstermeye devam eder.

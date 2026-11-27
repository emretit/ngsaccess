# Yıllık mesai için aylık özet tasarımı (uygulanmadı)

Bu belge şema önerisidir; schema.ts, canlı veriler ve yazıcılar değiştirilmedi.
Ara çözüm `dashboard.getAnnualOvertimeBalance` action'ının haftalık internal query çağrılarıdır.

## Veri ve index

`employeeOvertimeMonths`: `projectId`, `employeeId`, `month` (YYYY-MM),
`totalOvertimeMinutes`, `exceedsDaily11h` (ay içinde en fazla 31 tarih),
`calculationVersion`, `sourceRevision`, `computedAt`, `status` (pending/ready/error).
`by_project_month` [projectId, month], `by_employee_month` [employeeId, month].
Aynı kişi/ay belgesi uygulama katmanında unique lookup ile güncellenir.
Haftalık 45 saat hesabı nedeniyle ay sınırından geçen haftanın günleri birlikte hesaplanır;
haftalık fazla süre mevcut hesap motorunun günlere dağıtımıyla ilgili aya yazılır.
Sadece aylık net dakika toplamak haftalık eşikleri korumaz.

## Yazıcı ve geçersiz kılma noktaları

Kart okuma ekleme/düzeltme/silme; pdksRecords manuel düzenleme; izin onayı/iptali;
vardiya tanımı/sürümü ve atama değişikliği; çalışma, mesai, PDKS kuralı ve tatil değişikliği;
çalışan istihdam tarihi, kart ve departman değişimi ilgili kişi/ayları dirty yapar.
Gece vardiyası ve haftalık bağlam için bitişik aylar da geçersiz kılınır.
Kaynak değişimiyle dirty/revision artırımı aynı mutation içinde olmalıdır.
Scheduler yalnız job'u başlatır; bounded internal query parçalarını action toplar,
son mutation sourceRevision aynıysa sonucu ready olarak yayımlar; eski iş yeni veriyi ezmez.

## Backfill

Canlıya yazmadan önce ayrı onaylı iş: kişi/ay cursor'uyla keşif, sabit büyüklükte
haftalık/kişi parçaları, bağımsız transaction başına belge/bayt/aralık bütçesi.
İş ilerlemesi cursor ve calculationVersion ile saklanır; tekrar çalıştırma idempotent.
Önce küçük fixture'da eski yıllık hesapla eşitlik, ardından proje bazlı backfill.
Geçmiş kaynak okuma retention ile kaybolmuşsa belge ready yapılmaz; eksik veri belirtilir.

## Eksik özetin gösterimi

12 ayın tamamı aynı geçerli sürüm/revision ile hazır değilse toplam 0 gösterilmez.
Arayüz “Hesaplanıyor” veya “Geçmiş veri eksik” gösterir; hazır ay adedi belirtilebilir.
Yetki kontrolü kaynaktaki reports.view ve proje kapsamıyla aynı kalır.
Kişi listesi ve 12 ay özetleri de sayfalı okunur; tüm tenant'ı tek query'de toplamaz.

## Ara çözümün sınırları

Action bir anlık transaction snapshot'ı değildir; haftalar arasında kaynak değişebilir.
Her alt işlemde toplam 31.000 belge, SDK ikili boyutuna göre 15 MiB veri, 4.090 index/get aralığı
bütçesi vardır; taşmayı tespit için bir ek belge okunabilir (azami 1 MiB).
Kişi/proje sayısına ayrıca sabit tavan uygulanmaz; db.get ve alt yardımcı okumaları aynı bütçededir.
Sınıra sığmayan aralıklar eksik sonuç yerine açık hata verir; yoğun haftalar/aylar için
kişi bazlı transaction orkestrasyonu veya kalıcı özet hâlâ gereklidir.

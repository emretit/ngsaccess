# 07-O4 · Kapı eşleme araştırması

2026-10-19 · Yalnız kod okuması; DB sorgusu/yazımı, migration ve backfill çalıştırılmadı.

- Liste zenginleştirmesi yalnız `deviceId + ideIoId → doors.deviceId + ioId` ve aynı proje ile eşler (`convex/lib/cardReadingAudit.ts:42`, `:76`).
- `ideIoId` yoksa cihaz bilinse bile kapı bilinmez; `readers` tablosu bu akışta okunmaz (`convex/lib/cardReadingAudit.ts:51`, `:86`).
- Ayrıntıdaki okuyucu adı `doors.readerName` alanından gelir; yeni `readers.name` kullanılmaz (`convex/lib/cardReadingAudit.ts:90`).
- Yeni model kapı başına çoklu okuyucudur; eski `doors.readerName/readerDirection` yalnız geriye uyumluluk alanlarıdır (`convex/schema.ts:243`).
- Hik kapısı `doors.hikDoorNo`, okuyucusu `readers.hikReaderNo` taşır; okuma şemasında bu fiziksel kimlikler saklanmaz (`convex/schema.ts:216`, `:261`, `:453`).
- Canlı Hik yazımı `ideIoId`/kapı/okuyucu kimliği yazmaz; kişi bulunmazsa yön de yazılmaz (`convex/cardReadings.ts:1030`, `:1057`).
- Tarihsel Hik girişinin `doorNo` argümanı var; insert bu alanı ve yönü saklamaz (`convex/cardReadings.ts:1677`, `:1771`). Bu nedenle yeni Hik geçmiş kayıtları da eşleşmez.
- Yön çözümü okuyucu yönünden değil cihaz ayarı/kişi bazlı sıradan türetilir; IDE 0/1 istisnası vardır (`convex/lib/cardReadingProcess.ts:47`, `:54`).
- Sonuç: yalnız eski veri sorunu değil; Hik eşleme zinciri eksik ve yeni okuyucu modeli listeye bağlanmamış. Rapordaki 88/100 oranının dağılımı DB okunmadığı için doğrulanmadı.

## Öneri

1. Önce salt okunur veri envanteri: marka, `ideIoId` varlığı, eşleşen kapı/proje ve ham veride fiziksel kapı/okuyucu kimliği.
2. IDE için mevcut `deviceId + ioId` eşlemesini koruyup `readers` tablosundan adı/yönü çöz; çoklu adayda tahmin yapma.
3. Hik alımında doğrulanmış kapı/okuyucu numarasını kalıcılaştır; aynı cihaz/proje içinde `hikDoorNo/hikReaderNo` ile çöz.
4. Eski IDE okumaları doğru `ideIoId` ve güncel kapı varsa sorguda zaten eşleşir; kayıt backfill'i gerekmeyebilir.
5. Eski Hik okumalarına ancak ham veri/cihaz arşivi kesin fiziksel kimlik sağlıyorsa kontrollü backfill önerilir; yalnız cihaz adı veya kişi sırasından kapı/yön üretme.
6. `readers` oluşturma backfill'i tek başına okumaları onarmaz (`convex/readers.ts:296`); tarihsel okuma alanlarını doldurmaz.

## Düzeltme doğrulaması

07-O1/O2/O3, 07-D1…D7 ve kaynak filtresi uygulandı; 07-O4 araştırması tamamlandı.
TypeScript: 0 hata; hedef ESLint: 0 error, 0 warning; Vitest: 89 dosya / 1421 test geçti.

# WA — Excel içe/dışa aktarma
- F01: Eski şablonun `Aktif (Evet/Hayır)` başlığını tanı; bilinmeyen dolu kolonları hata olarak göster.
- Gerçek şablon → parser → import akışında Hayır değerinin false kaldığını test et.
- Gerçek export → parser round-trip testinde aktif/pasif durumunu koru.
- F07: Boş kartı kabul et, mükerrer kimlik olarak değerlendirme ve cihaz gönderimini atla.
- Şablon açıklamasını ve import sonuç mesajını kartsız/toplu kart atama akışına uyarla.
- Boş kartlı çoklu kayıt, dry-run, mevcut boş kart, dolu kart mükerrerliği ve cihaz kuyruğunu test et.
- Yalnız ownership kapsamındaki kod/test dosyalarını düzenle; şema ve canlı veri değişikliği yapma.
- Kapılar: değişen dosyalarda eslint, ilgili vitest dosyaları, find-node-leak.

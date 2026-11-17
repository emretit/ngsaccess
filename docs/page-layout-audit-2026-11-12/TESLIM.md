# Ortak sayfa layout uygulaması

12 Kasım 2026. Audit sonrası onaylanan plan uygulandı ve doğrulandı.

## Uygulanan düzen

Mevcut global Layout altında PageTemplate başlık/kapsam, geri bağlantısı, birincil ve ikincil eylemler, bildirim, yerel gezinme, özet, kapsam paneli, filtre, içerik, sonuç altlığı ve diyalog yuvalarını yönetiyor. Dış kenar boşlukları ve tek main global kabuğa ait. Form genişliği içerik sütununda 800 px ile sınırlandırılıyor. Mevcut bordo kimlik ve sistem sans ailesi üzerinden ilerleniyor.

Kişiler, Cihazlar, Geçiş Kontrol, Ziyaretçiler, Canlı İzleme, PDKS, Vardiya Planı, PDKS Ayarları, İzinler, Raporlar, Alarmlar, Denetim Kaydı, Ayarlar, Admin, Profil, Mühendislik ve Ana Sayfa ortak kompozisyona geçti. Rapor detayları aynı başlık eksenini kullanıyor. Form, tablo, ajanda ve takvim içerikleri kendi görevlerine uygun sunuluyor.

- Kişilerde sayfa işlemleri başlıktaki menüye taşındı, ana kimlik verisi ve kolon minimumları okunabilir hale getirildi. Eski kayıtlı kolon genişlikleri minimumlarla bellekte sınırlandırılıyor, geçerli tercihler silinmiyor.
- Kişiler/Cihazlar mobil araması görünür kaldı, gelişmiş filtreler katlanır hale geldi. Cihaz toplu işlem şeridi seçimle açılıyor.
- Kapı Planları proje seçilmemesini doğru açıklıyor. Alarmlar ve Geçiş Kontrol sorgu hataları yerel sınırlarla izole ediliyor. Kişiler/Cihazlar/PDKS sayfa düzeyindeki hata ve projesiz durumlarında sayfa başlığı korunuyor.
- Ana içerik kaydırması gerçek main üzerinde yönetiliyor. Yeni pathname geçişi başa dönüyor, query filtre değişimi konumu koruyor, geri/ileri kaydedilmiş history-entry konumunu kullanıyor. Gecikmeli içerik için observer tabanlı restorasyon 30 saniyeyle, konum geçmişi 100 kayıtla sınırlandırılıyor.
- PDKS alt rotaları ve rapor grup/detay başlıkları breadcrumb ve duyurulan sayfa adında çözülüyor.
- Mobil menü kapanışı, doğrulama penceresi ve sayfa geçişi odakları çakışmadan yönetiliyor. Kapanmış menü bağlantısı yerine gerektiğinde güncel main odaklanıyor. Alarmlar yatay tablo bölgesi adlandırılmış ve klavyeyle odaklanabilir.

## Nihai doğrulama

| Kontrol | Sonuç |
|---|---|
| Tam Vitest koşusu | 500 dosya, 5622 test geçti |
| `tsc --noEmit -p tsconfig.app.json` | Geçti |
| `eslint src convex` | 0 hata, başlangıçtan kalan 2 unused değişken uyarısı |
| `npm run build` | Geçti |
| Değiştirilen frontend yollarında diff boşluk kontrolü | Geçti |
| Bağımsız canlı QA | Bulunan üç sorun düzeltildi ve yeniden doğrulandı |

İlk tam koşuda iki mevcut vardiya testi eski tarih ve nested HTML beklentileri nedeniyle başarısızdı. Tarih değerleri, etiket ilişkileri, ekran okuyucu metni ve 44 px seçim hedefleri incelendikten sonra testler sunum yapısına daha az bağımlı hale getirildi. Nihai tam koşu tüm testleri geçti.

Build mevcut `__dirname` config-loader, Radix wildcard CSS ve büyük bundle uyarılarını sürdürüyor. Lint uyarıları `convex/attendanceCorrections.test.ts` ve `convex/cardReadings.readingAccess.test.ts` dosyalarında. Bu frontend uygulamasında backend değişikliği yapılmadı.

## Canlı kanıt

Dört pilot 390, 760, 761, 767, 768, 1099, 1100 ve 1440 px genişliklerinde bir h1/bir main ve sayfa yatay taşması açısından kontrol edildi. Gereken taşma tablo bölgesinde kaldı. Mobil filtre tıklama/temizleme, menü açma/kapatma, kolon bölgesinde klavye kaydırma, bölüm başlığı odağı, yerel taslak uyarısı/iptal/taslağı bırakma ve gerçek SPA PUSH/query/POP kaydırma akışları denendi. Alarmlar, Geçiş Kontrol ve Raporlar ayrıca örneklendi. Sekiz pilot ve altı ek ekran görüntüsü evidence klasöründe.

[Ölçümler, önce/sonra ekranları ve canlı test ayrıntıları](verification-live.md)

Gerçek %200 tarayıcı zoom’u, fiziksel dokunmatik cihaz, ekran okuyucu, koyu tema, diğer roller, uzun veri ve zorlanmış canlı hata durumları tam doğrulanmadı. 720×500 CSS viewport ile daralan alan reflow kontrolü geçti. Çalışma mevcut oturum/veri ve paylaşılan çalışma ağacında yapıldı. Canlı kontrolde yerel taslaklar temizlendi ve yalnız inceleme sekmesi kapatıldı.

## Teknik raporlar

- [Plan ve tamamlanma durumu](IMPLEMENTATION.md)
- [Ortak bileşen ve pilotlar](implementation-foundation.md)
- [Tablo ve filtreler](implementation-readability.md)
- [Durum ve hata sınırları](implementation-states.md)
- [Takvim ve ayarlar](implementation-workspaces.md)
- [Diğer yönetim sayfaları](implementation-remaining-pages.md)
- [Kabuk ve rota bağlamı](implementation-shell.md)
- [Odak ve klavye düzeltmeleri](implementation-shell-focus.md)
- [Vardiya test beklentileri](implementation-test-verification.md)

# WC kişi düzeltme planı
1. F03: toplu departman taşımasında şirketi departmandan çöz ve tarihçeyi test et.
2. F05: değişen cihaz profilini mutation içinde saptayıp Hik + IDE kuyruğunu test et.
3. F06: TC değerini doğrulama/tekillik/yazma öncesi normalize et; API testleri ekle.
4. WB ortak kart yardımcısını kullan; yardımcının sözleşmesini koordinatörden doğrula.
5. F09/F11: sunucu cursor sayfalama, mevcut TR arama/sıralama ve filtreleri koruma.
6. Liste biyometri özetini yalnız görünen kişi kimlikleriyle sorgula; sınır testleri ekle.
7. Alt departman seçeneği ve mevcut geçerlilik bitiş alanını form/listeye bağla.
8. Her madde için hedefli vitest; değişen dosyalarda eslint ve node leak kapısı.
9. Şema/ownership gereksinimini uygulamadan önce koordinatöre sor.
10. Tamamlandı: tüm çalışan insert/patch yolları merkezi `convex/lib/employeeListFields.ts` yazıcısına bağlandı; ayrıntı sorgusu tekil oldu.
11. F09 indeksleri (7): `by_project_nameAsc`, `by_project_emailAsc`, `by_project_companyAsc`, `by_project_departmentAsc`, `by_project_positionAsc`, `by_project_cardAsc`, `by_project_statusAsc`.
12. WB isteği: opsiyonel `hikEmployeeNo` + `by_project_hikEmployeeNo` ayrıca eklendi; mevcut indeks silinmedi.
13. Yalnız eksik/eski sürüm anahtarlarında eski tek liste aboneliği korunur; v2'de org ad değişimi/yeni org/Unicode legacy'ye düşürmez.
14. Son denetim: 24 hedef dosyada 352 test yeşil (`--maxWorkers=2 --testTimeout=15000`); eslint 0 error ve Node sızıntısı temiz.
15. Sınırlar: sayfa/biyometri 100 kişi, durum sayımı ve CSV eşleştirme 2000, organizasyon başına 1000; aşım sessiz kesilmez.
16. Backfill `employees.backfillListFields`: en fazla 100 kayıt/sayfa, otomatik çalışmaz; gerçek DB'de çalıştırılmadı, ayrı Emre onayı bekler.
17. Son ek indeks: WB için `by_hikEmployeeNo`; employees toplamı 32 (indeks sınırında); backfill hâlâ gerçek DB'de çalıştırılmadı.
18. Denetim turu: API'den özel liste alanlarını çıkar; D8 yalnız değişen kartı doğrula; sayfa test mock'ları + bitiş etiketi.
19. F09: global org imzası yerine sabit org kimlik gruplarıyla güncel ad sırası; tüm Unicode için yedek anahtar; sayfa dolana kadar sınırlı sunucu filtresi.

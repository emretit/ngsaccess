# Geçiş Kontrol Dalga 3 — A2: Kurallar arama alanı seçicisi (01-O3)

## Hedef
Kurallar listesinde aramanın kural, kişi ya da kapıya göre yapılabildiği açıkça anlaşılır; "Kural adı" yazan seçici bir filtre değeri gibi okunmaz.

## Ownership (yalnız bunlar; testleri dahil)
- src/components/access-control/unified/rules-list/RulesFilters.tsx (+ yeni test serbest)
- src/components/access-control/unified/rules-list/RulesPage.tsx yalnız placeholder/prop gerekiyorsa (A worker'ı bitti, çakışma yok)
Kapsam dışı: diğer tüm dosyalar. RulesFilters.tsx'e başka oturum cead1059'da dropdown/mobil düzenlemesi yaptı; onu koru (SelectTrigger sınıfları vb.).

## İstenenler
1. **01-O3:** Seçici "Ara: Kural ▾" gibi önekli ya da aria-label + görünür etiketle "Arama alanı" olarak sunulur (seçenekler: Kural, Kişi, Kapı). Arama kutusu placeholder'ı seçime göre değişir ("Kural adı ara" / "Kişi adı ara" / "Kapı adı ara"). Mobilde 44px hedef korunur.

## Kabul
- Test: seçici erişilebilir adıyla "Arama alanı" olarak bulunur; seçim değişince placeholder değişir.
- Mevcut rules-list testleri yeşil.

# Görev: Ortak PaginationBar — tek sayfada gereksiz kontrolleri gizle

Hedef (test edilebilir): Toplam sayfa sayısı biliniyor ve 1 iken (pageCount <= 1, page <= 1) "Önceki", sayfa göstergesi ("1 / 1") ve "Sonraki" render edilmez; bu tek sayfa durumunda sayfa boyutu seçicisi de yalnız seçili boyut en küçük seçenekse (pageSize === Math.min(...pageSizes)) gizlenir. Özet metni (role="status") her zaman kalır.

## Ownership (yalnız bunlar)
- src/components/shared/PaginationBar.tsx
- src/components/shared/PaginationBar.test.tsx
- PaginationBar kullanan listelerin TEST dosyaları, YALNIZ bu değişiklik yüzünden kırılırlarsa ve src/components/devices/ ALTINDA DEĞİLLERSE. src/components/devices altındaki bir test kırılırsa DÜZELTME, raporda dosya:satır yaz (o klasör başka worker'da).

## Kurallar
- pageCount undefined (sunucu imleçli sayfalama) → davranış AYNEN kalır (Önceki/sayfa/Sonraki görünür).
- Kullanıcı büyük sayfa boyutu seçtiyse (ör. 100/sayfa, 30 kayıt → tek sayfa) seçici GÖRÜNÜR kalır ki geri küçültebilsin; Önceki/Sonraki yine gizlenir.
- Çağıranları (9 liste) değiştirme; API geriye uyumlu kalsın (yeni zorunlu prop yok).
- Kapsayıcı düzen bozulmasın: sağ grup boş kalırsa boş div render etme.

## Kapsam dışı
FilterBar, cihaz bileşenleri, convex/*.

## Kapılar
- node_modules/.bin/tsc --noEmit -p tsconfig.app.json (sahiplik dışı hatalar raporlanır)
- node_modules/.bin/eslint src/components/shared
- node_modules/.bin/vitest run  (TAM; src + convex — sonuç sayılarını raporla). PaginationBar.test.tsx'e üç senaryo ekle: tek sayfa+en küçük boyut (hepsi gizli), tek sayfa+büyük boyut (seçici görünür, gezinme gizli), pageCount undefined (değişmemiş).

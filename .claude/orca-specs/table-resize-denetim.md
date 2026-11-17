# Görev: Tablo sütun genişliği (resize) değişikliğini denetle — SALT OKUMA

Repo: /Users/emreaydin/ngsaccess. Ana dizindesin; worktree açma.
Değişen dosyalar: `.claude/pathspec-table-resize.txt` (her satır bir dosya). Diff: `git diff -- $(cat .claude/pathspec-table-resize.txt)`;
yeni dosyalar: src/components/ui/table-resize.tsx, src/components/ui/table.test.tsx.
Altyapıyı koordinatör yazdı; 24 tablo dosyasını 4 Codex worker uyguladı. Sen Codex'in uygulamasını ve altyapıyı denetle.

## Altyapı sözleşmesi
- `<Table resizeKey>` + `<TableHead columnId>`; ilk sürüklemede görünen tüm columnId'li başlıklar ölçülüp dondurulur, tablo `table-layout: fixed`
  ve genişlik = görünen başlıkların toplamı. columnId'siz görünen başlık hücresi ölçülen genişlikle toplanır (sınıf genişliği yoksa 0'a düşebilir).
- Onay kutusu / işlem sütunları `resizable={false}`. Metin hücreleri `truncate` + `title`.

## Kontrol et (her bulgu: dosya:satır + somut senaryo)
1. `resizeKey`'li her tabloda header satırındaki her başlık `columnId` alıyor mu? Eksik olan → donma sonrası 0 genişlik riski.
2. Aynı tablo içinde yinelenen columnId; farklı tablolarda aynı resizeKey (çakışma).
3. Ham <table>→<Table> dönüşümünde görünüm/davranış kaybı: kaybolan className, aria-label, scope, onClick, colSpan sayısı (TableStateRow colSpan = sütun sayısı mı), mobil dalın bozulması.
4. Altyapı hataları: src/components/ui/table-resize.tsx ve table.tsx (React kuralları, pointer capture, localStorage, SSR, erişilebilirlik).
5. Görünür regresyon: sabit `max-w-*` kaldırılınca dondurulmamış (varsayılan) düzende hücre taşması; badge/buton hücrelerinin kırpılması.

## Kapsam dışı / yasak
- DOSYA YAZMA YOK, düzeltme yapma. `git add/commit/stash/checkout`, push, deploy YOK.
- Testleri koşmana gerek yok (koordinatör koşuyor); istersen tek dosya vitest koşabilirsin.

## Rapor (worker_done, Türkçe, ≤15 satır)
- Bulgular önem sırasıyla: [Yüksek/Orta/Düşük] dosya:satır — sorun — önerilen düzeltme (tek satır)
- Bulgu yoksa "temiz" + kontrol ettiğin dosya sayısı.

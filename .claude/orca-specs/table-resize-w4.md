# Görev: Yönetim / Ayarlar tabloları

Hedef (test edilebilir): ownership listesindeki tüm masaüstü tablolarında kolon başlıkları sürüklenerek genişletilebilir/daraltılabilir olur ve metin hücreleri genişleyince tam görünür.

## Ownership (yalnız bu dosyalara yaz)
- src/components/admin/AdminDevicesPanel.tsx
- src/components/admin/IdeProvisioningCard.tsx
- src/components/admin/components/UserTable.tsx
- src/components/admin/projects/ProjectsTable.tsx
- src/components/settings/sections/RolesSettings.tsx
- src/components/settings/sections/components/HolidayCalendarManager.tsx
- bu dosyaların .test.tsx eşleri (yalnız gerekirse güncelle)

## Kapsam dışı
- src/components/ui/table.tsx, src/components/ui/table-resize.tsx (altyapı, salt-okunur)
- Listede olmayan her dosya; mobil kart görünümleri

# Ortak kurallar — tablo sütun genişliği (resize) uygulaması

Repo: /Users/emreaydin/ngsaccess (React + Vite + Tailwind + shadcn). Ana dizinde (main) çalış, worktree AÇMA.

## Altyapı (HAZIR — DEĞİŞTİRME)
- `src/components/ui/table.tsx` + `src/components/ui/table-resize.tsx` (oku, anla, düzenleme).
- `<Table resizeKey="<benzersiz-anahtar>">` → tablo sürüklenebilir sütunlu olur. Anahtar localStorage'da genişlik saklar:
  sayfa+tablo bazında sabit, kebab-case, ör. `employees`, `audit-log`, `access-readings`.
- `<TableHead columnId="<sabit-id>">` → sağ kenarda sürükleme tutamağı. İlk sürüklemede görünen TÜM columnId'li başlıkların
  o anki genişliği dondurulur ve tablo `table-layout: fixed` olur.
- Onay kutusu / işlem (⋯, "Ayrıntı") / ikon sütunları: `columnId="select"` veya `"actions"` + `resizable={false}` (dondurulur, tutamak yok).
- Başlık metin değilse (buton, sıralama bileşeni, sr-only) `resizeLabel="Ad soyad"` ver.
- KURAL: `resizeKey`'li tabloda header satırındaki HER başlık hücresi `columnId` almalı (yoksa donmada 0 genişliğe düşebilir).
- ÖRNEK (tarayıcıda doğrulandı): `src/components/employees/EmployeeTable.tsx` (`resizeKey="employees"`),
  `src/components/employees/table/EmployeeSortColumn.tsx` (`columnId={key}` + `resizeLabel={label}`),
  `src/components/employees/table/EmployeeSelectAll.tsx` (`columnId="select" resizable={false}`).
- Çok satırlı / colSpan'lı başlık varsa yalnız SON header satırı ölçülür; böyle karmaşık ızgaraları (takvim, matris) DÖNÜŞTÜRME, raporda "atlandı + sebep" yaz.

## Her tablo için yapılacaklar
1. Ham `<table>/<thead>/<tr>/<th>/<td>` kullanılıyorsa `@/components/ui/table` bileşenlerine çevir (Table, TableHeader, TableRow,
   TableHead, TableBody, TableCell). Mevcut className'leri KORU (cn/twMerge çakışmayı çözer); görünüm değişmemeli.
   Var olan dış `overflow-x-auto rounded-md border` sarmalayıcıyı koru.
2. `resizeKey` + her başlığa `columnId` ekle (yukarıdaki kural).
3. Metin hücreleri (ad, e-posta, kapı, cihaz, not, proje…): sütun daralınca taşmasın, genişleyince tam görünsün —
   `truncate` + `title={tam metin}` kullan; sabit `max-w-48/max-w-44/max-w-64` gibi hücre içi sınırlar sütun genişlemesini engelliyorsa
   `max-w-full`'a çevir (sütun genişledikçe metin de açılsın). Badge/buton hücrelerini bozma.
4. Bir sütunun varsayılan genişliği isim/metin için açıkça dar ise (ekrandaki sorun: Personel tablosunda "Bengu AY…" kırpılıyor,
   yanında boş E-posta sütunu var) makul bir varsayılan `w-[..]` ver; tasarımı baştan değiştirme.
5. Mobil görünüm (ResponsiveResults `mobile=` dalı, kart listeleri) DOKUNMA.

## Yasaklar
- `git add`, `git commit`, `git stash`, `git checkout -- <dosya>`, push, deploy, Convex deploy/migration, DB yazma YASAK.
  (Önceki bir worker commit attı; bu kez kesinlikle yok. Bitince `git status` çıktısında yalnız senin dosyaların değişmiş olmalı.)
- Ownership listesi DIŞINDA dosyaya yazma. Başka oturumların değiştirdiği dosyalar var (ör. src/pages/Employees.tsx, EmployeeForm*) — dokunma.
- `any`, `as any`, `!` non-null assertion yok.

## Kapılar (kendin koş, çıktının son satırlarını raporla)
- `node_modules/.bin/tsc --noEmit -p tsconfig.app.json` → 0 hata (uzun sürebilir, ~3 dk)
- `node_modules/.bin/eslint <senin dosyaların>` → 0 error
- Dosyalarına ait testler: `node_modules/.bin/vitest run <ilgili .test.tsx dosyaları>` (dosya adıyla `find src -name '*<Ad>*.test.*'`)
  Test markup'a bağlı kırılırsa testi yeni davranışa göre GÜNCELLE (testi silme, iddiayı zayıflatma).

## Rapor (worker_done, ≤10 satır, Türkçe)
- Dönüştürülen tablolar: `dosya:satır` + resizeKey
- Atlanan tablolar + sebep
- Kapı sonuçları (tsc/eslint/vitest son satır)
- Div tabanlı "tablo gibi" görünen ama <table> olmayan listeler gördüysen yalnız dosya adını yaz (dönüştürme).

# UI Audit 2 düzeltme — Adım 0: ortak bileşenler

## Hedef
Birden çok sayfanın kullandığı ortak bileşen/yardımcıları düzelt; sayfa dosyalarına dokunmadan, mevcut API geriye uyumlu kalsın.
Bitti = aşağıdaki 8 madde yapıldı + kapılar yeşil.

## Bağlam
Repo: /Users/emreaydin/ngsaccess (React + Vite + TS strict, Convex backend). Bulgu raporları: `docs/ui-audit-2/NN-*.md`
(her birinin sonunda "Kararlar (Emre)"). Arayüz metinleri Türkçe, sade; cümle düzeni ("Cihaz adı", "Cihaz Adı" değil).
Proje kuralları: `any`/`as any` YASAK (eslint error) → `unknown` + daraltma; `!` non-null yerine optional chaining + erken dönüş.

## Yapılacaklar
1. `src/components/shared/UnsavedChangesDialog.tsx`: düğmeler "Vazgeç"/"Çık" → **"Düzenlemeye dön"** / **"Kaydetmeden çık"** (05-O6, 09-O5, 10-O3, 13-O2). `src/components/shared/SaveBar.tsx` içinde "değişikliği at" anlamında "Vazgeç" varsa → "Değişiklikleri at".
2. `src/components/ui/checkbox.tsx`: seçili değilken kenar nötr gri (A2 token, ör. `border-input`), seçiliyken bordo (primary); görsel boyut aynı kalsın ama tıklama alanı en az 24×24 (ör. `relative` + `after:absolute after:-inset-1`/`-inset-2` ile görünmez alan) (02-O4, 02-D6, 03-D8, 05-D4). Yerleşim kaymasın.
3. `src/components/shared/EmptyState.tsx`: `role="status"` yalnız dinamik boş durumlarda; prop ile kapatılabilsin (ör. `live?: boolean`, varsayılan mevcut davranış) (04-D2).
4. `src/components/sync/DeviceSyncStatusBanner.tsx`: "Geçmiş doğrulanmış cihaz onayı: … (TR saati; yeni gönderimin sonucu değildir)" → sade "Son doğrulanan cihaz senkronu: 20.06.2026 12:20"; uzun açıklama `title`/küçük ⓘ ipucuna. Onay 7 günden eskiyse warning tonu + göreli süre ("4 ay önce") (03-O7, 05-D5, 06-D2).
5. `src/lib/date.ts`: `formatTrDateTime(value: number | Date, opts?: { seconds?: boolean })` → "19.10.2026 18:20" ve `formatTrDate(value)` → "19.10.2026"; ikisi de `timeZone: "Europe/Istanbul"`. Mevcut fonksiyonlara dokunma. Test ekle (`src/lib/date.test.ts` varsa genişlet): UTC 21:30 → ertesi gün TR 00:30 vakası dahil.
6. Yeni `src/lib/deviceBrand.ts`: `deviceBrandLabel(brand: string | undefined | null): string` (hikvision→"Hikvision", ide_smart→"IDE Smart", other/bilinmeyen→"Diğer"; repo'daki mevcut marka etiket haritalarını `grep -rn "IDE Smart" src` ile bul, aynı etiketleri kullan). + test. Sayfa dosyalarındaki eski haritaları DEĞİŞTİRME (sayfa worker'ları geçirecek).
7. `src/components/access-control/unified/components/TimeSchedule.tsx`: gün düğmelerinde seçili/seçili değil farkı belirgin (seçili: dolu koyu/bordo zemin + açık yazı; değil: çerçeveli beyaz), `aria-pressed` korunur (06-O4). `src/components/access-control/unified/components/weekdays.ts` (yolu doğrula): form düğmeleri de tablodaki kısaltmaları kullansın (Pzt, Sal, Çar, Per, Cum, Cmt, Paz) (05-O4).
8. `src/components/shared/FilterBar.tsx`: görünür etiketli ve etiketsiz alanlar aynı hizada dursun (06-D3).

## Ownership (yalnız bunlar + yeni test dosyaları)
`src/components/shared/{UnsavedChangesDialog,SaveBar,EmptyState,FilterBar}.tsx`, `src/components/ui/checkbox.tsx`,
`src/components/sync/DeviceSyncStatusBanner.tsx`, `src/lib/date.ts`, `src/lib/deviceBrand.ts` (yeni),
`src/components/access-control/unified/components/{TimeSchedule.tsx,weekdays.ts}` + bunların test dosyaları.

## Kapsam dışı
Sayfa dosyaları (`src/pages/**`, `src/components/<sayfa>/**` diğerleri), `convex/**`. Mevcut testler yeni etiketlere göre güncellenebilir (yalnız metin beklentisi).

## Kapılar (hepsi yeşil olmalı)
- `node_modules/.bin/tsc --noEmit -p tsconfig.app.json` → 0 hata
- `node_modules/.bin/eslint src convex` → 0 error
- `node_modules/.bin/vitest run src/components/shared src/components/ui src/components/sync src/lib src/components/access-control` → yeşil

## Yasak
commit / push / deploy / migration / Convex DB yazma YOK. `npx convex` çalıştırma. Paket ekleme YOK.

## Rapor (worker_done, ≤10 satır)
Her madde için tek satır: yapılan + `file:line`. Kapı sonuçları (sayılarla). Değiştirilen tam dosya listesi `--files-modified` ile.

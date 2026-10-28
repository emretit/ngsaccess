# Ortak bileşen Dalga 1 — ortak kurallar

Repo: /Users/emreaydin/ngsaccess (ana dizin, main). Worktree AÇMA. React + Vite + Tailwind + shadcn/ui, Convex backend.
Arka plan raporu: .claude/design/ortak-bilesen-B.md (B01, B08 bölümleri) — önce ilgili bölümü oku.

## Davranış sözleşmesi (iki worker için aynı)
- Async işlem süren dialog/onay: pending boyunca butonlar disabled, Escape/dış tıklama ile kapanmaz.
- Dialog YALNIZ başarıda kapanır. Hata olursa açık kalır, kullanıcının yazdığı not/girdi korunur, hata bildirimi (notify.error) gösterilir.
- Aynı işlem için çift toast YOK (hook `success`/`error` verdiyse callback içinde ayrıca notify çağırma).
- Mevcut Türkçe başarı/hata metinlerini AYNEN koru.
- `src/hooks/useAsyncAction.ts` ve `src/components/shared/ConfirmDestructive.tsx` DEĞİŞTİRME (58 / 39 kullanıcı var). Olduğu gibi kullan.

## Kod kuralları
- `any` / `as any` / `!` non-null yasak; `unknown` + narrowing. Yorum yoğunluğu çevredeki kod kadar.
- Convex dosyalarına dokunma, `npx convex` çalıştırma.
- `git add`, `git commit`, `git stash`, `git reset`, `git checkout`, `git restore` ÇALIŞTIRMA. commit/push/deploy/migration/DB yazma YOK.
- Bağımlılık ekleme. Testler mevcut kalıpla (vitest + `renderToStaticMarkup`, `vi.mock("convex/react")`); @testing-library yok.
  Kapanma/açık kalma davranışını test etmek için handler'ı küçük, export edilen saf/async bir fonksiyona ayırmak doğalsa ayır ve onu test et;
  doğal değilse zorlamadan atla ve raporda söyle.
- Ownership dışında hata görürsen DÜZELTME; dosya:satır ile raporla.
- Bir dosya sözleşmeye temiz oturmuyorsa (ör. optimistic güncelleme geri alma ihtiyacı) zorlama: dokunma ya da en küçük düzeltmeyi yap, nedenini raporla.

## Rapor
worker_done özeti ≤10 satır: dosya başına ne değişti (file:line), kapı sonuçları, bilinçli olarak dokunulmayanlar ve nedeni.

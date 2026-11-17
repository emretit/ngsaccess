# Dalga 3c · Ölü durum değerleri envanteri (SALT OKUMA)

Hedef: A-06, A-07, A-08, B-06, B-07, C-07, C-08 için her bulguya "kaldır / belgele / daralt" önerisi içeren bir rapor dosyası; kod DEĞİŞMEZ.

## Görev
1. Bulgu metinlerini oku: `docs/audits/2026-11-14-implicit-state-machines/README.md` + `device-sync.md`, `access-visitor-account.md`, `people-pdks.md`.
2. Her bulgu için kodda doğrula (grep/okuma): değer nerede yazılıyor (file:line), nerede okunuyor, web'de (`src/**`) gösteriliyor mu, mobilde (`mobile/**` varsa) kullanılıyor mu.
3. A-06 (`doors.status`, `readers.status` serbest string): kodun yazdığı tüm değerleri listele; canlı veride sayım için koordinatörün koşacağı SALT OKUMA komutunu öner (çalıştırma).
4. Her bulgu için öneri: (a) kaldır — güvenli, hangi dosyalar; (b) belgele — yorum metni; (c) union'a daralt — widen-migrate-narrow adımları, migration gerekip gerekmediği.

## Çıktı
- Yalnız şu dosyayı yaz: `docs/audits/2026-11-14-implicit-state-machines/dalga3c-olu-degerler.md` (Türkçe, sade).
- Başka HİÇBİR dosyaya yazma. Kod, schema, test değişikliği YOK. `npx convex run` YOK.

## Rapor
`worker_done`'da ≤10 satır: bulgu başına tek satır öneri + rapor yolu.
## Ortak kurallar (HER worker için bağlayıcı)
- Repo: /Users/emreaydin/ngsaccess, ana çalışma dizini (main). Yeni worktree/dal AÇMA.
- **git add / git commit / git stash / git checkout / git reset / git restore / git switch YASAK.** Commit, push, deploy, `npx convex dev/deploy`, migration, `npx convex run` ile DB yazımı YASAK. Koordinatör reflog'a bakacak.
- Çalışma ağacında başka oturumların commit'lenmemiş değişiklikleri var (PDKS, reports, schema vb.). Ownership listen DIŞINDAKİ hiçbir dosyaya yazma; ownership dosyasında senden önce gelen değişiklik varsa koru.
- Convex kodu yazmadan önce `convex/_generated/ai/guidelines.md` oku. Proje kuralları: `CLAUDE.md` (any yasak, camelCase alan, `filter(Boolean)` değil type guard).
- Node modülü içe aktaran convex dosyası `"use node"` ister.
- Kaynak bulgu metni: `docs/audits/2026-11-14-implicit-state-machines/README.md` + alan raporları (`device-sync.md`, `access-visitor-account.md`, `people-pdks.md`). Önce bulguyu kodda yeniden doğrula; bulgu artık geçerli değilse düzeltme yapma, raporla.
- Kapılar (hepsini kendin koş, çıktıyı rapora yaz):
  - `node_modules/.bin/tsc --noEmit -p tsconfig.app.json` → 0 hata
  - `node_modules/.bin/eslint <değiştirdiğin dosyalar>` → `no-explicit-any` 0
  - `npx vitest run <ilgili test dosyaları>` → yeşil (tam vitest'i koordinatör koşacak; başka worker'lar da paralel çalışıyor, tam koşu açma)
- Rapor: `worker_done` içinde ≤10 satır: her bulgu için ne değişti (file:line), eklenen testler, kapı sonuçları, açık kalan/karar gereken nokta.

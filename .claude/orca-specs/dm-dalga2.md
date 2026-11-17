# Dalga 2 · A-03 + C-03 + A-04: geç gelen sonucun yeni durumu ezmemesi (deneme/nesil token'ı)

Hedef (test edilebilir): Eski bir denemeye ait gecikmiş ACK veya toplu gateway sonucu, aynı satır/grant için sonradan yazılmış yeni durumu (yeni pending payload, `removed`, `pending`) DEĞİŞTİREMEZ; testler bunu kanıtlar.

## Bulgular
- **A-03** (high) Hik işlem kuyruğu: dedupe adımı işlenmekte olan (`processing`) satırı yeni payload'la `pending`'e çeviriyor; eski denemeden gecikmeli gelen ACK deneme kimliği kontrol edilmediği için yeni işi `done`, yetkiyi `effective` yapıyor. `convex/hikvisionSync.ts:476-487, 619-625, 683-695`.
  - Çözüm yönü: satıra monoton `attempt` (veya `generation`) sayacı; claim'de sayaç artar ve claim cevabında döner; dedupe payload değiştirirse sayaç artar; ACK sayaç (veya claim token) taşır, eşleşmezse no-op (log/sayaç ile) döner. ACK'te token yoksa (eski istemci) mevcut davranış korunur ama satır `processing` değilse veya payload claim'den sonra değiştiyse ezme yapılmaz.
  - Ayrıca A-05'in Hik ayağı: Hik ACK done/failed olduğunda ilgili `mobileAccessOperations` satırı terminal duruma geçsin (IDE ayağı Dalga 1'de `convex/ideSync.ts` + `convex/lib/mobileAccess.ts` içinde yazıldı, aynı helper'ı kullan; `lib/mobileAccess.ts`'e yalnız gerekiyorsa küçük ekleme).
- **C-03** (high) Erişim sonucu: toplu gateway sonuçları işlem kimliği/sürüm taşımıyor; geç biten eski action sonradan yazılmış `removed`/`pending` durumunu `effective` ile eziyor. `convex/lib/hikSyncEmployee.ts:378-389, 587-590`, `convex/lib/grantStatus.ts:148-159`.
  - Çözüm yönü: grant status satırına nesil/sürüm (ör. `syncGeneration` veya `requestedAt`); action başlarken okunan nesil sonuç mutation'ına geçer; nesil uyuşmazsa sonuç yazılmaz.
- **A-04** (medium, savunma derinliği) IDE ACK'te `msxId` opsiyonel: `convex/ideSync.ts` ACK yolu msxId yoksa yalnız hâlâ `sent` olan ve tek eşleşen satırı kapatsın; msxId varsa ve satırınkiyle uyuşmuyorsa no-op. Canlı MQTT köprüsü (`scripts/lib/ide-mqtt-routing.mjs`) zaten msxId gönderiyor; onu kırma.

## Ownership (yalnız bunlara yaz)
- `convex/hikvisionSync.ts`, `convex/ideSync.ts`, `convex/lib/grantStatus.ts`, `convex/lib/hikSyncEmployee.ts`, `convex/http.ts` (yalnız ACK/claim payload'ına token alanı eklemek gerekiyorsa)
- `convex/schema.ts`: YALNIZ yeni `v.optional(...)` alan ekleme (genişletme, migration yok). Dosyada başka oturumların değişikliği var, onlara dokunma. Başka satırı düzenleme.
- `convex/lib/mobileAccess.ts`: yalnız Hik ACK → mobil satır terminal helper'ı gerekiyorsa.
- Bu dosyaların test dosyaları + yeni test dosyaları (ör. `convex/hikvisionSync.attempt.test.ts`, `convex/lib/grantStatus.generation.test.ts`).

## Kapsam dışı
- Windows köprüsü (`bridge/windows/**`, A-01/A-02), Linux köprüsü, `scripts/**`, web (`src/**`), Dalga 3 dosyaları (`privacyRetention.ts`, `invites.ts`, `mailSettings.ts`, `actions/*`).

## Kabul testleri (yaz ve geçir)
1. Hik: claim(deneme 1) → dedupe yeni payload → pending(deneme 2) → deneme-1 ACK done → satır `pending` kalır, grant `effective` olmaz.
2. Hik: doğru token'lı ACK → `done` + grant `effective` (mevcut davranış).
3. C-03: action nesil N ile başlar → arada `removed` yazılır (nesil N+1) → nesil-N sonucu gelir → durum `removed` kalır.
4. IDE: msxId uyuşmayan ACK no-op; msxId'siz ACK tek `sent` satırı kapatır.
5. Hik ACK sonrası mobil kapı açma satırı terminal duruma geçer (varsa).
Ek kapı: `npx vitest run convex/hikvisionSync convex/ideSync convex/lib/grantStatus convex/lib/hikSyncEmployee convex/lib/mobileAccess convex/mobileAccess`.
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

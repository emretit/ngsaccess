# W4.1a DÜZELTME 1 — denetim bulguları (UYGULAMA)

Çalışma dizini: `/tmp/hik-headbuild` — İLK İŞ `cd /tmp/hik-headbuild`. Bu, W4.1a backend'inin donmuş kopyası: W4.1a değişiklikleri STAGED (index'te), taban `92e6995`. Senin düzeltmelerin UNSTAGED kalsın: `git add` / `git stash` / `git reset` / `git checkout` YAPMA (koordinatör `git diff` ile yalnız senin farkını alıp asıl worktree'ye taşıyacak).
Denetim raporu: `/tmp/w41a-denetim.md` (oku). Orijinal spec: `/Users/emreaydin/ngsaccess/.claude/orca-specs/w4-1a-schedule-templates-backend.md`.

## Ortak kurallar
- TypeScript strict; `any`/`as any`/`!` yok; `unknown` + narrowing; tip korumalı filtre (`filter((x): x is T => ...)`), `filter(Boolean)` değil.
- Convex: `convex/_generated/ai/guidelines.md`. Sınırsız `.collect()` yok; yeni cron/polling yok.
- YASAK: commit, push, deploy, `npx convex *`, DB yazma, `src/**`, `mobile/**`, `bridge/**`, `convex/_generated/**` (yeni modül EKLEME; mevcut modüllere yaz).

## Düzeltmeler
**E1 — `convex/ideSync.ts` ~249 `enqueueIdeOp`:** `.take(1001)` + sınır hatasını kaldır. Değişmez: aynı `idempotencyKey` için açık (pending/sent) kayıt varsa yeni satır eklenmez, o patch'lenir → açık kayıt her zaman o anahtarın EN YENİ satırıdır. Bu yüzden `by_idempotency` + `.order("desc").take(20)` ile açık kaydı ara; bulunamazsa ekle. Hata atma. Testle sabitle (1000+ acked satırı olan anahtarda enqueue çalışır).

**E2 — IDE izin numarası: tek satırlık monoton sayaç.** `allocateIdePermissionNos` (~547) ve `ensureIdePermissionNo` artık tüm `accessRules` + `idePendingOperations` tablosunu TARAMASIN. Şemaya küçük tablo ekle (ör. `ideSequences: { name: v.literal("permissionNo"), last: v.number() }` + `by_name`). İlk kullanımda satır yoksa BİR KEZ başlat: mevcut en büyük numara = max(`accessRules.idePermissionNo`, `ideExtraPermissionNos`, açık/geçmiş `upsertPermission`/`deletePermission` op payload id'leri) — bu tek seferlik tarama sınırlı (`.take(N+1)` + aşarsa açık Türkçe hata) olabilir. Sonra her ayırma `last+1` (aynı mutation, OCC atomik). Emekli numara asla geri kullanılmaz (bugünkü kural korunur), 65535 sınırı korunur. Test: ardışık/paralel ayırma tekil; başlatma mevcut max'ın üstünden başlar.

**D1 — K=0 kuralda IDE hedefi yanlış `failed`** (`deviceSyncRuns.ts` ~209 + `finishTarget` ~327): segment sayısı 0 olan kuralda beklenen kuyruk sayısı 0; hedef başarılı sayılır (eski izinlerin silinmesi kuyruğa yazılmışsa o op'ların sonucu belirler). `finishTarget` değişikliğinin eski `queued` davranışını bozmadığını testle göster.

**D2 — Senkronda 16 sınırı aşılınca fail-open** (`deviceSyncRuns.ts` ~632): `upsertPermission` kayıtları HER durumda gönderilsin (saat daraltması panele ulaşsın); yalnız toplamı 16'yı aşan kişinin `upsertUser`'ı atlanıp hedef `failed` + neden ("<ad>: IDE 16 izin sınırı aşıldı") yazılsın. Diğer kişiler güncellenmeye devam etsin.

**D3 — Kişi döngüsünde başka şablonun kuralına numara ayırma** (`deviceSyncRuns.ts` ~673): bu döngü numara AYIRMAZ, yalnız mevcut `[idePermissionNo, ...ideExtraPermissionNos]` değerlerini okur. Numara ayırma yalnız kuralın kendi template/rule run'ında (upsertPermission ile aynı akışta) olur.

**D4 — Spec dışı kapsam genişlemesi geri alınsın** (`convex/actions/hikvisionSync.ts` ~140/~228): push hattına yalnız kapı üzerinden bağlı IDE panellerini / Hik dışı cihazları ekleyen değişikliği W4.0 (`92e6995`) davranışına döndür. `lib/accessGraph.ts:179` yorumu geçerli kalır.

**N (küçük, yap):**
- `accessScheduleTemplates.update`: yalnız `week` değiştiyse `template_sync` planla (ad/açıklama değişikliği gönderim tetiklemez).
- `description` temizlenebilsin (boş string/`null` → alan kaldırılır).
- `ideGatewayDevice.ts` ~347 `syncPermissionToIdePanels`: bir kişide `ok:false` döngüyü bitirmesin; kalanlar işlensin, hata toplanıp döndürülsün.
- `cardReadingProcess` / `mobileAccess`: saklı `week` bozuksa `normalizeWeek` hatası mutation'ı düşürmesin → o kural kapalı sayılsın (try/catch → false), `console.warn`.
- `lib/accessSchedule.ts:56` `filter(Boolean)` → tip korumalı filtre.

## Kapsam dışı
UI (paralel worker yapıyor; `SyncRuns.tsx` etiketi ve previewImpact debounce onda) · `list` maliyet optimizasyonu · IDE çift senkron sayısı (yalnız raporla) · tatil · W4.2.

## Kapılar (kendin koş, `/tmp/hik-headbuild` içinde)
`node_modules/.bin/tsc --noEmit -p tsconfig.app.json` → 0 · `node_modules/.bin/tsc --noEmit -p convex/tsconfig.json` → 0 · `node_modules/.bin/eslint src convex` → 0 error · `node_modules/.bin/vitest run` → tamamı yeşil (sayı).

## Rapor
`/tmp/w41a-fix1.md` + `worker_done`'da ≤10 satır: her madde için file:line + test adı · şema değişikliği · kapı sayıları · yapılmayan madde ve gerekçe.

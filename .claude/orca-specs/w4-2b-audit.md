# W4.2b DENETİM — Yetki durumu ekranı (SALT-OKUMA)

Çalışma dizini: `/Users/emreaydin/orca/workspaces/ngsaccess/w4-2-grant-status` — İLK İŞ `cd` oraya. Arayüz farkı = `src/**` (`git status --short src`) + DAR backend eki `convex/accessGrantStatus.ts` `counts.deviceId` (~90) ve testi. Aynı ağaçta commit'siz W4.2a backend'i de var (ayrıca denetlendi; yalnız API'yi anlamak için oku). Yazan: Codex. Spec: `/Users/emreaydin/ngsaccess/.claude/orca-specs/w4-2b-grant-status-ui.md` (+ koordinatör kararları: Bilinmiyor çipi tıklanamaz/açıklamalı; counts'a deviceId). Yazar raporu: `/tmp/w42b-report.md`. API: `/tmp/w42a-api.md`.

## YASAK
Kod/dosya düzenleme (rapor dosyası hariç), commit, push, deploy, `npx convex *`, DB yazma, paket kurma.

## Odak
1. **Reaktif olmama + kota:** `accessGrantStatus.*` için `useQuery` yok; tek seferlik `useConvex().query`; Yenile + run bitince TEK otomatik yenileme (döngü yok: yenileme yeni run tetiklemiyor, ref kilidi doğru); arama debounce; filtre değişiminde gereksiz çoklu çağrı; eski async yanıt yarışı.
2. **Yetki:** sekme ve tüm aksiyonlar yalnız `isAdmin`; `?tab=status` deep-link project_user'da kapalı.
3. **Yeniden dağıt:** seçim ≤100, onay metni doğru sayıyı söylüyor, `onlyFailed` yolu, backend hata metni gösteriliyor, filtreler toplu aksiyonu yanlışlıkla genişletmiyor.
4. **Gösterim doğruluğu:** durum rozetleri, `stale` "Güncel değil", `lastError` ipucu, 1000+ (capped), Bilinmiyor açıklaması, kişi detayında Bilinmiyor/Kaldırılacak/Yetkisiz ayrımı, Europe/Istanbul saat.
5. **Dar backend eki** (`counts.deviceId`): index kullanımı, `.take(1001)` capped, yetki/proje kapsamı korunuyor mu, cihaz başka projedeyse sızıntı var mı.
6. **Repo kuralları:** `any`/`as any`/`!`/`filter(Boolean)` yok; `FunctionReturnType`; Türkçe; 360 px taşma (8 kolonlu tablo → dar ekranda kart).

## Kapılar (kendin koş)
`node_modules/.bin/tsc --noEmit -p tsconfig.app.json` · `node_modules/.bin/eslint src convex` · `node_modules/.bin/vitest run src convex/accessGrantStatus.test.ts` (sayı) · `node_modules/.bin/vite build`.

## Rapor
`/tmp/w42b-denetim.md`: 1-2 cümle sonuç · kapılar · ENGEL / DÜZELTİLMELİ / NOT (file:line + senaryo + öneri). `worker_done`'da ≤10 satır özet + yol.

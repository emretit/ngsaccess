# W4.2a DENETİM — Yetki durumu (kişi×cihaz) backend (SALT-OKUMA)

Çalışma dizini: `/tmp/hik-headbuild` (W4.2a diff'inin donmuş kopyası; taban commit `6ff9d42`). İlk iş `cd /tmp/hik-headbuild`. Kodu `git diff HEAD` + yeni dosyalardan oku (`git status --short`). Yazan: Codex. Spec: `/Users/emreaydin/ngsaccess/.claude/orca-specs/w4-2a-grant-status-backend.md`. Yazar raporu/API: `/tmp/w42a-api.md (+ /tmp/w42a-report.md)`. Tasarım: `/Users/emreaydin/ngsaccess/.claude/designs/w4-template-claude.md` §4.

## YASAK
Kod/dosya düzenleme (rapor dosyası hariç), commit, push, deploy, `npx convex *`, DB yazma. Yalnız oku + kapıları koş.

## Odak (öncelik sırasıyla)
1. **Durumun doğruluğu ("Etkin" yalanı yok):** `effective` YALNIZ cihaz kabulünde (IDE `markAck` success, localBridge ack ok, gateway HTTP başarı) yazılıyor mu; enqueue/timeout/retry/yeniden kuyruğa alma yolları `effective`'i yanlışlıkla korumuyor mu (yeni gönderimde `pending`'e dönüyor mu); silme başarısı `removed`; sıra dışı ack (eski op'un geç ack'i yeni durumu ezer mi — op/run eşleşmesi).
2. **Yetki/IDOR:** sorgular ve `redistribute` proje admin/super_admin; `project_user` ve başka proje reddi; `pairs` içindeki çalışan/cihazın projeye aitliği.
3. **Kota/okuma:** IDE/bridge yolunda ek fonksiyon çağrısı 0, gateway action başına ≤1; sorgularda sınırsız tarama yok (`.paginate`/`.take`); `counts`/`unknown` hesabının okuma maliyeti; büyük projede (500 kişi × 10 cihaz) sorgu okuma limitleri; OCC çakışması (toplu senkronda aynı satıra yazım).
4. **Kapı türetimi:** Hik satırında kapılar W4.0 kural kapsamından (kapı bacağı/cihaz bacağı) doğru mu; IDE `getRuleIoIdsForPanel`; şablon adları W4.1 bağından.
5. **Bayatlık:** `appliedAt < max(rule.updatedAt, template.updatedAt)` hesabı; `updatedAt` alanları gerçekten güncelleniyor mu.
6. **Kapsam genişletmesi:** `convex/lib/accessGraph.ts` + `convex/employees.ts`'te YALNIZ `deleteIdeUserFromPanels` argümanına opsiyonel `employeeId` eklendi mi (başka değişiklik yok).
7. Şema geri uyumu (yalnız yeni tablo/opsiyonel alan/literal), `_generated/api.d.ts` yalnız 2 satır, repo kuralları (`any`/`!`/`filter(Boolean)` yok).

## Kapılar (kendin koş)
`node_modules/.bin/tsc --noEmit -p tsconfig.app.json` · `node_modules/.bin/tsc --noEmit -p convex/tsconfig.json` · `node_modules/.bin/eslint src convex` · `node_modules/.bin/vitest run` (sayıları yaz).

## Rapor
`/tmp/w42a-denetim.md`: 1-2 cümle sonuç · kapı sonuçları · ENGEL / DÜZELTİLMELİ / NOT, her biri file:line + somut senaryo + öneri. `worker_done`'da ≤10 satır özet + dosya yolu.

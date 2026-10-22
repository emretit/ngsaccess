# W4.1a DENETİM — Erişim zaman şablonları backend (SALT-OKUMA)

Çalışma dizini: `/tmp/hik-headbuild` (W4.1a diff'inin donmuş kopyası; taban commit `92e6995`). İlk iş `cd /tmp/hik-headbuild`. Kodu `git diff HEAD` + yeni dosyalardan oku (`git status --short`). Yazan: Codex. Spec: `/Users/emreaydin/ngsaccess/.claude/orca-specs/w4-1a-schedule-templates-backend.md`. Yazar raporu/API: `/tmp/w41a-api.md`. Tasarım: `/Users/emreaydin/ngsaccess/.claude/designs/w4-template-claude.md` §1-3.

## YASAK
Kod/dosya düzenleme (rapor dosyası hariç), commit, push, deploy, `npx convex *`, DB yazma. Yalnız oku + kapıları koş.

## Odak (öncelik sırasıyla)
1. **Fail-closed:** şablonlu kural + şablon yok/başka proje/silinmiş → Hik, localBridge, IDE, mobil, bulut kart/QR yollarının HER BİRİNDE erişim kapalı mı? Herhangi bir yol hâlâ gömülü alanlara/`defaultRuleSchedule`'a (boş = 7/24) düşüyor mu? Tüm çağıranları grep ile bul (`defaultRuleSchedule`, `buildIdePermissionRecord`, `mobileRuleAllows`, `isRuleOpenAt`, `startTime`/`endTime` okuyan erişim yolları).
2. **Yetki/IDOR:** şablon API'sinde proje kapsamı (başka projenin şablonunu okuma/yazma/bağlama), project_user yazma reddi, arşivli şablona yeni bağ reddi, kural bağlamada şablonun kuralla aynı projede olması.
3. **Sınır semantiği:** bulut `isAllowedAt` ile Hik'e giden segment (bitiş dakikası dahil, `24:00`) aynı sonucu veriyor mu; legacy kuralda W4.0 `isRuleOpenAt` ile birebir mi; IDE `24:00`→1439.
4. **IDE:** K kayıt numara ataması atomik mi (yarış), K azalınca silme, kişi `permissions[]` 16 sınırı = kayıtta red (kırpma yok), senkronda aşılırsa `failed` + neden.
5. **template_sync / kota:** debounce (cancel + runAfter 20 sn, id şablonda), `.take(101)` sınırları, Hik direct'te kişi upsert 0, yeni cron/polling yok, sınırsız `.collect()` yok, abonelik/okuma patlaması.
6. **Şema geri uyumu:** yalnız opsiyonel alan/yeni tablo/union literal; `_generated/api.d.ts`'te yalnız 2 satır; mevcut veride (3 kural, saatsiz Pzt-Cum) davranış değişmiyor mu.
7. Repo kuralları: `any`/`as any`/`!` yok, `filter(Boolean)` yerine tip korumalı filtre, camelCase dönüş.

## Kapılar (kendin koş)
`node_modules/.bin/tsc --noEmit -p tsconfig.app.json` · `node_modules/.bin/tsc --noEmit -p convex/tsconfig.json` · `node_modules/.bin/eslint src convex` · `node_modules/.bin/vitest run` (sayıları yaz).

## Rapor
`/tmp/w41a-denetim.md`: 1-2 cümle sonuç · kapı sonuçları · ENGEL / DÜZELTİLMELİ / NOT, her biri file:line + somut senaryo + öneri. `worker_done`'da ≤10 satır özet + dosya yolu.

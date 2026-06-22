# Session Handoff — 2026-06-20

Teknik borç roadmap'i + güvenlik review oturumu. Kullanıcı "codebase çok eski" dedi → tarama: sorun teknoloji değil (stack bleeding-edge), **yapısal borç**. 3 fazlı roadmap çıkarıldı, Faz 1 + Faz 3 tamamlandı, Faz 2 bilinçli ertelendi.

Plan dosyası: `~/.claude/plans/detayl-bir-plan-yap-dazzling-creek.md`

---

## ⚠️ ÖNCE BUNU OKU — commit'lenmemiş güvenlik düzeltmesi var

`convex/devices.ts` working tree'de **commit'lenmemiş** ve İKİ değişiklik iç içe:

1. **Claude'un HIGH güvenlik fix'i** (`getById`, ~satır 148) — **commit edilmeli, kaybolmasın.**
2. **Senin paralel edit'in** (`getHikDeviceFaceRoster` dedup, ~satır 1603) — senin WIP'in.

Ayrıca senin frontend WIP'in: `DeviceBasicSection.tsx`, `DeviceHikvisionSection.tsx`, yeni `DeviceHikModelField.tsx` (cihaz formu model alanı işi).

### Güvenlik fix'i nedir (kaçırma)
`devices.getById` (public `authedQuery`) tüm device dökümanını — `devicePassword`, `idePassword`, `ehomeKey`, `apiToken` — yalnız proje-üyeliği kontrolüyle döndürüyordu; `list`'in (`a7baf16`) `isManager` sır-gate'i yoktu. **Convex public query'leri frontend çağırmasa da client'tan doğrudan çağrılabildiğinden**, manager olmayan bir proje üyesi `api.devices.getById` ile düz metin sırları (ve forge'a yarayan `apiToken`'ı) okuyabilirdi. Fix: `list` ile birebir aynı gate (`DEVICE_SECRET_FIELDS` + `isManager`). tsc+eslint+test temiz. İki code-review finder'ı da onayladı (kırılan caller yok; `getById`'nin src'de çağıranı yok, internal akışlar `getByIdInternal` kullanıyor).

### Yapılacak
Sen kendi devices.ts + frontend WIP'ini commit'le; getById fix'i de onunla iner VEYA ayrı commit'le (`fix(security): getById sır alanlarını yönetici dışına sızdırmasın`). Kaybolmasın yeter.

---

## Bu oturumda tamamlananlar (commit'li)

| Commit | İçerik |
|---|---|
| `4bd64e1` | **Faz 1** — erişim mantığı saf birim test ağı |
| `12ce665` | **Senin ISAPI feature'ın** (44 dosya, tek commit'te toplandı) |
| `04fc40b` | **Faz 3** — ölü kod & repo hijyeni temizliği |

`refactor-baseline` tag → `12ce665` (temiz Faz-2-öncesi nokta).

### Faz 1 — Test güvenlik ağı ✅
God-file refactor öncesi erişim kararını saf fonksiyonlarla dondurdu (test 61→100):
- `convex/lib/accessDecision.ts` — `canEmployeeAccessDevice` (cihaz∩çalışan kuralları + aktif kural). `cardReadings.ts`'in iki çağrı yeri (token+kart akışı) buna bağlandı.
- `convex/lib/accessGraphPure.ts` — `computeAuthorizedCards` (panel yetkili-kart çekirdeği). `accessGraph.ts`'in `resolvePanelAuthorizedCards`'ı buna bağlandı.
- Yeni testler: accessDecision(10), accessGraphPure(7), hikEventCodes(17, önce test yoktu), reconcileMath edge(5).
- Yan: `EditDoorDialog.tsx` `FunctionReturnType` yanlış modülden import ediyordu (`convex/react`→`convex/server`) → düzeltildi (tsc app gate'i açıldı). `12ce665`'le indi.

### Faz 3 — Temizlik ✅
Silindi: `sqlQueryBuilder.ts` (ölü Supabase SQL), `server.js` (+ package.json api/dev:api script'leri), `supabase/`, `bun.lock`+`bun.lockb`, root `calısancihaz.md` dup, `CompanyInfo.created_at` ölü tip. Arşiv → `docs/archive/`. `AGENTS.md` → `CLAUDE.md` symlink.

### Güvenlik + kod review ✅ (stop-hook gereği)
- **security-review:** 1 HIGH bulgu (getById, yukarıda) → fix uygulandı (commit bekliyor). Branch'in P0 fix'leri (card-reader token pinning, sır gating, bridge RBAC) **sağlam** doğrulandı.
- **code-review:** Faz 1 refactor'ları + getById fix → **0 bulgu** (davranış-koruyan).

---

## ⏭️ SIRADA: Faz 2 — God-file refactor (BEKLİYOR)

**Neden ertelendi:** Faz 2 hedefleri (`hikGateway.ts` 2215 sat, `devices.ts`, `cardReadings.ts`, `schema.ts`) `12ce665`'teki ISAPI feature ile dolu ve **o feature canlıda henüz cihazla verify edilmedi**. Önce feature'ı doğrula; aksi halde refactor bug'ı ile feature bug'ı ayırt edilemez (zamansal conflation).

**Ön koşul:** Kullanıcı feature'ı canlıda (`notable-tern-4` deployment, `npx convex dev --once`) + cihazla verify edip "çalışıyor" diyecek.

**Plan (verify sonrası), temiz baseline'dan:**
- **2a** `lib/hikGateway.ts` → `lib/gateway/*` böl (core/devices/roster/cards/scheduling/doors/biometrics/capture/events/plans). `lib/hikGateway.ts` barrel re-export kalır → 5 importer dokunulmaz. **En düşük risk, önce bu.**
- **2b** `cardReadings.ts` → ağır mantık `lib/`'e (pdksCalc, cardReadingAudit), registered wrapper'lar yerinde → `api.cardReadings.*` korunur.
- **2c** `devices.ts` → cascade/pool/sync mantığı `lib/`'e, wrapper'lar yerinde → `api.devices.*` korunur.
- **2d** `schema.ts` → tek dosya kalır (Convex tek `defineSchema` zorunlu), bölüm yorumları + opsiyonel `docs/SCHEMA.md`.

**KRİTİK Convex kısıtı:** Convex fonksiyonları dosya yoluyla adreslenir. `convex/devices.ts`'i `convex/devices/crud.ts`'e bölmek `api.devices.update`→`api.devices.crud.update` yapar ve **27 referansı kırar**. Bu yüzden registered-function dosyalarında (devices, cardReadings) mantık `lib/`'e taşınır, wrapper'lar yerinde kalır. Sadece `hikGateway.ts` (lib, api değil, 5 importer) doğrudan bölünebilir.

**Her adım doğrulaması:** `npm test` (100 yeşil) + `tsc app+convex` 0 + `eslint` 0 + `npm run build` + `npx convex dev --once` (fonksiyon register).

---

## Genel notlar / tekrarlayan tema

- **Aktif WIP iç içe geçmesi:** Bu oturumda working tree sürekli senin paralel WIP'inle doldu (önce 44 dosyalık ISAPI feature, sonra frontend form işi). Claude her seferinde sadece kendi izole değişikliğini commit'ledi. Faz 2'ye başlamadan working tree temiz olmalı.
- **Deployment:** `notable-tern-4` = DEV ama canlı sistem orada; deploy `npx convex dev --once` (`npx convex deploy` DEĞİL). Bkz. hafıza [[convex_deployment_topology]].
- **Lint komutları (CLAUDE.md):** `node_modules/.bin/tsc --noEmit -p tsconfig.app.json` (+ `-p convex/tsconfig.json`), `node_modules/.bin/eslint src convex`. `no-explicit-any` = 0 zorunlu; `no-unused-vars` warn.
- Hafıza güncellendi: [[refactor-roadmap-status]].

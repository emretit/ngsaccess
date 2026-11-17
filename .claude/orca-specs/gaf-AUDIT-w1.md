# Denetim — Genel audit Dalga 1 düzeltmeleri (SALT OKUMA)

## Hedef
Dalga 1'de 8 Codex worker'ın yaptığı düzeltmeleri bağımsız denetle: her P0 bulgusu gerçekten kapandı mı, yeni hata/güvenlik açığı açıldı mı, test beklentisi değişiklikleri gerekçeli mi. Çıktı: `docs/genel-audit-2026-11-03/DENETIM-DALGA1.md` (tek yazabileceğin dosya).

## Ortam
- Dizin: /Users/emreaydin/ngsaccess (main, ortak ağaç). Değişiklikler commit'lenmedi; `git diff HEAD -- <dosya>` ve yeni dosyalar (untracked) üzerinden oku.
- Önce `CLAUDE.md` ve `convex/_generated/ai/guidelines.md` oku.
- Bulgu metinleri (kanıt, senaryo, öneri): `docs/genel-audit-2026-11-03/01..08-*.md`; bağlayıcı kararlar: `OZET.md`; koordinatör kararları ve worker raporları: `.claude/handoff-genel-audit-fix.md` ("Verilen kararlar" ve tablo). Worker durum mesajları (beklenti değişikliği gerekçeleri dahil): `/tmp/ga-status.log`.
- Denetlenecek dosyalar: `.claude/pathspec-genel-audit-w1.txt` (68 dosya) + A1 (PDK-001): `convex/shiftPlans.ts`, `convex/lib/shiftPlan.ts`, `src/components/shifts/DepartmentTargetPicker.tsx`. Diğer kirli dosyalar ("hafta tatili" paketi) ayrıca denetlendi, kapsam dışı.

## Worker → bulgu eşlemesi
- SEC: HSP-01/02/03/04 (invites, employeeConsents, lib/faceConsentPurge, hikQueueWorker deleteFace kolu, AdminUsersPanel)
- IDE: CIH-01/02/07/11 (devices, adminDevices, ideSync, lib/devicePool, lib/accessGraph, accessRules, deviceSyncRuns, ClaimDeviceDialog, DeviceActionsSection; schema idePanelUsers.managedByNgsplus)
- GK: GK-01/04/06 (doors, lib/doorTarget, lib/doorTargetSync, lib/mobileAccess, lib/hikSyncEmployee, actions/hikvisionSync, hikQueueWorker updatePerson rightsOnly kolu)
- HIK: CIH-03/06 (actions/hikDeviceImport, hikDeviceImport, lib/hikDeviceImport, lib/gateway/core, lib/gateway/persons, lib/logRedact, DevicePersonImportDialog)
- PRIV: ZIY-01/02, ALM-001/010/012, KIS-001 (lib/visitorStatus, visitors, alarms, Alarms.tsx, employees)
- E1: CIH-04/05 (lib/gatewayBackfill, lib/gateway/events, lib/gateway/devices, lib/gateway/isapiResult, lib/gateway/backfillState, devices.ts backfill kısmı, schema devices.hikBackfillPending)
- A1: PDK-001 (shiftPlans, lib/shiftPlan, DepartmentTargetPicker)

## Bakılacaklar (öncelik sırası)
1. Bulgu kapandı mı: bulgunun saldırı/hata senaryosunu yeni kodda izle. Yetki kontrolü doğru fonksiyonda mı, tüm giriş noktalarında mı (mutation + action + internal çağıranlar)? Proje izolasyonu (projectId) her okuma/yazmada korunuyor mu?
2. Yeni açık: okuma-gate'i ile yazma-gate'i eşleşmesi (sır alanı okunamıyorsa boş gönderim "temizle" anlamına gelmemeli), sır/şifre/yüz verisi log ya da denetim kaydına sızıyor mu, `internal*` yerine public fonksiyon açılmış mı.
3. Bağlayıcı kararlar: cihazdaki ngsplus dışı/yerel kişiler hiçbir otomatik akışla silinmez (IDE fazlalık söküm, Hik roster, cihazdan aktarım); hedefli iptal (pasif/ayrılma/kural kaldırma) sürmeli. Varsayılan cihazdan aktarım erişim VERMEZ. localBridge kurallı kapıda hedef değişikliği reddedilir.
4. Test beklentisi değişiklikleri: worker'ların değiştirdiği mevcut beklentiler (devicesMutations.characterization, roles.devices, roles.fix1, mobileAccess.handlers, deviceCenter, gatewayBackfill.*) — davranışı gizlemek için mi yoksa bulgu gereği mi değişti? Her birini tek tek değerlendir.
5. Convex kuralları: Node modülü içe aktaran dosyada `"use node"` (tsc/vitest yakalamaz; `node scripts/find-node-leak.mjs` temiz çıkıyor, yine de yeni import zincirlerine bak), index'siz `filter`, sınırsız `collect`, yeni poll/cron, `any`/`as any`, `!` assertion.
6. Eşzamanlılık/idempotency: kuyruk kolları (deleteFace, updatePerson rightsOnly), backfill cursor/state, roster bayrağı — tekrar çalışınca çift iş ya da kalıcı takılma var mı?

## Kapsam dışı / YASAK
- Kod değiştirme YOK (rapor dosyası hariç). `git add/commit/stash/checkout/restore/reset/push/switch/worktree` YOK.
- `npx convex *`, Netlify, Supabase MCP, canlı DB, cihaz/köprü bağlantısı, `npm install` YOK.
- Testleri koşabilirsin (`node_modules/.bin/vitest run <dosya>`, tsc, eslint) — salt okuma kanıtı için. Koordinatör tam kapıyı koştu: tsc 0/0, eslint 0 hata, vitest 494 dosya / 5402 test yeşil, find-node-leak temiz.

## Rapor biçimi (`docs/genel-audit-2026-11-03/DENETIM-DALGA1.md`, Türkçe)
- Üstte 2-3 cümle sonuç: kaç bulgu kapandı / kısmen / açık; yeni bulgu sayısı (önem: P0/P1/P2).
- Tablo 1: her bulgu ID → Kapandı / Kısmen / Açık → kanıt (dosya:satır).
- Tablo 2: yeni bulgular → önem, dosya:satır, somut senaryo (girdi/durum → yanlış sonuç), önerilen düzeltme (en küçük patch). Spekülatif olanları "Olası" diye ayır.
- Tablo 3: beklenti değişiklikleri → test:satır → Gerekçeli / Şüpheli.
- worker_done: ≤10 satır özet + rapor yolu; yalnız P0/P1 yeni bulguları satır satır yaz.

# C2b W-05-api — 05 Geçiş Kontrol backend (B4): cihaza gönderim çalıştırması + sonuç geçmişi
Önce `.claude/orca-specs/c2b-common.md` (→ c2-common.md) ve `convex/_generated/ai/guidelines.md` oku. Bağlam:
`docs/ui-scan/pages/05-gecis-kontrol/REPORT.md` ("Cihazlara gönder: dürüst kapsam ve sonuç", "Backend gereksinimi" 1-3).
Ürün kararı (PLAN.md Kararlar §5): "Cihazlara gönder" projede kayıtlı HER cihaza gider (Hikvision + IDE Smart); her hedef için
atlanan / başarısız / bekleyen / doğrulanan ayrımı; çalıştırma bazında kalıcı sonuç geçmişi.

## Hedef (test edilebilir)
Her gönderim (proje geneli yeniden gönderim VE tek kural kaydı sonrası gönderim) kalıcı bir "çalıştırma" kaydı üretir; frontend
`runId` ile hedef cihaz bazında dürüst durumu ve son çalıştırmaların listesini okuyabilir. `accessRules.getDetails` büyük kuralda
üyeleri sınırsız toplamaz (cursor'lı ayrı sorgu). Saf karar mantığı vitest ile kanıtlı.

## İş
1. **Mevcut yolları oku:** `convex/actions/hikvisionSync.ts` (`syncWeekPlanToDevices`, `backfillAllRulesToDevices` — bugün yalnız Hik),
   `convex/actions/ideGatewayDevice.ts` (`syncRuleToIdePanelsAndWait`, `triggerPanelSync`), `convex/hikvisionSync.ts` op kuyruğu,
   `convex/ideSync.ts` (`enqueueIdeOp`, `markAck`, `getOpStatuses`), `src/hooks/access-rules/useComplexAccessRuleMutations.ts` (yalnız oku).
2. **Şema (ask ile iste):** `deviceSyncRuns` (projectId, kind: "project_resync" | "rule_sync", ruleId?, startedBy userId, startedAt,
   finishedAt?, status: running|done|partial|failed, counts) + hedef satırları (gömülü dizi ≤ makul sınır VEYA ayrı
   `deviceSyncRunTargets` tablosu: runId, deviceId, brand, status: queued|sent|verified|failed|skipped|unknown, reason?, opRef?, updatedAt).
   Seçimini gerekçelendir; index'ler: `by_project_started`, `by_run`. Hik/IDE op tablolarına opsiyonel `runId` alanı gerekiyorsa onu da iste.
3. **Orkestrasyon:** yeni `authedAction` `deviceSyncRuns.startProjectResync({ projectId })` (admin yetkisi mevcut backfill ile aynı):
   projedeki tüm aktif cihazları listele → Hik cihazlara mevcut backfill/week-plan yolunu, IDE panellere mevcut kural/izin senkron
   yolunu çağır; desteklenmeyen/çevrimdışı/yapılandırması eksik cihaz = `skipped` + Türkçe sebep. Kural kaydı sonrası gönderim için
   `startRuleSync({ ruleId })` (aynı run kaydı, kind rule_sync). Mevcut action'ların davranışını bozma; gerekiyorsa run bağlamı için
   opsiyonel arg ekle. Eski `backfillAllRulesToDevices` çalışmaya devam eder (eski frontend).
4. **Durum dürüstlüğü:** Hik op `done` = `sent` (teslim kanıtı yok), IDE `acked` + `ackedAt` = `verified`, kuyrukta = `queued`,
   hata = `failed` + mesaj, sonuç gelmeyen = `unknown`. Run özeti hedeflerden türetilir; "tamamlandı" yalnız kalan queued yokken.
   Hedef durumunun güncellenmesi: op ack/fail noktalarında run satırını güncelle VEYA sorgu anında op durumlarından türet — basit ve
   OCC-güvenli olanı seç, raporla.
5. **Sorgular:** `deviceSyncRuns.listRecent({ projectId, limit? })` (≤20, yeni→eski, özet) · `deviceSyncRuns.get({ runId })`
   (hedefler + cihaz adı/markası; yetki = run'ın projesi kapsamda). Bounded okumalar.
6. **getDetails cursor:** `accessRules.getDetails` üyeleri `.collect()` ediyor (`convex/accessRules.ts:543-549`). Yeni
   `accessRules.listRuleMembers({ ruleId, paginationOpts })` (kişi + kapı/cihaz ayrı ya da `kind` arg'ı) ekle; getDetails'in mevcut
   dönüşünü KIRMA ama üye sayısını sınırla + `membersTruncated: boolean` ekle (opsiyonel alan). Düzenleme formu tüm üyeyi istiyorsa
   frontend cursor'la sayfalayacak — sözleşmeyi raporla.
7. Saf mantık `convex/lib/deviceSyncRun.ts` (+test): hedef durumu kararı, run özeti/status türetme, skipped sebepleri.

## Ownership
yeni convex/deviceSyncRuns.ts · yeni convex/lib/deviceSyncRun.ts (+test) · convex/accessRules.ts (yalnız madde 6 + gerekirse run bağlamı) ·
convex/actions/hikvisionSync.ts ve convex/actions/ideGatewayDevice.ts (yalnız opsiyonel run bağlamı/geri dönüş; davranış aynı) ·
convex/hikvisionSync.ts ve convex/ideSync.ts (yalnız run satırı güncelleme kancası, gerekiyorsa) · convex/_generated/api.d.ts (kendi satırların)

## Kapsam dışı
Frontend (src/**) · cardReadings.ts · visitors.ts · shifts.ts · employees.ts · schema.ts (ask) · Hik köprü/relay · fiziksel cihaz testi.

## Rapor
`.claude/orca-specs/reports/c2b-05-api.md`: tablo seçimi, tüm yeni fonksiyonların arg/dönüş tipi, durum enum'u + Türkçe etiket
("Kuyrukta", "Gönderildi · teslim kanıtı yok", "Cihazda doğrulandı", "Başarısız", "Atlandı", "Bilinmiyor"), skipped sebep listesi,
getDetails sınırı ve listRuleMembers sözleşmesi.

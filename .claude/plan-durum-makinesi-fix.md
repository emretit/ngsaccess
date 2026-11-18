# Plan — Örtük durum makinesi bulgularını düzeltme (2026-11-14)

Kaynak: `docs/audits/2026-11-14-implicit-state-machines/README.md`
Kararlar (Emre 2026-11-14):
- B-01: pasife alınan kişi için otomatik `deactivatedAt` yazılacak; geçmiş günler o tarihe kadar "çalışıyor" sayılacak.
- B-02: pasifleştirme ve işten çıkışta mobil oturumlar düşecek; kişi aktifleşince yeniden giriş yapacak.

## Checklist

### Dalga 1: kritik ve hızlı işler (~1,5 saat, paralel)
- [x] 1a · B-01 + B-02 personel pasiflik tarihi + oturum iptali (worker, Codex sol medium)
- [x] 1b · A-05 mobil kapı açma satırlarını terminal duruma geçirme + saklama temizliği (worker, Codex sol medium)
- [x] 1c · B-03 düzeltme kuyruğu sayfalaması (koordinatör kendisi, 1 dosya)
- [x] 1d · C-02 kural listesinde kişi bilgisini `employees.view` yetkisine bağlama (koordinatör kendisi, 1 dosya)
- [x] 1e · Denetim: Claude opus high diff'i okur; kapıları koordinatör kendisi koşar
- [x] 1f · Commit e67adf51 (2026-11-14, HEAD+Dalga1 export testi 5502/5502) · [ ] Convex yayını → Emre onayı

### Dalga 2: geç gelen sonucun yeni durumu ezmesi (~3 saat, tek worker)
- [x] 2a (worker ctx_d41745f02ee6, 2026-11-14) · A-03 + C-03 + A-04 deneme/nesil token'ı (Hik kuyruğu, IDE kuyruğu, toplu grant sonucu) (worker, Codex sol high)
- [x] 2b · Denetim: Claude opus high (3 tur, son LOW reconciliationScheduled begin'de sıfırlama düzeltildi; koordinatör 280/280 + tsc 0)
- [x] 2c · Commit + yayın (a0a77c65, CANLI 2026-11-17 14:51)

### Dalga 3: medium/low temizlik (~3 saat, 2 worker paralel)
- [x] 3a (worker ctx_c0bdecc22460, koordinatör testi yeşil) · C-05 saklama zincirinde proje bazlı adil bütçe + B-04/B-05 rapor teslim kaydı ve retry (worker, Codex sol medium)
- [x] 3b (worker ctx_a8a1a63587b1, koordinatör testi yeşil) · C-01 davet şifre yarışı + C-04 SMTP commit kapısı (worker, Codex sol medium)
- [x] 3c (worker ctx_1790110bff02, rapor `docs/audits/2026-11-14-implicit-state-machines/dalga3c-olu-degerler.md`; canlı sayım + daraltma ayrı onay) · Ölü değerler: A-07, A-08, B-06, B-07, C-07, C-08 belgele veya kaldır; A-06 için önce canlı veride status değerlerini say (salt okuma), sonra union'a daralt (ayrı onay)
- [x] 3d · Denetim (3a+3b: 2 tur, tüm medium/low düzeltildi) · [x] commit + yayın (a0a77c65, CANLI 2026-11-17)

### Kapsam dışı (ayrı proje)
- A-01/A-02 Windows köprüsünün yeniden yazımı: kalıcı disk kuyruğu + cihaz token'lı poll/ack. DS-K2804 açık riskiyle birlikte ele alınacak.

---

## Dalga 1 ayrıntı

### 1a · B-01 + B-02 (Codex `gpt-6.1-sol` medium, K2b)
Hedef: pasife alınan, ayrılış tarihi olmayan kişinin pasif tarihinden önceki PDKS günleri hesaplanır. Pasifleştirme/işten çıkış mobil oturumu düşürür.
Ownership:
- `convex/schema.ts`: yalnız `employees.deactivatedAt: v.optional(v.string())` (YYYY-MM-DD, TR günü). Yalnız genişletme; migration gerekmez.
- `convex/lib/employment.ts`: ziyaretçi değilse ve `employmentEndDate` yoksa: `isActive===false && deactivatedAt` → `dateKey <= deactivatedAt`. `deactivatedAt` yoksa (eski pasif) bugünkü davranış korunur.
- `convex/employees.ts` (update ~:388-420): `isActive` true→false geçişinde `deactivatedAt = trTodayKey()` + oturum iptali; false→true geçişinde `deactivatedAt` temizlenir.
- `convex/employeeTermination.ts`: `closeAccess` (:36) `deactivatedAt` + oturum iptali; transfer (:208) oturum iptali; `reinstate` (:105) ve transfer geri alma (:280) `deactivatedAt` temizler.
- `convex/lib/employeeAuth.ts`: `revokeEmployeeSessions(ctx, employeeId)` helper'ı, hash'e dokunmadan `passwordVersion + 1`. `writeEmployeePassword` (:50) ile aynı sürüm kuralını kullanır.
- Testler: `convex/lib/employment.test.ts` (yoksa oluştur), `convex/employeeAuth.employmentEnded.test.ts` veya yeni test dosyası.

Kabul:
- Ekimde okuması olan kişi kasımda pasif → ekim günü `notEmployed` DEĞİL.
- Eski pasif (deactivatedAt yok) → davranış aynı.
- Pasif sonra aktif → eski token `SESSION_REVOKED`.

Kapsam dışı: web formu (alan backend'de yazılır), ziyaretçiler.

### 1b · A-05 (Codex `gpt-6.1-sol` medium, K2b)
Hedef: her mobil kapı açma satırı sonunda confirmed/failed/unknown durumuna geçer ve saklama süresi dolunca silinir.
Ownership: `convex/mobileAccess.ts`, `convex/lib/mobileAccess.ts`, `convex/ideSync.ts` (yalnız ACK/timeout yollarında mobil satırı güncelleme), `convex/privacyRetention.ts` (yalnız `purgeMobileOperations` + eski pending/sent satırları terminal duruma geçirme), ilgili testler.
- IDE komutu acked → mobil satır `confirmed`; failed → mevcut türetme kuralıyla `failed`/`unknown`. Aynı mutation içinde, idempotent.
- `expireQueue`: komut `sent`/`acked` ise de satırı türetilmiş sonuca göre terminal duruma geçirir.
- Temizlik: TTL'i geçmiş pending/sent satırlar önce terminal duruma geçer, sonra normal saklama ile silinir.
Kapsam dışı: `hikvisionSync.ts` (Dalga 2'nin dosyası; Hik tarafı okuma anında türetiliyor, A-05'in Hik ayağı Dalga 2'de ACK ile birlikte yazılır).

### 1c · B-03 (koordinatör)
`convex/attendanceCorrections.ts:66-82`: tek proje varsa `by_project_status` üzerinde gerçek `.paginate()`. Çoklu projede proje başına cursor'ı JSON olarak cursor içinde taşı ya da `hasMore` olduğunda `isDone=true` + uyarı ver. Tüketen web sayfasını kontrol et.

### 1d · C-02 (koordinatör)
`convex/lib/accessRuleRead.ts:24-36`: `employees.view` yetkisi yoksa `employees` alanı yalnız `{ id }` döner (ad/soyad/e-posta yok). Web'de kural üye listesinin bu durumda boş görünmediğini kontrol et.

### 1e · Kapılar (koordinatör kendisi koşar)
```
node_modules/.bin/tsc --noEmit -p tsconfig.app.json
node_modules/.bin/eslint src convex
npx vitest run            # tam vitest (yalnız convex yetmez)
node scripts/find-node-leak.mjs
```
Denetçi: Claude `opus` high. Diff'i ve kapı çıktısını okur, salt okuma çalışır.

## Worker spec ortak kuralları
- `--worktree current`. Yeni worktree açılmaz.
- Commit, push, deploy, migration, DB yazımı, `git add/commit/stash/checkout/reset` YASAK. Çalışma ağacında başka oturumun değişiklikleri var, onlara dokunulmaz.
- Rapor `worker_done`'da ≤10 satır, file:line ile verilir. Bitince koordinatör reflog'a bakar (commit atılmadığından emin olmak için).
- Kota: başlatmadan önce `python3 ~/.claude/scripts/agent-quota.py`. Codex ≥%90 ise Claude sonnet medium kullanılır.


## Worker'lar (run_f13c4842fa11, 2026-11-14)
Spec'ler: `.claude/orca-specs/dm-dalga2.md`, `dm-dalga3a.md`, `dm-dalga3b.md`, `dm-dalga3c.md` (ortak kurallar `dm-ortak.md`). Reflog başlangıcı `dm-reflog-baseline.txt`.

Şema eklemeleri (koordinatör): `reportDeliveries` tablosu, `projectPrivacySettings.visitorRetention*` (4 alan + index), `invites.claimToken/claimUserId/claimExpiresAt`. Hepsi opsiyonel/yeni, migration yok.

Denetim sonuçları (2026-11-14 21:2x): Dalga 2 → 2 high + 1 medium + 2 low (rapor /private/tmp/claude-501/-Users-emreaydin-ngsaccess/f873855e-a722-4def-a579-5548e6ab6ec5/scratchpad/report.md), düzeltmeye gönderildi; Dalga 3a+3b → 4 low (3 düzeltmede, mailSettings super_admin pasif proje engeli Emre kararı).
Low düzeltmeleri: 3b INVITE_CLAIM_EXPIRED + UserSetup mesajı; 3a kuyruk anahtarı + purgeReportDeliveries cron (01:05) + by_lastAttemptAt index. Koordinatör testi 187/187. Tam vitest (regresyon sonrası) 5733/5733.
Dalga 2 denetim 3. tur: A/B/C kapandı, yeni HIGH/MEDIUM yok; reconciliationScheduled begin'de sıfırlama LOW düzeltmesi gönderildi. Tam vitest 5749/5749, tsc 0 (2026-11-14 ~21:50).

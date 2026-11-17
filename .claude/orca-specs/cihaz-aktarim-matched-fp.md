# Görev: Biyometri varsayılan açık + kayıtlı kişiye parmak izi aktarımı

Repo: /Users/emreaydin/ngsaccess (Convex + React, TS strict). Ana dizinde çalış, worktree AÇMA. Convex işinden önce `convex/_generated/ai/guidelines.md` oku.
Bağlam: `.claude/plan-cihazdan-veri-cek.md` + önceki spec'ler `.claude/orca-specs/cihaz-aktarim-*.md` (bu kodu sen yazdın).

## Hedef (test edilebilir)
(A) Yeni projeler biyometri AÇIK oluşur. (C) "Cihazdan kişileri çek" ile zaten kayıtlı (matched) ANKA kişileri seçilip rıza ile aktarılınca
cihazdaki parmak izi şablonları FP-Central'a (employeeFingerprints, şifreli) yazılır; biyometri kapalı projede önizleme uyarır — vitest ile kanıtlı.

## İş
- [ ] A. Biyometri VARSAYILAN AÇIK (Emre: "her firmada açık olsun, isterse firma kapatır"): yeni proje satırı `biometricEnabled: false`
      yazan 3 yer → `true`: `convex/projects.ts:77-79`, `convex/onboarding.ts:56-58` ve `:141-143` (audit newValue'ları da). `lib/privacySettings.ts:13`
      yorumunu güncelle. İlgili testleri düzelt. (Mevcut projelerin satırlarına DOKUNMA; ANKA'yı Emre açar.)
- [x] B. (YAPILDI, Emre 18:11 — senin işin değil) ANKA biyometriği: CLI `--identity` artık çalışmıyor (sahte oturum reddediliyor) → Emre arayüzden: Ayarlar → Gizlilik →
      "Biyometri modülü" (BiometricModuleCard, `privacyBiometric.setBiometricModule`, admin.manage). ANKA satırı şu an false, changedBy yok.
- [ ] C. KAYITLI (matched) kişiye parmak izi aktarma — Emre "tekrar kişileri aktar" diyecek; ŞU AN matched satır hiçbir şey yapmaz:
      - `convex/hikDeviceImport.ts` `classifyPersons`: matched satıra `storedFingerCount` (employeeFingerprints by_employee sayısı) ekle;
        `ImportRow` tipine opsiyonel alan (`convex/lib/hikDeviceImport.ts`).
      - `convex/actions/hikDeviceImport.ts` `runImportDevicePersons`: `created.row.status==="matched" && matchedEmployeeId && transferFingers`
        → yeni internalMutation `recordImportConsent` (aktif biometric_fingerprint rızası yoksa ekle; proje/cardNumber==employeeNo kontrolü)
        → aynı şablon döngüsü (recordSource + upsertEncrypted) → `syncEmployeeToDevicesInternal`. Sayaç: fingerprintsStored/consentsRecorded.
        Önizlemede `biometricEnabled` da dön (`internal.hikDeviceImport.biometricEnabled`).
      - UI `src/components/employees/import/devicePersonImportView.ts`: seçilebilir = `new` VEYA (`matched` && fingerCount > storedFingerCount);
        rozet "Zaten kayıtlı" + alt metin "Parmak izi ngsplus'a aktarılacak"; `importResultText` created=0 ama fingerprintsStored>0 → "N parmak izi kaydedildi".
        `DevicePersonImportDialog.tsx`: önizleme `biometricEnabled=false` ise rıza kutusu yerine uyarı "Bu projede biyometri modülü kapalı; parmak izleri aktarılmaz (Ayarlar → Gizlilik)".
      - Testler: actions/hikDeviceImport.test.ts (matched + consent → şablon saklanır, ikinci kez idempotent), dialog/view testleri.
      - Kapılar + Convex `dev --once` + web yayını (temiz export). Emre yayını onaylamış durumda değil → sor.

## Kurallar / YASAKLAR
- `any`/`as any` yok; `!` yerine erken return; Node modülü içe aktaran convex dosyası `"use node";`; yeni convex modülü eklersen api.d.ts'yi ELLE güncelle.
- Şablon (fingerData) action dışına dönmez, loglanmaz. Cihazdan HİÇBİR şey silinmez.
- `git add/commit/stash/reset/checkout/restore/push` YOK. `npx convex …` YOK. Canlı DB/gateway/ssh YOK. package.json YOK.
- Başka oturumun commit'lenmemiş dosyaları (`git status`'ta gördüğün src/components/** tablo/pdks değişiklikleri, `src/pages/Employees.tsx`) — DOKUNMA.
- Ownership: convex/projects.ts, convex/onboarding.ts, convex/lib/privacySettings.ts, convex/hikDeviceImport.ts, convex/lib/hikDeviceImport.ts,
  convex/actions/hikDeviceImport.ts, convex/_generated/api.d.ts, src/components/employees/import/devicePersonImportView.ts,
  src/components/employees/import/DevicePersonImportDialog.tsx + bunların testleri (+ A'nın kırdığı mevcut proje/onboarding testleri).

## Kapılar
```
node_modules/.bin/tsc --noEmit -p tsconfig.app.json
node_modules/.bin/tsc --noEmit -p convex/tsconfig.json
node_modules/.bin/eslint src convex
node scripts/find-node-leak.mjs
node_modules/.bin/vitest run --testTimeout=30000
```
## Rapor (worker_done ≤10 satır): değişen dosyalar file:line, kapı sonuçları, açık risk; `--files-modified` tam liste.

# Denetim spec — Dalga 3c ölü değerler (SALT OKUMA)

Hedef: Codex worker'ın yaptığı Dalga 3c değişikliğinde canlıyı bozacak hata var mı? 0 bulgu ya da dosya:satır + somut senaryo.

Bağlam: rapor `docs/audits/2026-11-14-implicit-state-machines/dalga3c-olu-degerler.md`. Canlı sayım 2026-11-18: doors 17/17 status=active, readers 17/17 active, accessTransfers 0 satır, leaveBalances 0, chatConversations 0.

İncelenecek diff (yalnız bu dosyalar; `git diff -- <dosya>`):
convex/schema.ts, convex/doors.ts, convex/readers.ts, convex/hikBridge.ts, convex/lib/adminGuards.ts, convex/lib/transferGuard.ts, convex/projects.ts, src/components/employees/lib/employment.ts, convex/adminSettingsGuards.test.ts, convex/doorRenameReaders.test.ts, convex/orphanGuards.test.ts.
`src/components/shifts/**` başka işin, İNCELEME.

Bak:
1. doors/readers `status` daraltması: web formları, köprü/HTTP route'ları, provizyon/import yolları (ISAPI/IDE/cihazdan çekme) bu alana `active|inactive` dışında değer yazıyor mu? `db.insert/patch` dahil grep et.
2. Kaldırılan tablolar (leaveBalances, chatConversations) için kalan referans (src dahil, `api.` / `internal.` / tablo adı string'i), proje silme/temizlik zincirinde kırılma.
3. accessTransfers `requested`/`ide_panel` çıkarılması: oluşturma yolu ilk status olarak ne yazıyor; UI/etiket sözlüklerinde (auditLabels vb.) kalan başvuru.
4. Schema yorumları rapordaki anlamla çelişiyor mu.

Kapı: `node_modules/.bin/tsc --noEmit -p tsconfig.app.json` kendin koş.
YASAK: dosya düzenleme, git yazma, deploy, `npx convex run`, tam vitest.
Rapor: worker_done ≤10 satır, bulgu başına önem (high/medium/low) + dosya:satır + senaryo.

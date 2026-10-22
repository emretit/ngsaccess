# W6-1 — Denetim kaydı Excel + vardiya toplu temizle/dışa aktar (UYGULAMA)

Çalışma dizini: `/Users/emreaydin/orca/workspaces/ngsaccess/w6-audit-shifts` (dal `emretit/w6-audit-shifts`, taban `5d36adb`; `node_modules` ana repoya symlink — DOKUNMA). Arka plan: Hik-Connect kıyası `/Users/emreaydin/ngsaccess/docs/hikconnect-audit/KIYAS.md` satır 34 (Schedule: Export, Clear) ve 79 (Operation Log: dışa aktarma yok).

## Hedef (test edilebilir)
(1) `/audit-log`'da mevcut filtrelerle görünen kayıtlar "Excel'e aktar" ile .xlsx olarak inebilir. (2) `/shifts`'te seçili çalışanlar + tarih aralığı için atamalar önizlemeli "Toplu temizle" ile kaldırılabilir ve görünen dönem kişi×gün ızgarası olarak .xlsx/.csv dışa aktarılabilir.

## 1. Denetim kaydı Excel
- Yer: `src/pages/AuditLog.tsx`, `src/components/audit/**` (+ gerekirse `src/lib/` altında küçük yardımcı).
- Mevcut `api.auditLog.list` (paginated, `convex/auditLog.ts:77`) ile istemci tarafında sayfa sayfa çek (ör. 500'lük sayfa), aynı `auditArgs` filtreleri. Üst sınır 10.000 satır; aşılırsa indirmeden önce Türkçe uyarı ("İlk 10.000 kayıt aktarılacak; tarih aralığını daraltın") + kullanıcı onayı. İptal edilebilir ilerleme göstergesi ("1.500 / ~?").
- Kolonlar: Zaman (İstanbul, `dd.MM.yyyy HH:mm:ss`), Kullanıcı, Proje, Tablo (mevcut `auditLabels` Türkçe etiketiyle), İşlem (Oluşturma/Güncelleme/Silme), Kayıt, Özet/Değişiklik (mevcut detay metninden kısa düz metin). Hücreler `src/lib/spreadsheetSafety.ts` ile formül-nötr.
- `exceljs` dinamik import (ana bundle'a girmesin). Dosya adı: `denetim-kaydi-<proje|tum-projeler>-<başlangıç>_<bitiş>.xlsx`.
- Yalnız mevcut yetki (`capabilities(...).auditLog`) — backend değişikliği YOK.

## 2. Vardiya toplu temizle
- Backend `convex/shifts.ts`: `previewClearAssignments` (authedQuery) + `clearAssignments` (authedMutation); args: `projectId`, `employeeIds` (≤500), `startDate`, `endDate` (YYYY-MM-DD, aralık ≤ 366 gün).
- Kurallar: yetki/proje kontrolü ve tarih kuralları `bulkAssignShift`/`removeAssignment` ile AYNI (yeni bir gevşetme yok; mevcut kod geçmiş tarihi engelliyorsa burada da engelle, engellemiyorsa önizlemede "geçmiş günlerin PDKS hesabı değişir" uyarısı göster). Aralıkla kesişen atama: tamamen içerideyse sil; bir uçtan taşıyorsa kırp; aralığı iki yandan kapsıyorsa ikiye böl. Mevcut overlap/bölme yardımcısı varsa (bulkAssign) onu yeniden kullan. Önizleme: silinecek/kırpılacak/bölünecek sayıları + etkilenen çalışan sayısı; mutation aynı hesabı tekrar yapar (önizlemeye güvenmez). Tek mutation'da yazma sınırı: etkilenen atama > 1000 ise Türkçe hata ("aralığı daraltın").
- Denetim kaydı: mevcut atama silme/güncelleme yollarının yazdığı auditLog'u aynı biçimde yaz (toplu işlem tek özet kaydı + gerekirse satır başı — mevcut desen neyse).
- Cihaz/PDKS yan etkisi: atama silme mevcut kodda bir senkron/yeniden hesap tetikliyorsa aynısını yap; yoksa ekleme. Yeni cron/polling YOK.
- UI `src/components/shifts/**`: takvim görünümünde "Toplu temizle" (yönetici rolleri; mevcut atama düzenleme yetki koşulu) → diyalog: çalışan seçimi (mevcut seçici/filtre yeniden kullan), tarih aralığı, önizleme özeti, onay. Türkçe metin.

## 3. Vardiya dışa aktar
- UI: görünen dönem (takvimin mevcut aralığı + mevcut filtre) için kişi×gün ızgara: satır = çalışan (ad, sicil varsa), kolon = gün (`dd.MM ddd`), hücre = vardiya adı + saat (esnekse "Esnek · 8 sa" — `convex/lib/shiftUx.ts` `shiftTimeLabel` ile tutarlı), boş = "—". .xlsx (exceljs dinamik) ve .csv. Formül-nötr. Veri: ekranda zaten yüklü `listAssignments`/tanımlar; ek backend gerekmiyorsa ekleme.

## Ortak kurallar
- TypeScript strict; `any`/`as any`/`!`/`filter(Boolean)` YASAK. Convex: sınırsız yeni `.collect()` yok, yeni cron/polling yok, `take` sınırları + Türkçe hata. `convex/_generated/ai/guidelines.md` oku.
- Ownership: `src/pages/AuditLog.tsx`, `src/components/audit/**`, `src/pages/Shifts.tsx`, `src/components/shifts/**`, `convex/shifts.ts`, yeni `src/lib/*Export*.ts` yardımcıları, bunların testleri, `convex/_generated/api.d.ts` (yalnız yeni modül satırı gerekirse).
- YASAK: `convex/schema.ts` (gerekirse DUR, sor), `src/components/devices/**`, `src/components/access-control/**`, `convex/devices.ts`, `convex/doors.ts`, `convex/actions/**` (diğer W6 worker'larının alanı), commit, push, deploy, `npx convex *`, DB yazma, `git add/stash/checkout/reset/commit`.

## Testler
- Audit: sayfalama döngüsü (çoklu sayfa birleşir, 10.000 sınırı uyarısı, iptal), kolon/etiket/TR saat, formül nötrleme.
- Shifts clear: convex-test ile içeride/sol uç/sağ uç/iki yandan kapsayan atama (sil/kırp/böl), başka proje çalışanı reddi, project_user reddi, >1000 hata, önizleme == mutation sonucu, audit kaydı.
- Export: ızgara içeriği (sabit/esnek/boş), CSV ayracı + nötrleme.

## Kapılar (kendin koş)
`node_modules/.bin/tsc --noEmit -p tsconfig.app.json` → 0 · `node_modules/.bin/tsc --noEmit -p convex/tsconfig.json` → 0 · `node_modules/.bin/eslint src convex` → 0 · `node_modules/.bin/vitest run` → tamamı yeşil (sayı) · `node_modules/.bin/vite build` → OK · `git diff --check` temiz.

## Rapor
`/tmp/w6-1-report.md`: madde başına file:line + test adı, değişen dosyalar, UI'da nereden erişilir. `worker_done`'da ≤10 satır.

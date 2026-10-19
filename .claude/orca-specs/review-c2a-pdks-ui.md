# Görev: Faz C2a 08 PDKS Kayıtları frontend denetimi (SALT-OKUMA)
Repo: /Users/emreaydin/ngsaccess. Codex yazdı (spec `.claude/orca-specs/c2a-pdks-ui.md` + `c2-common.md`; backend sözleşmesi
`.claude/orca-specs/reports/c2a-pdks-api.md`). Hedef `docs/ui-scan/pages/08-pdks-kayitlari/{REPORT.md,mockup.html}`, tasarım dili
`docs/ui-scan/DESIGN_DIRECTION.md`. Bağımsız denetçisin; DİFF'i oku: `git diff -- src/pages/PDKSRecords.tsx src/components/pdks src/hooks/usePdks* src/lib/pdks* src/utils/pdksExport.ts`
+ `git status --short src` (yeni dosyalar). Paralelde bir Codex backend düzeltme worker'ı convex/pdksRecords.ts bulkUpsertManual'a zorunlu batch `note`
ekliyor (PDKSImportDialog henüz uyarlanmadı — bunu bulgu olarak yaz ama kritik sayma). Canlı backend henüz eski olduğundan gerçek oturum ekranı YOK.
## Özellikle bak
1. Tüm PDKS sorguları başlıktaki projectId'yi geçiyor mu (getPdksTableData, detail, monthly payroll, APHB, dashboard uyarıları); proje değişiminde
   detay/form/seçim sıfırlanıyor mu.
2. Gün durumu: future → "Henüz gelmedi", noData → "Veri yok", sayaçlardan dışlanıyor mu; gelecekten devamsızlık türetiliyor mu; statusMeta tek kaynak +
   A2 semantik token; biyometrik kaynak rozeti/filtresi/sütunu EKLENMEMİŞ mi.
3. Manuel form: gerekçe zorunlu (3–500, backend ile aynı), iki boş saat reddi, alan altı hata, pending kilit, sunucu hatası formda kalır, dirty guard;
   UX-0 editDate güvenliği (yanlış güne yazma engeli) korunmuş mu.
4. Puantaj erişilebilirliği: hücre button + tam aria-label + Enter/Space; sıralama aria-sort; sticky sütun; 390'da belge yatay kaymıyor (yalnız puantaj kabı).
5. Dışa aktarma: önizleme kapsamı doğru mu; APHB uyarıları indirmeden önce; pdksExport fonksiyon davranışı korunmuş mu; seçim kapsamı.
6. Hata/yükleniyor: gerçek query hata sınırı (sabit error:null kalktı mı), iskelet sırasında 0 sayaç yok.
7. CLAUDE.md: any/as any, `!`, FunctionReturnType, sabit renk/emoji/gradyan/kart-içinde-kart, useToast.
## Kapı (kendin koş)
node_modules/.bin/tsc --noEmit -p tsconfig.app.json · node_modules/.bin/eslint src · npx vitest run · npx vite build
## YASAK
Dosya düzenleme yok. commit/push/deploy/DB YOK. Uygulamaya giriş yapma.
## worker_done (≤12 satır)
Bulgular önem sırasıyla, file:line + 1 cümle + düzeltme önerisi. Kapı sonuçları. "Canlıya hazır mı: evet/hayır".

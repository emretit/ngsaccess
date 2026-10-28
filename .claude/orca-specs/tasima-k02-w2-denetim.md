# DENETİM — K-02 W2 UI ("Başka projeye taşı" sihirbazı + devir durumu)
ÖNCE `/Users/emreaydin/ngsaccess/.claude/orca-specs/fix-denetim-ortak.md` OKU. Fix spec: `.claude/orca-specs/tasima-k02-w2-ui.md`. Worker raporu:
`/tmp/tasima-k02-w2-rapor.md`. Backend sözleşmesi: `/tmp/tasima-k02-w1-rapor.md`. Rapor: `/tmp/tasima-k02-w2-denetim.md`.
Dosyalar (`git diff HEAD -- <dosya>`; yeni dosyaları tam oku): src/components/employees/EmployeeDetails.tsx src/components/employees/EmployeeEmploymentActions.tsx
src/components/employees/EmployeeTransferDialog.tsx(YENİ) src/components/employees/EmployeeTransferStatus.tsx(YENİ) src/components/employees/lib/employment.ts
src/components/employees/EmployeeTransferDialog.test.tsx(YENİ) src/components/employees/EmployeeTransferStatus.test.tsx(YENİ)
src/components/employees/EmployeeDetails.test.tsx src/components/employees/EmployeesPage.test.tsx src/pages/Employees.tsx.
Koordinatör sonradan 3 satır değiştirdi (denetle): preflight yalnız 3. adımda abone · `isTransferActive` requested/provisioning dahil · iptal metnine parmak izi + mobil şifre.
DİKKAT: aynı ağaçta backend fix1 worker'ı convex/** yazıyor (preflight'a `TRANSFER_DEVICE_BUSY` reason'ı ekleniyor) — convex'i DENETLEME.
Başka oturum mail/PDKS/rapor WIP'i var — dokunma.

Özel dikkat:
1. Yanlış/eksik bilgiyle geri dönüşü zor işlem: onay ekranı etkileri doğru ve tam mı; preflight engeli varken ya da yüklenirken "Taşı" gerçekten pasif mi;
   çift gönderim; hata sonrası durum. A tarafında "Geri al" (reinstate) hiçbir yoldan görünmüyor mu.
2. Yetki: hedef proje listesi yalnız `employees.manage` olan projeler mi; kural seçimi `accessRules.manage` yoksa gizli mi; retry/cancel düğmeleri
   backend'in `canRetry/canCancel` alanına mı bağlı (istemci kendi karar vermiyor mu).
3. `Employees.tsx` deep link: yanlış projede / bulunamayan kayıtta sessiz kalıyor mu, state temizleniyor mu (geri/yenile tekrar açmıyor),
   başka kişinin drawer'ını açtırma (state'e dışarıdan id) yetki dışı veri göstermiyor mu (veri zaten proje kapsamlı sorgudan mı geliyor).
4. Durum ekranı: TR saati (UTC+3), rozet metinleri, superseded açıklaması, dar ekran (`max-sm:min-h-11`), erişilebilirlik (aria-live, label).
5. CLAUDE.md: `any`/`as any` yok, `!` yok, Convex sonucu `any[]`'a açılmıyor (`FunctionReturnType`); gereksiz sorgu/abonelik (Free kota).

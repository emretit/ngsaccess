# Personel drawer düzeltmeleri denetimi (SALT-OKUMA)

Sen denetçisin. Hiçbir repo dosyasına YAZMA (yalnız rapor dosyan). YASAK: commit, push, deploy, `npx convex *`, DB yazma, git stash/checkout/reset. Localhost:8081 canlı veriye bağlı: tarayıcıya bakarsan Kaydet/Sil/İşten çıkar/rıza/parmak izi gibi yazan hiçbir butona BASMA (Orca: `orca tab create --url http://localhost:8081/employees --json`, her komutta `--page <id>`, bitince `orca tab close --page <id>`).

## Girdi
- Değişiklik: `git -C /Users/emreaydin/ngsaccess diff eb677f9 -- src` + yeni dosyalar (`git status --short -- src`). Taban main `eb677f9`. `mobile/**`, `convex/**` inceleme dışı.
- Üç katman, hepsi bu diff'te karışık:
  1. **Kompakt tek drawer** (Claude yazdı): ekle/düzenle tek `SlideOverPanel`; yöneticide `EmployeeDetails` içinde `EmployeeForm embedded` yerinde düzenleme; Kaydet/geri al çubuğu yalnız dirty iken; tablo menüsü tek madde.
  2. **Dalga A** (Claude yazdı): `docs/ui-audit-employee-drawer/RAPOR.md` #1 drawer içi gezinme koruması (`installNavigationGuard`), #2 düzenlemede ilk odak başlık, #5 "Değişiklikleri geri al" + Ad'a odak, #6/#15 ipuçları + aria, #11 "(N dolu)", #13/#14 çift başlık/fotoğraf, #18 yazım.
  3. **Dalga B** (Codex yazdı): spec `.claude/orca-specs/employee-drawer-fix-b.md` — #7 üyelikler formda, #8 "Ayrıntılara devam et", #4 silinmiş kayıt, #10 eşzamanlı güncelleme (useEmployeeFormData imza + draft ref), #12 yerel hata sınırları, #3 mobil 44 px, #16, #17.

## Odak
{FOCUS}

## Her durumda bak
- Kaydedilmemiş taslak kaybı: kapat/Esc/dış tık, proje değişimi, drawer içi bağlantı, tarayıcı geri, kayıt sonrası remount, hata sınırı sonrası yeniden dene.
- Yetki: project_user salt-okunur görünümde düzenleme formu/İşten çıkar/parmak izi/rıza yazma görünmüyor.
- Gönderilen payload: düzenlemede Kaydet eskisiyle aynı alanları aynı biçimde yolluyor mu (ücret null, accessRuleId yalnız ek kural, photoStorageId); eşzamanlı güncellemede başkasının değişikliğini ezme.
- Döngü/performans: effect bağımlılıkları sonsuz render ya da her tuşta pahalı iş (JSON.stringify büyük listeler) üretiyor mu.

## Kapılar (kendin koş, sayıyla yaz)
`node_modules/.bin/tsc --noEmit -p tsconfig.app.json` · `node_modules/.bin/eslint src convex` · `node_modules/.bin/vitest run src/components/employees src/pages src/lib`

## Rapor
`{REPORT}`: P1 (yanlış davranış/veri kaybı/yetki/regresyon) / P2 (kenar durum) / P3 (stil) — file:line + somut senaryo + öneri. `worker_done` ≤10 satır: P1/P2/P3 sayıları, en kritik 3 (file:line), kapı sayıları.

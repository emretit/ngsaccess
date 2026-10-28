# Görev: Kişi aktarımını Kişiler sayfasına taşı (açılır menü)

Repo: /Users/emreaydin/ngsaccess (React + Vite + Convex, TypeScript strict, Tailwind, shadcn/ui). Ana dizinde çalış, worktree AÇMA.
Önceki iş: `.claude/orca-specs/cihaz-aktarim-ui.md` (bunu sen yazdın). Backend HAZIR, değişmez.

## Hedef (test edilebilir)
Kişiler sayfasındaki "Personel ekle" düğmesi Cihazlar sayfasındaki gibi açılır menü olur: "Yeni kişi ekle" (mevcut form) ve
"Cihazdan kişileri çek" (cihaz seç → önizle → seç → rıza → aktar diyaloğu). Cihaz İşlemler sekmesinde YALNIZ "Geçmiş kayıtları çek" kalır.

## Proje kuralları
- `any` / `as any` YASAK. Convex sonuçları `FunctionReturnType<typeof api.X.Y>`. `!` yerine optional chaining + erken return.
- Kullanıcı metni Türkçe, sade. Mobil 390px'te taşma yok, düğmeler mobilde `min-h-11`.
- Yeni test bağımlılığı EKLEME (Testing Library/jsdom yok): saf fonksiyon birim testi + `renderToStaticMarkup` (mevcut desenler).

## YASAKLAR
- `git add/commit/stash/reset/checkout/restore/push` YOK. `npx convex …` YOK. `convex/**` yazma YOK. package.json/lock YOK.
- **`src/pages/Employees.tsx` başka oturum tarafından düzenleniyor (commit'lenmemiş tablo değişiklikleri).** Bu dosyada YALNIZ
  `<PageHeader … primaryAction={…} />` bloğunu değiştir (≈satır 166-173): `primaryAction` kaldır, yerine
  `{canManage && <EmployeeAddMenu onAddNew={() => open(null)} />}` children olarak. Dosyanın başka hiçbir satırına (import satırı hariç) dokunma,
  biçimlendirici (prettier) ÇALIŞTIRMA. Diğer oturumun dosyaları: `src/components/employees/EmployeeTable*`, `EmployeesPage.test.tsx`,
  `EngineeringDepartmentView*`, `src/components/devices/DeviceList*`, `src/components/shared/TableStateRow*`, `src/components/pdks/**` — DOKUNMA.

## Ownership
- YENİ: `src/components/employees/EmployeeAddMenu.tsx` (+ `.test.tsx`),
  `src/components/employees/import/DevicePersonImportDialog.tsx` (+ `.test.tsx`),
  `src/components/employees/import/devicePersonImportView.ts` (kişi seçimi saf yardımcıları; `src/components/devices/deviceImportView.ts`'den TAŞI).
- DEĞİŞİR: `src/components/devices/DeviceImportCard.tsx` → yalnız geçmiş kayıtlar (dosyayı `DeviceHistoryImportCard.tsx` olarak yeniden adlandır;
  untracked, `mv` serbest), `src/components/devices/deviceImportView.ts` (yalnız geçmiş yardımcıları kalır), `DeviceImportCard.test.tsx` → `DeviceHistoryImportCard.test.tsx`,
  `src/components/devices/DeviceCommandCenter.tsx` (import adı), `src/pages/Employees.tsx` (yalnız yukarıdaki blok).

## 1. `EmployeeAddMenu`
- `DeviceAddMenu.tsx` desenini kopyala (DropdownMenu + `PageHeaderPrimaryButton`, Plus + ChevronDown). Tetik etiketi **"Personel ekle"** (mevcut testler bu metni arar).
- Seçenek 1: "Yeni kişi ekle" — alt metin "Formla tek kişi oluştur" → `onAddNew`.
- Seçenek 2: "Cihazdan kişileri çek" — alt metin "Hikvision cihazındaki kişileri aktar" → `DevicePersonImportDialog`'u açar (menü kendi state'ini tutar).
  Yalnız `can("devices.manage") && can("employees.manage")` VE aktif projede uygun cihaz (aşağıda) varsa görünür; yoksa menü yine açılır, tek seçenek.

## 2. `DevicePersonImportDialog` (props: `open`, `onOpenChange`)
- Cihaz listesi: `useQuery(api.devices.list, { projectId })` (`useActiveProjectScope`), uygun = `brand === "hikvision" && hikTransport === "gateway" && hikDevIndex`.
  Bağlantı: `deviceConnection(device, now)` (`@/lib/deviceStatus`, `useNow(15_000)`).
- Üstte cihaz seçici (`ui/native-select` veya `ui/select`): "Cihaz"; tek uygun cihaz varsa otomatik seçili. Çevrimdışı cihaz seçilebilir ama
  "Cihaz çevrimdışı — aktarım yapılamaz" + düğmeler pasif. Cihaz değişince önizleme/seçim/sonuç sıfırlanır.
- Gövde: mevcut `DeviceImportCard` "A. Kişileri aktar" bölümünün AYNISI (önizle düğmesi "Cihazdaki kişileri göster", yükleniyor metni, özet,
  tablo + rozetler + yalnız `new` seçilebilir + ListSelectAll + satır tıklama, rıza kutusu/biometrics.manage notu, "Seçilenleri aktar (n)" + ConfirmAction,
  sonuç metni + otomatik yeniden önizleme). Mantığı kopyalama: bölümü bu diyaloğa TAŞI, `DeviceImportCard`'dan sil.
- Diyalog: `ui/dialog` geniş (`sm:max-w-3xl`), içerik kaydırılabilir (`max-h-[85vh] overflow-y-auto`). İşlem sürerken (önizleme/aktarım) dışarı tıklama/Esc
  diyaloğu KAPATMAZ (`onOpenChange` pending iken yok sayılır). Başlık "Cihazdan kişileri çek", açıklama "Seçtiğiniz kişiler ngsplus'a eklenir; cihazdaki kişiler silinmez."
- Aktarım başarılıysa kişi listesi Convex reaktif olduğu için kendiliğinden güncellenir; ek refetch gerekmez.

## 3. Cihaz İşlemler sekmesi
- `DeviceHistoryImportCard`: başlık "Geçmiş kayıtları çek" (ikon `History` veya `Download`), içerik mevcut "B. Geçmiş kayıtları çek" bölümü aynen
  (kapsam ToggleGroup, tarih, Tümü onayı, sonuç, partial mesajı). Görünürlük: hikvision + gateway + hikDevIndex + `devices.manage`.
- Kartın altına tek satır yönlendirme: "Kişileri aktarmak için: Kişiler → Personel ekle → Cihazdan kişileri çek" (yalnız `employees.manage` varsa).

## Testler
- `devicePersonImportView.test.ts`: taşınan yardımcılar (seçilebilirlik, varsayılan seçim, select-all indeterminate, rıza görünürlüğü,
  import args, sonuç metni) — önceki `DeviceImportCard.test.tsx` vakalarını buraya taşı.
- `EmployeeAddMenu.test.tsx` (SSR): uygun cihaz + iki yetki → iki seçenek metni; yetki yok veya uygun cihaz yok → "Cihazdan kişileri çek" yok; tetik "Personel ekle".
  (DropdownMenu içeriği SSR'da kapalıysa: menü öğelerini saf `employeeAddOptions({canDeviceImport})` fonksiyonuyla üret ve onu test et.)
- `DevicePersonImportDialog.test.tsx` (SSR, `open: true`): tek cihaz otomatik seçili; çevrimdışı → pasif + uyarı; uygun cihaz yok → "Bu projede kişi
  çekilebilecek Hikvision cihazı yok."
- `DeviceHistoryImportCard.test.tsx`: önceki geçmiş vakaları (Tümü → `fromAll: true`, tarih → `+03:00`, partial mesajı, çevrimdışı pasif) + kişi bölümü YOK.

## Kapılar
```
node_modules/.bin/tsc --noEmit -p tsconfig.app.json
node_modules/.bin/eslint src convex
node_modules/.bin/vitest run src/components/devices src/components/employees src/components/shared
node_modules/.bin/vitest run --testTimeout=30000     # TAM koşu (makine yüklü; 5sn timeout'lar yük kaynaklı)
```
Başka oturumun dosyalarından gelen kırmızı varsa DÜZELTME, raporda belirt.
Son kontrol: `git diff src/pages/Employees.tsx` çıktısında senin hunk'ın dışında yeni değişiklik OLMAMALI (diğer oturumun mevcut farkı hariç).

## Rapor (worker_done, ≤10 satır)
Değişen/yeni/yeniden adlandırılan dosyalar file:line, `Employees.tsx`'te değiştirdiğin tam satır aralığı, kapı sonuçları, açık risk. `--files-modified` tam liste.

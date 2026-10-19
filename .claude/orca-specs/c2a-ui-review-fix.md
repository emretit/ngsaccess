# C2a denetim düzeltmeleri — 02 Kişiler + 03 Cihazlar (frontend)
Önce `.claude/orca-specs/c2-common.md` oku. Claude denetimi (kritik/yüksek yok) şu bulguları verdi; hepsini düzelt:
1. ORTA `src/pages/Devices.tsx:55-60` + `src/components/devices/DeviceDetailsPanel.tsx`: proje değişiminde cihaz paneli dirty guard'sız kapanıyor
   (düzenlemede cihaz bulunamayınca sessiz kapanış; yeni cihaz taslağı yeni projeye yazılabilir). `src/components/employees/SlideOverPanel.tsx`'teki
   proje-değişimi korumasının eşini uygula: dirty iken proje değişirse UnsavedChangesDialog; vazgeçilirse taslak atılır ve panel kapanır; taslak
   ASLA yeni projeye kaydedilmez.
2. ORTA `src/components/employees/EmployeeDetails.tsx:~100` `<a href="/access-control">` → react-router `<Link to>` (tam sayfa yenileme yok).
3. ORTA `src/components/employees/EmployeeActivityBoundary.tsx:25` yetki ayrımı mesaj alt-dizgisine ('yetki'/'oturum') bağlı → `ConvexError`
   ise `data` üzerinden ayır (backend `ConvexError("Bu personele erişim yetkiniz yok")` fırlatıyor — string data; `instanceof ConvexError` +
   `typeof error.data === "string"`); boundary proje değişiminde de sıfırlansın (resetKeys/key'e projectId ekle).
4. DÜŞÜK `src/components/employees/EmployeeTable.tsx:~356` ad düğmesine `type="button"`. `src/components/devices/DeviceList.tsx:163` sayfa boyutu
   tetikleyicisi hâlâ dar → `w-36` veya `min-w-max` (metin "25 / sayfa" kesilmesin).
5. DÜŞÜK `EmployeeDetails` ayrıca tam `api.employees.list`'e abone → parent'tan gelen employee prop'unu/mevcut veriyi kullan, ikinci aboneliği kaldır
   (ayrıntının ihtiyaç duyduğu alan eksikse mevcut tek-kişi sorgusu varsa onu kullan; yeni backend YOK).
## Ownership
src/pages/Devices.tsx · src/components/devices/DeviceDetailsPanel.tsx · src/components/devices/DeviceList.tsx · src/components/employees/{EmployeeDetails,EmployeeActivityBoundary,EmployeeTable}.tsx
(SlideOverPanel yalnız oku; ortak yardımcı çıkarmak gerekirse src/components/employees/lib/ veya src/components/devices/lib/ içine)
## Kapsam dışı
convex/** · src/components/pdks/** · src/pages/PDKSRecords.tsx · src/components/ui|shared|layout.
## Kapılar
app tsc (PDKS dosyalarındaki hatalar başka worker'ın) · eslint src convex · npx vitest run · npx vite build. commit/push/deploy YOK. worker_done ≤6 satır.

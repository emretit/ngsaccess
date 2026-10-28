# Sayfa başlığı ekle butonu ortaklaştırma (K2)

Repo: /Users/emreaydin/ngsaccess (ana dizin, main). Worktree AÇMA.

## Hedef (test edilebilir)
Tüm modüllerin sağ üstündeki ekle butonu, Cihazlar sayfasındaki "Cihaz ekle" butonuyla birebir aynı görünür:
`Button size="sm"`, `className="min-h-11 md:min-h-8 gap-1.5 text-xs"`, solda `<Plus className="h-3.5 w-3.5" />` ikonu.
Bu görünüm TEK bir ortak bileşenden gelir; PageHeader'ın `primaryAction` butonu da DeviceAddMenu tetikleyicisi de onu kullanır.

## Bugünkü durum
- `src/components/shared/PageHeader.tsx`: `primaryAction` → düz `<Button onClick disabled>{label}</Button>` (ikon yok, text-sm).
- `src/components/devices/DeviceAddMenu.tsx:26-31`: hedef görünüm (Plus + "Cihaz ekle" + ChevronDown), `DropdownMenuTrigger asChild` içinde.
- primaryAction kullanan sayfalar (DOKUNMA, PageHeader değişince otomatik düzelir): Employees "Personel ekle", Leaves "İzin ekle",
  AccessRulesList "Yeni kural", VisitorManagement "Ziyaretçi kaydet", SystemAdmin (AdminUsersPanel "Kullanıcı davet et",
  AdminProjectsContent "Yeni proje", AdminDevicesPanel "Cihaz kaydet").

## Değişiklik
1. `PageHeader.tsx` içinde ortak bir bileşen export et, ör. `PageHeaderPrimaryButton`:
   - `React.forwardRef<HTMLButtonElement, ButtonProps>`; `Button size="sm"` + `cn("min-h-11 md:min-h-8 gap-1.5 text-xs", className)`.
   - forwardRef şart: `DropdownMenuTrigger asChild` ref ve prop'ları iletir.
   - `displayName` ver.
2. PageHeader `primaryAction` render'ı: `<PageHeaderPrimaryButton onClick disabled><Plus className="h-3.5 w-3.5" aria-hidden="true" />{label}</PageHeaderPrimaryButton>`.
   `primaryAction` prop tipini DEĞİŞTİRME (label/onClick/disabled kalır).
3. `DeviceAddMenu.tsx` tetikleyicisi kendi Button+className'i yerine `PageHeaderPrimaryButton` kullansın; içerik (Plus, "Cihaz ekle", ChevronDown) aynı kalsın.
4. `src/components/shared/PageHeader.test.tsx` (yeni): primaryAction verildiğinde butonun adı label, tıklayınca onClick çağrılır,
   `disabled` iletilir, buton `text-xs` ve `min-h-11` class'larını taşır. Testing Library + vitest; mevcut testlerin import/stil kalıbını izle.

## Ownership (yalnız bunlara yaz)
- src/components/shared/PageHeader.tsx
- src/components/shared/PageHeader.test.tsx (yeni)
- src/components/devices/DeviceAddMenu.tsx

## Kapsam dışı
- Başka hiçbir dosya. Özellikle `src/components/shifts/**` başka oturumun yarım işi — DOKUNMA, düzeltmeye çalışma.
- PDKS "Vardiya planı"/"Ayarlar", senkron butonu vb. diğer başlık butonları değişmez.
- Sayfa dosyalarındaki label metinleri değişmez.

## Kurallar
- `any` / `as any` / `!` non-null yasak. Yorum yoğunluğu çevredeki kod kadar.
- `git add`, `git commit`, `git stash`, `git reset`, `git checkout --` ÇALIŞTIRMA. commit/push/deploy/migration/DB yazma YOK.
- Convex'e dokunma, `npx convex` çalıştırma.

## Kapılar (koş, çıktıyı raporla)
- `node_modules/.bin/tsc --noEmit -p tsconfig.app.json`
- `node_modules/.bin/eslint src/components/shared src/components/devices`
- `node_modules/.bin/vitest run src/components/shared src/components/devices src/components/employees src/components/visitors`
Ownership dışı dosyalardan gelen hata varsa (ör. shifts) DÜZELTME; dosya:satır ile raporla.

## Rapor
worker_done özeti ≤10 satır: değişen dosyalar (file:line), kapı sonuçları, ownership dışı kalan hatalar.

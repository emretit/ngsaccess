# Geçiş Kontrol Dalga 3 — C2: Kapı listesi mobil + toplu kopya önizlemesi

## Hedef
Kapı Planları listesi mobilde kapı adı ile gönderim durumunu birlikte gösterir, ve toplu kopyada kullanıcı hangi plan türünün hangi kapılara gideceğini görüp seçebilir.

## Ownership (yalnız bunlar; testleri dahil)
- src/components/access-control/door-plans/DoorPlansTab.tsx, CopyDoorPlansDialog.tsx, bulk.ts (+ bulk.test.ts; yeni test serbest, ör. CopyDoorPlansDialog.test.tsx)
Kapsam dışı: DoorPlanDialog.tsx, door-dialog/*, DoorStatusPlanEditor.tsx (C1), unified/templates/TemplatePicker.tsx (A/Dalga 2 — prop'larını kullan, dosyayı değiştirme), convex/.

## İstenenler
1. **04-O6 mobil liste:** 390px'te her satır kart gibi: kapı adı + cihaz, durum planı / doğrulama planı özeti, gönderim durumu (öncelikli). Yatay kaydırma gerektirmesin; masaüstü tablo korunur.
2. **04-O5 kopya önizlemesi (karar: plan türü seçilebilir):** Kopya dialoğunda plan türü seçimi (Durum planı / Doğrulama planı / Tatil planı — onay kutuları); kaynak kapı + cihaz adı ve seçili türlerin kısa özeti; hedef kapı adları listesi (uzunsa ilk 5 + "ve N kapı daha"). Kaynak kapı hedeflerden dışlanır ve bu yazılır. Kaynakta olmayan/seçilmeyen plan türünün hedefte korunacağı açıklanır. Gönderim yalnız seçili türler için yapılır (bulk.ts mantığını buna göre genişlet, test et).
3. **04-D1:** Kopyadaki şablon kaynağının "Kapı modu" seçicisi formdaki diğer seçicilerle aynı bileşen (`@/components/ui/native-select` NativeSelect), tam genişlik, min-h-11.
4. **GK-4:** CopyDoorPlansDialog'daki TemplatePicker'a `onEdit` ver: dialog kapanır sonra gider; seçim yapılmışsa önce onay iste (mevcut `useUnsavedChangesGuard` deseni, DoorPlanDialog'daki gibi).

## Kabul
- Test: yalnız "Doğrulama planı" seçiliyken kopya yalnız doğrulama kaydı/gönderimi yapar; durum/tatil hedefte değişmez.
- Test: kaynak kapı hedef listesinde yok; hedef adları ve "ve N kapı daha" görünür.
- Test: TemplatePicker onEdit seçim varken guard'dan geçer.
- Mevcut bulk testleri yeşil.

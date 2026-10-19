# Görev: Dalga 2a denetim düzeltmeleri (backend)

Bağımsız denetçi Dalga 2a backend'inde aşağıdaki sorunları buldu. Hepsini düzelt; davranışı yalnız burada tarif edildiği kadar değiştir.

1. **YÜKSEK — convex/visitors.ts list() (~127):** her ziyaretçi için cardReadings `.collect()` (sınırsız, N+1) → okuma limiti riski. Konum hesabı için `by_employee` index'inde desc sıralı ve sınırlı (`.take(50)` gibi) okuma kullan; convex/lib/visitorPresence.ts mantığı (yalnız izin verilen + yönlü olay, accessTime sırası) korunmalı; sınır içinde başarılı olay yoksa durum "bilinmiyor"/dışarıda varsayımı mevcut davranışla tutarlı olsun. Test güncelle.
2. **YÜKSEK — convex/accessRules.ts update / updateWithGroups:** `assertAccessSchedule({...rule, ...clean})` legacy kuralı (boş days, gece aşan saat) yalnız isActive/isim değişse bile engelliyor. Doğrulamayı YALNIZ days/startTime/endTime argümanlarından biri değiştiyse çalıştır. Test ekle.
3. **ORTA — convex/visitors.ts update:** süresi geçmiş mevcut `accessExpiresAt` telefon vb. her düzenlemeyi engelliyor. Bitiş doğrulamasını yalnız `args.accessExpiresAt` verildiyse uygula. Test ekle.
4. **ORTA — convex/devices.ts update (~313):** yalnız zoneId taşınırken `device.doorId` legacy kapısı eski bölgede kalınca validateDeviceDoor hata fırlatıyor. doorId argümanı verilmediyse (yalnız bölge taşıma) kapı-bölge kontrolünü atla; DEV-20 güvenliği (başka panelin kapısına eşleme reddi) doorId verildiğinde aynen kalmalı.
5. **ORTA — convex/employees.ts bulkDelete:** tüm cascade tek transaction → büyük seçimde limit riski. Sunucuda seçim sınırı koy (ör. 50; Türkçe hata), frontend toplu silme bu sınırı aşan seçimde butonu kapatıp nedenini göstersin (src/components/employees/EmployeeBulkActions.tsx).
6. **ORTA — convex/files.ts getUploadUrl:** herhangi bir storageId için URL dönüyor. Yalnız çağıranın erişebildiği projedeki bir personelin `photoStorageId`'si ise (veya yükleme akışında yeni yüklenen ve henüz bağlanmamış dosya için mevcut kullanım neyse onu bozmadan) URL dönsün; tüketicileri grep'le ve kırma.

## Ownership (YALNIZ bunlar)
convex/visitors.ts · convex/lib/visitorPresence.ts(+test) · convex/accessRules.ts · convex/lib/accessRuleUx.ts(+test) · convex/devices.ts · convex/lib/deviceConnection.ts / deviceUx (gerekirse) · convex/employees.ts (yalnız bulkDelete sınırı) · convex/lib/employeeUx.ts(+test) · convex/files.ts · src/components/employees/EmployeeBulkActions.tsx · src/components/employees/hooks/usePhotoUpload.ts (yalnız getUploadUrl imzası değişirse)

## Kapsam dışı
convex/schema.ts (index önerilerini yalnız raporla) · başka dosya.

### Proje kuralları
- TypeScript strict; `any` / `as any` YASAK (eslint error) → `unknown` + narrowing. `!` yerine optional chaining + erken return.
- Convex sonuç tipleri için `FunctionReturnType<typeof api.X.Y>`; yerel tip kopyası yazma. Handler'lar camelCase alan döner.
- `db.get` null filtrelemesi: `filter((p): p is NonNullable<typeof p> => p !== null)`.
- Tarih: TR gün anahtarı için `convex/lib/trDate.ts` (backend) ve `src/lib/date.ts` (frontend `toLocalDateString` vb.); `toISOString().split('T')[0]` ile gün anahtarı üretme.
- Toast: yeni kodda `sonner` (`import { toast } from "sonner"`); mevcut `useToast` çağrılarını bu görevde topluca taşıma.
- Mevcut stil, isimlendirme, Türkçe yorum yoğunluğunu takip et; gereksiz yorum ekleme. Kapsam dışı refactor yapma.

### YASAK
commit / push / deploy (`npx convex dev`, `npx convex deploy`) / migration / canlı DB'ye okuma-yazma (Convex/Supabase MCP dahil). `convex/_generated/` elle düzenlenmez. Kirli dosyalara dokunma: convex/lib/cardReadingAudit.ts, mobile/**, .claude/**.

### Kapılar (hepsi yeşil olmalı, kendin koş)
node_modules/.bin/tsc --noEmit -p tsconfig.app.json
node_modules/.bin/tsc --noEmit -p convex/tsconfig.json
node_modules/.bin/eslint src convex   (0 error)
npx vitest run   (mevcut testlerin hepsi yeşil; yeni saf mantık eklediysen test yaz)

### worker_done raporu (≤10 satır)
Her bulgu ID'si için 1 satır: ne yapıldı + file:line · kapı sonuçları (test sayısı) · backend değişikliği varsa "deploy gerekir" notu · bilinçli yapılmayan/şüpheli noktalar. `--files-modified` ile değişen dosyaları bildir.

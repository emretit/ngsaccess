# Görev: Dalga 2a — Cihazlar UX-0A/0B/0C (rapor: docs/ux-audit/01_CIHAZLAR.md)

## Hedef (test edilebilir)
Raporun §5 UX-0A, 0B, 0C kabul senaryolarının hepsi sağlanıyor (pasif cihaz düzenlemede aktifleşmiyor, IDE create Pasif'i koruyor, temizlenen açıklama/IP/model kalıcı, başka panelin kapısına eşleme backend'de reddediliyor, filtre dışı seçim silinmiyor, QR geçerli dosya, komut sonuçları dürüst).

## Bulgular ve teslim
- UX-0A: DEV-01, DEV-02, DEV-12, DEV-13, DEV-14, DEV-15, DEV-17, DEV-18, DEV-20 (DEV-20 güvenlik: devices.update'te doorId sahipliği + zone-door tutarlılığı backend'de doğrulanır)
- UX-0B: DEV-03, DEV-06, DEV-08, DEV-27, DEV-36
- UX-0C: DEV-21, DEV-23, DEV-24, DEV-25 (ack yoksa 'Sıraya alındı', 'tamamlandı' deme), DEV-39

## Ownership (YALNIZ bunlar)
src/hooks/useProjectFilteredDevices.ts · src/lib/deviceStatus.ts(+test) · src/components/devices/** (tüm klasör) · src/types/device.ts · src/pages/Devices.tsx · src/pages/VirtualReaders.tsx · src/hooks/useDeviceFilters.tsx · src/hooks/useDeviceTable.tsx(+yeni deviceSelection.test.ts) · src/components/access-control/ZoneDoorTree.tsx · src/components/access-control/MoveReaderDialog.tsx · convex/devices.ts · convex/deviceCenter.ts · convex/readers.ts · convex/lib/deviceHelpers.ts · yeni convex/lib/deviceConnection.ts / convex/lib/deviceUx.ts (+test)

## Kapsam dışı (Dalga 2b veya başka worker)
UX-0D senkron (DEV-30..34: syncStatus/hikvisionSync/ideSync/sync banner) → 2b · adminDevices.ts/claim (ADM-0C) → 2b · src/components/access-control/** içinde ZoneDoorTree/MoveReaderDialog dışı · schema.

## Ortak kurallar (Dalga 2a)
- Bağlam: ilgili modül raporu (bulgu satırları §3, kabul senaryoları §5) + docs/ux-audit/00_OZET_VE_YOL_HARITASI.md §6 kullanıcı kararları.
- **Dalga 1 altyapısını KULLAN** (docs/ux-audit/DESIGN_SYSTEM.md): `resolveProjectScope` / `useActiveProjectScope`, `notify` (yeni kodda useToast yerine), `useAsyncAction` (her mutation butonu: pending + çift tıklama koruması + hata halinde form açık), `toPatch` + `v.optional(v.union(v.null(), T))` (boşaltılan alan = temizle), `ConfirmDestructive` (her yıkıcı işlem: nesne adı + etki listesi), `StatusBadge`, `SectionSkeleton`, `EmptyState`/`ErrorState`. Bu ortak dosyaları DEĞİŞTİRME; eksik bir şey gerekiyorsa `ask` ile sor.
- **Önceki dalgalarda yapıldı, tekrar yapma:** DEV-07/19/22 · ACC-03/10 · PPL-31/32/34 · ADM-01(listExpired)/03/09/11/20 · SHL-01..07/10/22/35. Kullanıcı kararları: cihaz silinince okuma geçmişi korunur; bağlı iş verisi olan proje silinemez; izni yalnız admin açar.
- `convex/schema.ts` DEĞİŞMEZ (bu dalgada kimsenin sahipliğinde değil). Index/alan gerekiyorsa uygulama, worker_done'da "2b'ye öneri" olarak yaz.
- convex-test kurulu DEĞİL, yeni bağımlılık ekleme: backend kurallarını saf fonksiyona (`convex/lib/<modül>*.ts`) çıkarıp vitest ile test et.
- Paralel 4 worker daha var; YALNIZ Ownership listendeki dosyalara yaz. Listede olmayan dosya gerekiyorsa DUR, `ask` ile sor.
- Bir bulgu ürün kararı gerektiriyorsa (rapor "ürün kararı" diyor) en dürüst minimal düzeltmeyi yap (yanlış iddiayı kaldır / açık "henüz yok" durumu) ve raporla; yeni ürün akışı icat etme.

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

# Görev: Dalga 0c — Cihaz + Canlı İzleme + Geçiş kuralı doğruluk düzeltmeleri

## Hedef (test edilebilir)
Kapı açma komutu hedef kapı seçilip onaylanmadan gitmiyor; konum ataması başarısızsa başarı demiyor; cihaz silinince geçmiş kart okumaları korunuyor ve onay diyaloğu neyin silineceğini doğru anlatıyor; canlı izlemede seçilen gün kaymıyor; erişim kuralı çift tıklamayla iki kez oluşmuyor.

## Değişiklik (raporlar: docs/ux-audit/01_CIHAZLAR.md, 02_GECIS_IZLEME_ZIYARETCI.md)
1. **DEV-22:** DeviceHikvisionSection + DeviceHikLocalBridgeSection'daki eski "Kapıyı Aç" (koşulsuz `doorNo: 1`, onaysız) yolunu kaldır; kullanıcıyı mevcut DeviceCommandCenter'daki hedef kapı seçimli + onaylı akışa yönlendir (veya aynı onay bileşenini kullan). Kapı numarası tanımsızsa 1'e düşme. Aynı dosyadaki native `confirm()` (DeviceHikvisionSection) varsa shadcn AlertDialog'a çevir.
2. **DEV-19:** useLocationForm hatayı yutmasın (throw veya typed result); AssignLocationForm başarı toast'ını yalnız mutation başarıyla bitince göstersin, hata halinde diyalog ve alanlar korunsun; çift toast olmasın.
3. **DEV-07 (kullanıcı kararı: okuma geçmişi KORUNSUN):** convex/devices.ts `remove` + convex/lib/deviceHelpers.ts cascade'i: `cardReadings` silinmesin (deviceId referansı kalır). Kapı/okuyucu/erişim grubu bağları cihazla birlikte silinmeye devam edebilir. Silinmiş cihaza işaret eden okumaları gösteren yerler null cihazda çökmemeli: `ctx.db.get(deviceId)` ve frontend cihaz adı gösterimlerini grep'le; null ise "Silinmiş cihaz" göster (bu dosyalar ownership dışındaysa listele ve `ask` ile sor). DeviceDeleteDialog metni: cihaz adı + "kapı ve okuyucu tanımları silinir, geçmiş kart okumaları korunur".
4. **ACC-10:** src/hooks/useProjectFilteredCardReadings.ts — takvim Date'ini `toISOString().split` yerine yerel tarih anahtarına çevir (`src/lib/date.ts`); backend TR gün sınırını zaten uyguluyor, convex/cardReadings.ts'e DOKUNMA.
5. **ACC-03:** useComplexAccessRuleMutations + useAccessRuleMutations'daki sabit `isPending:false` değerlerini gerçek uçuş durumuyla değiştir; CreateRuleDialog submit'i pending iken kilitli; AccessRulesList'te silme/aktif-pasif switch'i kural bazında uçuşta disabled.

## Ownership (YALNIZ bunlar)
src/components/devices/form-sections/DeviceHikvisionSection.tsx · src/components/devices/form-sections/DeviceHikLocalBridgeSection.tsx · src/components/devices/useLocationForm.tsx · src/components/devices/AssignLocationForm.tsx · src/components/devices/DeviceDeleteDialog.tsx · src/components/devices/DeviceTableRow.tsx (yalnız silme diyaloğu prop'ları) · convex/devices.ts (yalnız `remove`) · convex/lib/deviceHelpers.ts · src/hooks/useProjectFilteredCardReadings.ts · src/hooks/access-rules/useComplexAccessRuleMutations.ts · src/hooks/access-rules/useAccessRuleMutations.ts · src/components/access-control/unified/CreateRuleDialog.tsx · src/components/access-control/unified/AccessRulesList.tsx

## Kapsam dışı
convex/cardReadings.ts (PDKS ile ortak) · DEV-20 kapı sahipliği, DEV-01/06/30/32, ACC-01/11/18/19/30 (Dalga 2) · DeviceCommandCenter içeriği (yalnız oraya yönlendirme).

## Ortak kurallar (Dalga 0 implementasyon worker'ları)

Repo: /Users/emreaydin/ngsaccess — React 19 + Vite + Tailwind 4 + shadcn/ui, backend Convex. Kullanıcıya görünen metin Türkçe.
Bağlam: docs/ux-audit/00_OZET_VE_YOL_HARITASI.md + ilgili modül raporu (bulgu ID'leri orada; her bulgunun "Öneri" sütununu oku). Convex kodu yazmadan önce convex/_generated/ai/guidelines.md oku.
Aynı anda başka worker'lar farklı dosyalarda çalışıyor: YALNIZ Ownership listesindeki dosyalara yaz. Listede olmayan bir dosyaya dokunman gerekiyorsa DUR ve `ask` ile koordinatöre sor.

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

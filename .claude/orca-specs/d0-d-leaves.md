# Görev: Dalga 0d — İzin ekranı: yalnız admin izin açar (talep akışı yok)

## Kullanıcı kararı
"Şimdilik izni yalnız admin açsın; çalışan talep/onay akışına sonra bakılacak." Admin = mevcut `adminMutation` tanımı (`super_admin` + `project_admin`), `project_user` izin açamaz/onaylayamaz.

## Hedef (test edilebilir)
Yalnız super_admin/project_admin izin oluşturabiliyor ve oluşturulan izin doğrudan "onaylı"; listede her iznin kime ait olduğu (ad soyad + departman) görünüyor; eski "beklemede" kayıtlar yalnız admin tarafından onaylanıp reddedilebiliyor ve bu işlem not alanını silmiyor; project_user ekranı salt okunur görüyor.

## Değişiklik (rapor: docs/ux-audit/03_KISILER_VARDIYA_IZIN.md — PPL-31, PPL-32, PPL-34)
1. **Backend (convex/leaves.ts):** `create`, `approve`, `reject` → `adminMutation` (convex/lib/customFunctions.ts) + mevcut proje erişim kontrolü korunur. `create`: `status: "approved"`, `approvedBy: ctx.user._id` (schema'da varsa createdBy benzeri alan kullan; schema DEĞİŞTİRME). `approve`/`reject`: `approvedBy` argümanını KALDIR, `ctx.user._id` kullan; yalnız `status === "pending"` kayıtta geçiş yap, değilse Türkçe hata ("Bu izin zaten sonuçlandırılmış"); `notes` yalnız argüman verilirse güncellensin (mevcut notu undefined ile ezme). Saf durum geçiş/yetki mantığını `convex/lib/leaveRules.ts`'e çıkar + vitest testi.
2. **Frontend (src/pages/Leaves.tsx):** rolü mevcut auth/proje hook'larından oku (`useAuth` profile.role veya `useProjectAccess` — projede hangisi kullanılıyorsa). Admin değilse "İzin Ekle" formu ve onay/red butonları görünmez, sayfa salt okunur. Form başlığı/metni "İzin Ekle" (talep değil); başarı mesajı "İzin kaydedildi". Liste satırlarında ilk bilgi personel ad soyad + departman (mevcut `employees` sorgusundan eşle; departman adı için mevcut departments sorgusu/alanı), ardından tür, tarih aralığı, gün sayısı, not. Bekleyen bölümü yalnız pending kayıt varsa görünür. Onay/red çağrılarından `approvedBy` kaldırılır; işlem sürerken butonlar disabled.
3. `FunctionReturnType<typeof api.leaves.list>` ile tiple; yerel tip kopyası yazma.

## Ownership (YALNIZ bunlar)
convex/leaves.ts · convex/lib/leaveRules.ts (yeni) · convex/lib/leaveRules.test.ts (yeni) · src/pages/Leaves.tsx

## Kapsam dışı
Çalışan talep akışı, izin bakiyesi (PPL-33), çakışma motoru, mobile/, vardiya takvimi (listForRange'e dokunma), schema değişikliği.

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

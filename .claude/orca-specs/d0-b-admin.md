# Görev: Dalga 0b — Ayarlar/Admin doğruluk + yetki koruması

## Hedef (test edilebilir)
Zamanlanmış rapor kapatılabiliyor; Pafta kartı sahte/rastgele sonuç üretmiyor; son süper admin ve kendini düşürme backend'de engelli; bağlı kaydı olan proje silinemiyor (sayılarla açıklanıyor); proje yöneticisi kullanıcı panelinde hata almıyor.

## Değişiklik (rapor: docs/ux-audit/04_AYARLAR_ADMIN.md)
1. **ADM-11:** ReportsSettings — Kaydet düğmesi zamanlama açık/kapalı her iki durumda görünür; kapatırken gizli e-posta alanı zorunlu değil; kaydederken pending; kayıttan sonra persisted değer gösterilir.
2. **ADM-09 (kullanıcı kararı: Pafta gerçekten bağlanacak — bu görevde DEĞİL):** PaftaIntegrationCard'daki `Math.random` anahtar, rastgele test sonucu ve timer'lı sahte bağlantı/senkronu tamamen kaldır. Kart "Pafta entegrasyonu geliştiriliyor — henüz bağlı değil" durumunu dürüstçe göstersin; kontroller disabled. Bileşen ve IntegrationsSettings'teki yeri korunur (gerçek entegrasyon ayrı iş olarak buraya bağlanacak).
3. **ADM-03:** convex/users.ts `updateRole` ve `deleteUser`: kullanıcı kendi rolünü düşüremez/kendini silemez; sistemde son kalan super_admin düşürülemez/silinemez → Türkçe hata. UI (useUserManagement) bu hatayı toast ile göstersin.
4. **ADM-20 (kullanıcı kararı: silmeyi engelle):** convex/projects.ts `remove`: projeye bağlı kayıt varsa (en az: userProjects üyelikleri, devices, employees, zones, doors, accessRules — schema'da projectId taşıyan diğer ana tablolara da bak, index varsa index ile say, `.take(1)` yeterli varlık kontrolü + mümkünse sayı) silmeyi reddet; hata mesajı neyin bağlı olduğunu söylesin ("Bu projeye bağlı 12 personel, 3 cihaz var; önce bunları taşıyın veya silin"). Yetki: mevcut yetki kontrolünü gevşetme, super_admin değilse zaten reddediliyorsa koru. AdminProjectsPanel onay diyaloğu bu kuralı ve hatayı göstersin; "başarıyla silindi" yalnız gerçekten silinince. `userProjects` sorgusu silinmiş projeyi "Proje" adıyla döndürmesin (null filtrele).
5. **ADM-01 (yalnız acil kısım):** AdminUsersPanel'de `listExpired` (super_admin-only) sorgusu yalnız super_admin için çalışsın, diğerlerinde `"skip"`. Yetenek haritası/ProjectFilter yeniden tasarımı bu görevde YOK.

## Ownership (YALNIZ bunlar)
src/components/settings/sections/ReportsSettings.tsx · src/components/settings/sections/integrations/PaftaIntegrationCard.tsx · convex/users.ts · src/components/admin/hooks/useUserManagement.ts · convex/projects.ts · convex/userProjects.ts (yalnız silinmiş proje filtresi) · src/components/admin/AdminProjectsPanel.tsx · src/components/admin/AdminUsersPanel.tsx · convex/reports.ts (yalnız ADM-11 için gerekirse)

## Kapsam dışı
ADM-02 rol+üyelik atomik işlemi, yetenek matrisi, denetim kaydı (ADM-28), gerçek Pafta entegrasyonu, diğer modüller.

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

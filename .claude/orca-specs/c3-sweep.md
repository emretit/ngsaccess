# C3-sweep: A2 yasak kalıntılarını temizle (useToast, sabit renk, emoji, ölü CSS)
ÖNCE `.claude/orca-specs/c3-common.md` oku.

## Hedef (test edilebilir)
Ownership'teki dosyalarda `use-toast` importu, Tailwind palet renk sınıfı (`(bg|text|border|ring)-(red|green|blue|…|gray|slate)-NNN`),
sabit hex/rgb ve emoji kalmaz; `src/App.css` silinir. Davranış ve metinler değişmez.

## Yapılacaklar
1. `useToast`/`toast(...)` → `notify.success/error/info` (aynı metin; varyant eşleme: destructive→error). Dosyalar:
   `src/components/admin/IdeProvisioningCard.tsx`, `src/components/pdks/chat/useAiChat.ts`, `src/components/pdks/dashboard/PDKSSavedViews.tsx`,
   `src/components/pdks/chat/useExportUtils.ts`, `src/components/employees/EmployeeConsentsCard.tsx`, `src/hooks/useDevices.ts`.
2. Palet renk sınıfları → A2 token / `statusTone`: `IdeProvisioningCard.tsx` (24 adet; kartın içeriği/işlevi DEĞİŞMEZ, yalnız renk),
   `src/components/pdks/AiInsightsCard.tsx`, `src/components/pdks/chat/AiModelStatus.tsx`, `src/components/profile/SecurityCard.tsx`,
   `src/components/profile/ProfilePhoto.tsx`, `src/components/profile/ProfileForm.tsx`, `src/components/employees/EmployeeConsentsCard.tsx`,
   `src/components/employees/EngineeringDepartmentView.tsx`. Anlam koru: hata→destructive, başarı/uyarı→statusTone tonları, nötr→muted.
3. Emoji: `src/components/pdks/PDKSAiChat.tsx` → lucide ikon veya metin.
4. `src/App.css` (4 satır) sil + `src/App.tsx:12` importunu kaldır (önce içeriğin gerçekten kullanılmadığını doğrula; kullanılıyorsa `index.css`'e taşı).
5. Son tarama: `grep -rEn` ile ownership dışında kalan palet/hex/emoji/useToast kalıntılarını listele (DÜZELTME, yalnız raporla). Kapsam dışı:
   `src/components/landing/**` (pazarlama sayfası), `src/components/ui/**` (shadcn altyapısı, toaster dahil), `src/components/ui/logo.tsx`.

## Ownership
Yukarıdaki dosyalar + `src/App.tsx` (yalnız App.css importu) + `src/App.css`. Testleri varsa ilgili `*.test.*`.

## Kapsam dışı
Yerleşim/metin değişikliği, yeni bileşen, landing, ui/**, access-rules hook'ları (başka worker'da).

## Rapor
`.claude/orca-specs/reports/c3-sweep.md` — ayrıca 5. maddedeki kalıntı listesi.

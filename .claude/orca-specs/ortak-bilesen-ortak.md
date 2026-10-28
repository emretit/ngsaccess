# Ortak bileşen keşfi — ortak kurallar (SALT OKUMA)

Repo: /Users/emreaydin/ngsaccess (ana dizin, main). Worktree AÇMA. React + Vite + Tailwind + shadcn/ui, backend Convex.

## Bağlam
Az önce sayfa başlığı ekle butonu ortaklaştırıldı: `PageHeaderPrimaryButton` (src/components/shared/PageHeader.tsx).
Hedef: aynı türden, birden çok modülde tekrar eden UI/davranış kalıplarını bulup ortak bileşen adayı olarak raporlamak.

Hâlihazırda var olan ortak bileşenler (src/components/shared/, kullanan dosya sayısı):
AccessDenied 8 · BulkBar 5 · ConfirmDestructive 39 · EmptyState 42 · ErrorState 5 · FilterBar 13 · FormFieldWrapper 36 ·
PageHeader 17 · PaginationBar 9 · PasswordField 10 · QuerySectionBoundary 34 · RowActions 18 · SectionSkeleton 76 ·
StatInline 5 · StatusBadge 34 · TreePanel 6 · UnsavedChangesDialog 41. Ayrıca src/lib/tableRowClick.ts (onRowActivate + ROW_CLICK_CLASS).
src/components/ui/ = shadcn primitive'leri; bunları aday sayma.

## İki tür bulgu ara
1. **Atlanan ortak bileşen**: var olan bir shared bileşenin işini elle yapan yerler (ör. FilterBar yerine kendi arama+filtre satırı,
   PaginationBar yerine kendi sayfalama, StatusBadge yerine elle renkli Badge). Her biri için dosya:satır.
2. **Yeni aday**: en az 3 farklı modülde tekrar eden, henüz ortak olmayan kalıp (markup + className + davranış).
   Aynı className zincirinin kopyalanması, aynı state/handler iskeleti, aynı Sheet/Dialog iskeleti vb.

## Her aday için yaz
- Ad (önerilen bileşen/hook adı) · tür (atlanan / yeni)
- Ne tekrar ediyor (1-2 cümle) + görsel/davranış tutarsızlığı varsa ne (ör. biri 12px biri 14px)
- Geçtiği yerler: dosya:satır listesi, toplam adet
- Önerilen API (props imzası, 3-6 satır TS)
- Etki: kaç dosya değişir · risk (düşük/orta/yüksek) · kaba süre (dk/saat)
- Öncelik: P1 (görsel tutarsızlık kullanıcıya görünüyor veya ≥6 tekrar) / P2 / P3

Kanıta dayan: her iddia için grep/okuma ile doğrulanmış dosya:satır. Tahmin yazma. 3'ten az tekrar eden şeyi aday yapma.
En fazla 15 aday; önceliğe göre sırala. Raporun en üstüne 5 satırlık özet koy.

## Kurallar
- SALT OKUMA. Kaynak dosyalara YAZMA. Tek yazacağın dosya kendi rapor dosyan.
- `git add`, `git commit`, `git stash`, `git reset`, `git checkout` ÇALIŞTIRMA. commit/push/deploy/migration/DB yazma YOK. `npx convex` çalıştırma.
- `src/components/shifts/**` başka oturumda yarım değişiklik içeriyor; okuyabilirsin, bulgu verirken "değişiyor" diye işaretle.

## Rapor
worker_done özeti ≤10 satır: aday sayısı, P1'ler tek satır, rapor dosyası yolu (--report-path ile ver).

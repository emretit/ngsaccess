# GK2-D2 — Kapı Planları hızlı düzeltmeler (5 küçük iş)

## Hedef (test edilebilir)
Kapı Planları sekmesinde aşağıdaki 5 küçük sorun düzelir; `tsc` 0 hata, değişen dosyalarda `eslint` 0 error, `vitest run src/components/access-control` yeşil.

## Bağlam
- Denetim raporu: `docs/ui-audit-gk/tur2/kapi-planlari.md` (bulgu kimlikleri aşağıda). Proje kuralları `CLAUDE.md` (strict TS, `any` yasak).
- Sekme başlığı (h1) az önce kaldırıldı; sayfa başlığı artık ortak `PageHeader` (UnifiedAccessControl). Buna dokunma.
- Aynı repoda BAŞKA oturumlar aynı anda çalışıyor (FilterBar, tablo genişliği, kural penceresi). Ownership dışına yazarsan onların işini ezersin.

## İşler
1. **GK2-KP-O1** `door-plans/DoorPlansTab.tsx:~205-220`: plan hücresi satır tıklamasını kesmesin. `stopPropagation` yalnız "Plan ayrıntıları" açılır kontrolünde (`details`/`summary`) kalsın; hücrenin geri kalanına tıklayınca satırla aynı diyalog açılsın (`src/lib/tableRowClick.ts` kalıbı).
2. **GK2-KP-D1** Kapsam metni: tablonun üstüne kısa, soluk bir satır: "Kapı planları Hikvision gateway kapılarında desteklenir." Boş durum (`EmptyState`, "Plan kurulabilecek Hikvision kapısı yok") açıklamasına da aynı koşulu ekle + Cihazlar sayfasına bağlantı (`/devices`) varsa EmptyState `action` ile.
3. **GK2-KP-D2** Cümle düzeni: `door-dialog/DoorStatusPlanSection.tsx:~24` "Kapı Durum Planı" → "Kapı durum planı"; `door-dialog/DoorVerifyPlanSection.tsx:~26` "Doğrulama Modu Planı" → "Doğrulama planı"; `door-plans/DoorPlansTab.tsx:~30-36` mod etiketlerinde gereksiz büyük harf ("Kart veya Yüz / Parmak İzi" → "Kart veya yüz / parmak izi" vb.). Testlerdeki beklenen metinleri güncelle.
4. **GK2-KP-D3** Mobilde (≤767px) son kapı kartının çerçevesi kayboluyor (`src/components/ui/table.tsx:63` `last-child:border-0`). `table.tsx`'e DOKUNMA (başka oturum düzenliyor); düzeltmeyi yalnız `DoorPlansTab.tsx` satır sınıfında yap (ör. `max-md:last:border` benzeri), masaüstü görünümü değişmesin.
5. Tatil takvimi bağlantısı: `door-plans/DoorPlanDialog.tsx:~365-390` bağlantı yalnız boş durumda var; tatil listesi doluyken de aynı bağlantıyı göster.

## Ownership (yalnız bunlara yazabilirsin)
- src/components/access-control/door-plans/DoorPlansTab.tsx
- src/components/access-control/door-plans/DoorPlanDialog.tsx
- src/components/access-control/door-dialog/DoorStatusPlanSection.tsx
- src/components/access-control/door-dialog/DoorVerifyPlanSection.tsx
- Bu dosyaların testleri (`src/components/access-control/door-plans/*.test.tsx`, `src/components/access-control/door-dialog/*.test.tsx`, `src/components/access-control/DoorStatusPlanEditor.test.tsx`)

## Kapsam dışı
`convex/`, `src/components/ui/*`, `src/components/shared/*`, diğer sekmeler, A3-H1 (takvim değişince yeniden gönderim — ürün kararı bekliyor), A3-O2 arama/sayfalama, A3-O3 kopya özeti.

## Kapılar (koş, sonucu rapora yaz)
1. `node_modules/.bin/tsc --noEmit -p tsconfig.app.json` → 0 hata (makine yüklü, ~5 dk sürebilir; timeout'u 600 sn ver)
2. `node_modules/.bin/eslint <değişen dosyalar>` → 0 error
3. `node_modules/.bin/vitest run src/components/access-control` → 0 fail. TAM vitest KOŞMA (makine yüklü; koordinatör sonra koşacak).
4. Orca: kendi sekmeni aç (`orca tab create --url "http://localhost:8081/access-control?tab=doors" --worktree current --json`), HER komutta `--page <id>`; masaüstü + 390px iframe ekran görüntüsü (`orca screenshot --page <id> --json` → `result.path`) → `docs/ui-audit-gk/tur2/d2-sonrasi/`. Tıklama: `/tmp/orcaclick.sh <pageId> "<JS ifadesi>"`. Kaydet/Gönder/Kopyala BASMA (diyalog aç → Vazgeç serbest). Bitince sekmeni kapat.

## Yasaklar
`git add`, `git commit`, `git stash`, `git reset`, `git checkout`, push, deploy ÇALIŞTIRMA. `npx convex *` YASAK. Dev sunucusunu yeniden başlatma. Ownership dışına yazma; gerekirse `ask`.

## worker_done
≤10 satır: değişen dosyalar (file:line), kapı sonuçları (tsc/eslint/vitest sayıları), ekran görüntüsü yolu, açık kalan.

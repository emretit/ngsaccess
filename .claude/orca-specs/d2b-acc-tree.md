# Dalga 2b — ACC-35/38: Bölge/kapı silme onayı + kapı ayarı "kaydedildi / cihaza uygulanamadı" sonucu

**Hedef:** Bölge ve kapı silme, nesne adı ve gerçek etkiyi (silinecek okuyucu sayısı, bağımlılık) gösteren onaydan ve işlem kilidinden geçer; kapı ayarı DB'ye kaydedilip cihaza uygulanamadığında diyalog kapanmaz, kaydedilen ve cihazdaki durum ayrı gösterilir ve başarısız plan tekrar gönderilebilir.

(Ortak kurallar aşağıda; modül raporu: `docs/ux-audit/02_GECIS_IZLEME_ZIYARETCI.md` §3 ACC-35/38 + §5.)

## Bulgular
1. **ACC-35 (🟠)** — `ZoneDoorTree.tsx`: okuyucu silme zaten `ConfirmDestructive` kullanıyor (Dalga 2a); bölge (`removeZone`, ≈ satır 186) ve kapı (`removeDoor`, ≈ satır 200) silme doğrudan mutation.
   - Kapı silme: `ConfirmDestructive` — kapı adı, silinecek okuyucu sayısı (ağaç verisinden veya `doors.remove`'un gerçek davranışına göre), erişim etkisi (bu kapıya bağlı kurallar/grup kapıları — `doors.ts` remove ne yapıyorsa onu dürüstçe yaz), "kart okuma geçmişi korunur". `useAsyncAction` ile kilit + hata gösterimi.
   - Bölge silme: doluysa backend (`zones.ts:78`) reddediyor → UI önceden "Önce kapıları taşıyın/silin (N kapı)" der ve silme düğmesi yerine açıklama/taşıma yönlendirmesi (mevcut taşıma diyaloğu varsa ona bağla, yoksa yalnız açıklama); boş bölge için onay + sonuç bildirimi.
   - Backend hata mesajları Türkçe ve kullanıcıya gösterilebilir olsun (`zones.ts`/`doors.ts` remove).
2. **ACC-38 (🟠)** — `EditDoorDialog.tsx` (≈ satır 185-240): `doors.update` sonrası cihaz planları uygulanamazsa toast atılıp diyalog yine kapanıyor.
   - Sonucu iki aşamalı göster: "Kaydedildi ✓" + "Cihaza uygulanamadı: <plan/sebep>" kalıcı satır içi uyarı; diyalog AÇIK kalır; "Tekrar gönder" yalnız başarısız plan(lar)ı yeniden uygular (DB'yi tekrar yazmadan); "Kapat" kullanıcının seçimi.
   - Zaman planı input ve switch'lerine `<Label htmlFor>` / `aria-labelledby` bağı; saat aralığı doğrulaması (başlangıç < bitiş, HH:mm) zod/şema ile, Türkçe hata.
   - Yeni kodda `notify` (sonner); bu dosyadaki mevcut `useToast` çağrılarını yalnız dokunduğun akışta değiştir.

## Ownership (yalnız bunlara yaz)
src/components/access-control/ZoneDoorTree.tsx · src/components/access-control/EditDoorDialog.tsx · src/hooks/useZonesAndDoors.ts · convex/zones.ts · convex/doors.ts — **YALNIZ** `remove` mutation'ları ve hata mesajları (+ silme etkisi önizlemesi için yeni bir küçük query gerekiyorsa `doors.ts`/`zones.ts` içinde ekleyebilirsin) · convex/lib/doorZoneDelete*.ts (yeni, saf mantık + test)
`doors.update`, `doors.readerStatus`, `readers.ts`, `convex/actions/**` → DEĞİŞTİRME; plan tekrar gönderimi için mevcut action yetmiyorsa `ask`.

## Kapsam dışı
Okuyucu diyalogları (Add/Edit/MoveReader — Dalga 2a'da yapıldı) · cihaz sayfaları · kart okuma/ziyaretçi (ACC-kapsam worker) · schema.ts (koordinatör) · Dalga 3 tasarım göçü.

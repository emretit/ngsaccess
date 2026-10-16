# Tüm Modüller — UX/UI Audit Sentezi + Yol Haritası (2026-10-16)

> Girdi: 5 modül raporu (Orca run `run_6ef22c4142e5`, Codex `gpt-6-astra high`, salt-okuma).
> Koordinatör doğrulaması: 930 `file:satır` referansının hepsi mevcut (otomatik), 🔴 bulgulardan 7'si koda bakılarak teyit edildi.
> Kapsam dışı: PDKS Kayıtları (ayrı plan: `docs/PDKS_KAYITLARI_UX_PLANI_2026-10-16.md`), `mobile/` Flutter.

## 1. Sayılar

| Rapor | 🔴 | 🟠 | 🟡 | ⚪ | Toplam | UX-0 / UX-1 / UX-2 (kişi-gün) |
|---|---:|---:|---:|---:|---:|---|
| [01 Cihazlar](01_CIHAZLAR.md) (`DEV`) | 8 | 21 | 10 | 0 | 39 | 5–7 / 3 / 3–4 |
| [02 Geçiş + Canlı İzleme + Ziyaretçi](02_GECIS_IZLEME_ZIYARETCI.md) (`ACC`) | 7 | 23 | 9 | 0 | 39 | 6–8 / 5–7 / 5–8+ |
| [03 Kişiler + Vardiya + İzin](03_KISILER_VARDIYA_IZIN.md) (`PPL`) | 9 | 25 | 9 | 0 | 43 | 7–10 / 4–6 / 7–11 |
| [04 Ayarlar + Admin + Denetim + Profil](04_AYARLAR_ADMIN.md) (`ADM`) | 9 | 20 | 12 | 0 | 41 | 6–9 / 4–6 / 6–10 |
| [05 Kabuk + Dashboard + Giriş + Tasarım sistemi](05_KABUK_DASHBOARD_GIRIS.md) (`SHL`) | 5 | 19 | 14 | 1 | 39 | 4–5 / 3 / 3–4 |
| **Toplam** | **38** | **108** | **54** | **1** | **201** | **28–39 / 19–25 / 24–37** |

Kişi-gün tahminleri worker'ların; paralel worker'larla takvim süresi kabaca üçte birine iner.

## 2. Ana sonuç

Uygulamanın asıl sorunu görünüm değil, **ekranın gösterdiği ile gerçekte olanın ayrışması**. 38 kritik bulgunun
neredeyse tamamı aynı 6 kök sebepten çıkıyor. Bu kök sebepler önce ortak bir altyapı katmanında çözülürse
modül düzeltmeleri hem kısalır hem birbirine benzer olur. Görsel yenileme (UX-1) bundan sonra gelmeli.

## 3. Ortak kök sebepler (modüller arası)

| # | Kök sebep | Örnek bulgular | Ortak çözüm |
|---|---|---|---|
| K1 | **Aktif proje ≠ sorgu kapsamı.** Başlıkta seçili proje görünür, sorgu tüm yetkili projeleri (super_admin'de tüm sistemi) toplar | SHL-01, ACC-30, PPL-02, ADM-02 | Tek "proje kapsamı" sözleşmesi: query'ler `projectId` alır, backend `aktif ∩ izinli` uygular; frontend'de `useActiveProjectScope` |
| K2 | **Sahte / erken başarı.** Toast, işlem gerçekleşmeden ya da hiç gerçekleşmeden "Başarılı" der | PPL-01, DEV-19, DEV-30, ADM-09, ADM-11, SHL-02, SHL-27, ACC-03, **SHL-35** | İşlem sonucu modeli: `kaydedildi / kuyrukta / cihaz onayladı / kısmi / başarısız`; sabit `isPending:false` adaptörleri kaldırılır |
| K3 | **Temizleme yazılmıyor.** Formda boşaltılan alan `undefined` gidiyor, backend atlıyor, eski değer kalıyor | ACC-01, PPL-21, PPL-32 | Convex update sözleşmesi: `undefined` = dokunma, `null` = temizle; her formda aynı test matrisi |
| K4 | **"Değiştir" gibi görünen "ekle".** Tekli seçim A→B yapınca A üyeliği kalıyor | PPL-04, ADM-02 | Üyelik için açık "değiştir" mutation'ı (eski kaldır + yeni ekle tek işlemde) |
| K5 | **Kesilmiş tarama → yanlış "yok"/yeşil.** İlk N kayıt alınıp sonra filtreleniyor | DEV-32, ACC-11, ADM-28 | Index + cursor sayfalama, dürüst toplam, kesilme bilgisi UI'da |
| K6 | **Yıkıcı işlem güvenliği.** Etkisi anlatılmayan silme, backend guard yok, 4 native `confirm()` | DEV-06, DEV-07, DEV-22, PPL-08, PPL-16, ADM-03, ADM-20 | `ConfirmDestructive` (AlertDialog + etki özeti + pending) + backend guard (son super_admin, bağlı kayıt) |

**Güvenlik etkili olanlar** (UX'ten önce ele alınmalı): PPL-34 (izin onayında rol kontrolü yok, `approvedBy` istemciden),
ACC-30 (ziyaretçi başka projenin kuralına üye yazılabiliyor), ADM-03 (son super_admin kendini düşürebilir), DEV-20
(başka panelin kapısına bağlama, backend sahiplik kontrolü yok).

## 4. Tasarım sistemi durumu (SHL §7 taraması, 398 dosya)

| Metrik | Değer | Hedef |
|---|---:|---|
| Sabit Tailwind renk (`bg-green-100` vb.) | 252 (PDKS 81, auth 36, admin 20) | Durum renkleri yalnız `status-*` token + `StatusBadge` |
| Emoji içeren JSX satırı | 26 (PDKS 20) | Lucide ikon + metin |
| Native `confirm()` | 4 | 0 → AlertDialog |
| Tam ekran spinner tüketen dosya | 17 | Bölüm bazlı `Skeleton` |
| `EmptyState` / `ErrorState` / `StatCard` kullanımı | 3 / 1 / 5 | Tüm liste sayfaları |
| `FormFieldWrapper` kullanımı | 0 | Tüm formlar |
| aria-label'sız ikon buton adayı | 49 | 0 |
| **Sonner `<Toaster />` mount edilmemiş** | 4 dosya (`DeviceCommandCenter`, `ReportsSettings`, `DeviceHikvisionSection`, `VirtualReader`) toast'ları **hiç görünmüyor** | `App.tsx`'e mount + tek toast API |

## 5. Yol haritası (Orca worker dalgaları)

Kural: her dalgada worker'lar dosya paylaşmaz; denetim yazanın öbür ailesinden (Codex yazdı → Claude denetler).

### Dalga 0 — Hızlı acil düzeltmeler (~1 gün, 2 worker, yalnız frontend)
Küçük, bağımsız, kullanıcının bugün yanlış bilgi gördüğü yerler:
- **0a (kabuk/dashboard/ayarlar):** SHL-35 Sonner mount · SHL-02 sabit Aktivite kartını kaldır · SHL-03 "Bekleyen İstekler" → "Pasif kurallar" · SHL-10 işlevsiz zil · SHL-22 tokensız `/employee-setup` · ADM-09 Pafta kartını "yakında" yap · ADM-11 zamanlanmış raporu kapatabilme
- **0b (cihaz/izleme):** DEV-22 "Kapıyı Aç" hedef seçimi + onay · DEV-19 konum atama sahte başarı · ACC-10 canlı izlemede gün kayması (date-only) · ACC-03 gerçek pending (çift kayıt)

### Dalga 1 — Ortak altyapı (~2–3 gün, 1 worker, sıralı)
K1–K6 için paylaşılan parçalar; modül dalgaları bunları tüketir:
1. Proje kapsamı: `useActiveProjectScope` + convex `resolveProjectScope(ctx, projectId)` yardımcısı (K1)
2. İşlem sonucu + tek toast API (sonner), `useMutationState` adaptörü (K2)
3. Nullable update yardımcısı + test (K3)
4. `ConfirmDestructive`, `StatusBadge`, `PageSkeleton` shared bileşenleri (K6 + tasarım sistemi)

### Dalga 2 — Modül UX-0 doğruluk paketleri (~3–4 gün takvim, 4–5 paralel worker, backend dahil)
Her modül raporunun §5 UX-0 paketleri, ownership listeleriyle. İlk paketler:
- PPL UX-0A: izin onayında kişi kimliği + not koruma + onay yetkisi (PPL-31/32/34) + PPL-01, PPL-21
- ADM 0A+0B: rol/üyelik doğruluğu, son super_admin guard, proje silme politikası, profil boş ad (ADM-01/02/03/20/33)
- DEV UX-0A/0B: status/aktiflik ayrımı, seçim+silme etkisi, senkron "kapat" ≠ "çözüldü" (DEV-01/06/07/30/32)
- ACC 0A/0B/0C: saat temizleme, proje kapsamı, kayıt sayfalama, ziyaretçi "içeride" + kart yakalama (ACC-01/11/18/19/30)
- SHL 0B/0C: hesap doğrulama kurtarma, demo formu alanları (SHL-17/21/27)

Dikkat: `convex/cardReadings.ts` ACC ve PDKS'te ortak; kapı/okuyucu ağacı DEV ve ACC'de ortak; `AddShiftDialog` (settings altında) PPL'ye ait → bu dosyalar tek worker'a verilir.

### Dalga 3 — UX-1 sadeleştirme + tutarlılık (~3–4 gün takvim, paralel)
Modül §5 UX-1 paketleri + tasarım sistemi geçişi (renk token, emoji, EmptyState/ErrorState, FormFieldWrapper, aria-label).
Bu dalgadan sonra tarayıcıda görsel tur (320/768/1280px, açık/koyu tema, klavye).

### Dalga 4 — UX-2 yeni yetenekler (ürün kararına bağlı)
Kişi detay/planlama yüzeyi, toplu içe aktarma, izin bakiyesi, operatör canlı izleme modu, QR ziyaretçi, gerçek satış talebi, hesap kurtarma.

## 6. Ürün kararları (kullanıcı, 2026-10-16)

1. **İzin:** şimdilik yalnız admin izin açar (doğrudan onaylı); çalışan talep/onay akışı sonraya. Rol kapsamı teyit bekliyor.
2. **Proje silme:** bağlı kayıt varsa backend engeller.
3. **Cihaz silme:** kart okuma geçmişi korunur.
4. **Pafta:** gerçek entegrasyon yapılacak (ayrı iş paketi; Dalga 0'da yalnız sahte simülasyon kaldırılır).
5. **Dashboard Aktivite Özeti:** gerçek PDKS verisine bağlanır.

### İlk sorular (arşiv)

Dalga 0–2'yi bloklayanlar (önce bunlar):
1. **İzin onayı:** hangi roller onaylayabilir? (proje yöneticisi mi, yalnız admin mi?) — PPL-34
2. **Proje silme:** bağlı kayıt varsa engelle mi, arşivle mi, cascade mi? — ADM-20
3. **Cihaz silme:** kart okuma geçmişi silinsin mi, korunsun mu (soft delete)? — DEV-07
4. **Pafta entegrasyonu:** şimdilik gizle mi, gerçek entegrasyon mu yapılacak? — ADM-09
5. **Dashboard Aktivite Özeti:** kaldır mı, gerçek veriye bağla mı? — SHL-02

Sonra: demo formu satış talebi mi hesap açma mı (SHL-27) · QR ziyaretçi desteklenecek mi (ACC-27).

## 7. Doğrulanmayanlar

Worker'lar koddan çalıştı: tarayıcıda görsel/kontrast/klavye turu, canlı cihaz davranışı, gerçek veri hacmi ve
sorgu süreleri ölçülmedi. "(doğrulanmadı)" etiketli bulgular implementasyon öncesi tekrar kontrol edilmeli.

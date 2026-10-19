# C2c W-13-ui — 13 Ayarlar sayfası A2 (frontend, backend değişikliği yok)
Önce `.claude/orca-specs/c2c-common.md` (→ c2-common.md) oku. Hedef: `docs/ui-scan/pages/13-ayarlar/REPORT.md` (tüm "Yeni tasarım":
kabuk ve bilgi mimarisi, yetki/kapsam matrisi, bölüm formları, taslak ve doğrulama sözleşmesi, listeler/390px, durum metinleri,
bileşen eşlemesi) + `mockup.html`. Ek: `docs/ux-audit/` ADM-1A/1B ve Ayarlar bulguları (grep "Ayarlar", "ADM-1").

## Hedef (test edilebilir)
`/settings` A2 düzende: PageHeader (tek h1, seçili proje + bölüm kapsamı) → masaüstünde 184px sade dikey bölüm listesi, mobilde
"Ayar bölümü" etiketli select (yatay Tabs yok) → bölüm içeriği max 800px, h2 + kapsam açıklaması → her kalıcı formun sonunda açık
etiketli SaveBar (pristine'de kapalı). `?tab=` sözleşmesi korunur (geçersiz → Genel, yetkisiz → AccessDenied). Bölüm veya proje
değişiminde kirli form `useUnsavedChangesGuard` ile korunur (bugünkü taslak kaybı biter). 1440/390 yatay taşma yok; kapılar yeşil.

## İş
1. `src/pages/Settings.tsx`, `SettingsSidebar.tsx`: bölüm listesi ve sırası rapordaki gibi (Genel, Kullanıcılar ve davetler, Mesai ve
   tatil, Raporlar, Entegrasyonlar, E-posta gönderimi [yalnız süper admin], Bildirimler); rol görünürlüğü mevcut `capabilities`
   kurallarıyla — yetki GENİŞLETİLMEZ. Mesai/tatil şu an hangi bileşendeyse (WorkAndPayrollSettings, OvertimeSettingsForm,
   HolidayCalendarManager) oraya bağla; Vardiyalar için yalnız bağlantı.
2. Formlar (`GeneralSettings`, `CompanyInfoForm`, `SystemSettingsForm`, `NotificationSettings`, `OvertimeSettingsForm`,
   `ReportsSettings`): FormFieldWrapper + alan altı hata + SaveBar; her formun dirty durumu Settings'e çıkar ve bölüm/proje değişimini
   korur. RHF/zod alan isimleri DEĞİŞMEZ; mevcut mutation'lar ve payload şekli aynı (gizlenen alanlar payload'a yazılmaz, veri silinmez).
   Kaydetme `useAsyncAction`, başarı/hata `notify`, pending'de çift gönderim yok.
3. Genel: tema/dil/tarih — mevcut darkMode davranışı ÇALIŞIYORSA aynen kalır ve "Proje varsayılanı" kapsam etiketi alır; işlevsiz
   (hiçbir tüketicisi olmayan) dil/tarih/saat kontrolleri kaldırılır (grep ile tüketici yokluğunu kanıtla, raporla).
4. Kullanıcılar ve davetler: `AdminUsersPanel`'i TÜKET, değiştirme (sahibi 12; Dalga 2'de 12-ui yeniden düzenleyecek). Yalnız bölüm
   başlığı/kapsam metni senin.
5. Raporlar (`ReportsSettings`): indirme ile kişisel e-posta hatırlatması iki ayrı bölüm/state; rapordaki dürüst metinler (dosya eki
   vaat edilmez, ayın ilk günü hatırlatma). Entegrasyonlar (`BridgeIntegrationCard`, `PaftaIntegrationCard`): anahtar üret/iptal ayrı
   işlemler, ConfirmDestructive; kopyalama bildirimi yalnız clipboard başarıdan sonra; "son görülme" çevrimiçi göstergesi sayılmaz.
6. Tatil listesi (`HolidayCalendarManager`): yıl filtresi, 42px satır, tatil ekle dialog (tarih* → ad* → yarım gün), sil ConfirmDestructive.
7. Atıl dosyalar (`SettingsTabs`, `OnboardingProgress`, `StepNavigation`, `CompanySettings`, `WorkScheduleSettings`, `AdminDashboard`):
   repo genelinde tüketicisi YOKSA sil; varsa dokunma. Her silmeyi grep çıktısıyla raporla.
8. Boş/yükleniyor/hata/yetki yok durumları rapordaki Türkçe metinlerle; QuerySectionBoundary bölüm bazında; sabit renk/emoji yok
   (bayrak emojisi dahil).

## Ownership
src/pages/Settings.tsx · src/components/settings/** (yeni/silinen dosyalar dahil)

## Kapsam dışı
convex/** (backend değişikliği gerekirse DUR, ask) · src/components/admin/** (12'nin; AdminUsersPanel yalnız tüketilir) ·
src/pages/Profile* ve profil bileşenleri · tema taşıma · bildirim alanlarını birleştirme · ui|shared|layout.

## Rapor
`.claude/orca-specs/reports/c2c-13-ui.md`: değişen/silinen dosyalar (grep kanıtı), bölüm→bileşen haritası, dirty koruma akışı,
koordinatörün gerçek oturumda bakacağı akışlar (her bölüm 1440+390, kirli formla bölüm/proje değiştirme), ertelenenler.

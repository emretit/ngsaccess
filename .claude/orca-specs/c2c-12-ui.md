# C2c W-12-ui — 12 Admin sayfası A2 (frontend) + ADM-1A/1B
Önce `.claude/orca-specs/c2c-common.md` (→ c2-common.md) oku. Hedef: `docs/ui-scan/pages/12-admin/REPORT.md` (tüm "Yeni tasarım":
bilgi mimarisi ve kabuk, kolonlar/filtre/gerçek veri, durumlar ve Türkçe metinler, form ve onay sözleşmeleri, bileşen eşlemesi) +
`mockup.html`. Ek: `docs/ux-audit/` ADM-1A/1B bulguları (grep). Backend sözleşmesi (TEK kaynak): `.claude/orca-specs/reports/c2c-12-api.md`
— users.adminList / projects.adminList / projects.getDeletionImpact / adminDevices.adminListPage + hata kodları.

## Hedef (test edilebilir)
`/system-admin` (yalnız super_admin) A2 düzende: PageHeader "Admin" + global kapsam → URL'li sekmeler Kullanıcılar (varsayılan) /
Projeler / Cihaz havuzu → sekme içi StatInline → FilterBar → sunucu cursor'lı 42px tablo, 390px'te semantik liste → sekmeye göre TEK
birincil eylem (Kullanıcı davet et / Yeni proje / Cihaz kaydet). Kullanıcılar sekmesinde ayrı "Süresi dolan davetler" listesi (backend
raporu destekliyorsa). Yıkıcı işlemler rapordaki ConfirmDestructive metinleriyle (proje silmede `getDeletionImpact` etki dökümü).
Toplu işlem/BulkBar YOK. 1440/390 yatay taşma yok; kapılar yeşil.

## İş
1. `src/pages/SystemAdmin.tsx` + `src/components/admin/**`: sekmeler `?tab=` URL'de; üst çubuk proje seçimi bu global listeleri
   daraltmaz (kapsam metni açık yazar).
2. **AdminUsersPanel TEK bileşen, iki tüketici:** Admin (super_admin, tüm kullanıcılar) ve Ayarlar → "Kullanıcılar ve davetler"
   (13'ün sayfası, proje yöneticisi davet eder). Ayarlar'daki tüketimi (`src/components/settings/**` içinde import satırı) BOZMA:
   default export + props geriye uyumlu; rol bazlı davranış (super_admin değilse adminList yerine mevcut `users.list` kapsamı) bileşen
   içinde. Ayarlar dosyalarına DOKUNMA (13-ui teslim etti).
3. Formlar rapordaki sırayla: davet (e-posta → rol → zorunlu proje), kullanıcı düzenle (rol + "Bu rol tüm projelerde geçerlidir" +
   aramalı üyelik checklist + eklenen/kaldırılan özeti; rol düşürme/üyelik kaldırmada önce onay, sonra TEK `updateRole`), proje formu
   (ad zorunlu, sunucu `PROJECT_NAME_REQUIRED/TOO_LONG` alan altında; Aktif/Pasif açıklaması "aktif proje seçicisinde listelenmez"),
   cihaz Sheet (UUID 15 rakam, düzenlemede salt okunur; havuz/atama/taşıma mevcut mutation'larla). Tüm formlar dirty korumalı +
   `useProjectChangeGuard` (c2c-common).
4. Mevcut korumaları GERİ ALMA: son super_admin/kendini düşürme korumaları, atomik `updateRole`, `ConfirmDestructive` odak/pending kuralları,
   IDE kurulum kartı (`IdeProvisioningCard`) yalnız cihaz sekmesinde ikincil giriş — yeni iddia/özellik ekleme.
5. Durum rozetleri: proje Aktif success / Pasif nötr; cihaz Çevrimiçi success / Çevrimdışı nötr / Henüz görülmedi nötr; davet Süresi doldu
   warning. Doğrulanmamış metrik (son giriş, kabul oranı) YOK.
6. Boş/yükleniyor/hata durumları rapordaki Türkçe metinlerle; `AdminDataBoundary` deseni korunur.

## Ownership
src/pages/SystemAdmin.tsx · src/components/admin/** (yeni dosyalar dahil)

## Kapsam dışı
convex/** (ask) · src/components/settings/** ve src/pages/Settings.tsx (13'ün) · src/components/devices/** (Cihazlar sayfası; ClaimDeviceDialog
`adminDevices.listForClaim` tüketimi aynen kalır) · davet e-postası yeniden gönder endpoint'i (yoksa buton YOK) · ui|shared|layout.

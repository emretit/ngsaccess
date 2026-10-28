# SİSTEM AUDIT — M5 MOBİL UYGULAMA (Flutter) + ÇALIŞAN UÇLARI

ÖNCE `/Users/emreaydin/ngsaccess/.claude/orca-specs/sistem-audit-ortak.md` dosyasını OKU; oradaki kurallar (YASAK listesi dahil) bağlayıcı.

**Rapor:** `docs/sistem-audit-2026-10-25/M5-mobil.md` (yalnız bu dosyayı yazabilirsin). Bulgu ID öneki `B-`.

## Kapsam
- Mobil: `mobile/lib/**`, `mobile/test/**`, `mobile/pubspec.yaml` (yalnız OKU). İzinli: `cd mobile && flutter analyze` (salt-okuma).
  `flutter test` KOŞMA (başka oturumun WIP'i var). Build/pub get/pod YASAK.
- Backend (çalışan/mobil uçları): `convex/{employeeAuth,mobileAccess,mobileAccessGateway,mobileAttendance,mobileVisitors,employeeCheckIn}.ts`,
  `convex/lib/{mobile*,employeeAuth,requireEmployeeAccess*,checkInUx}.ts`, çalışan tarafı uçlar `convex/{leaveRequests,attendanceCorrections}.ts` +
  `convex/lib/requestRules.ts` (bunlar ve `mobile/lib/**` büyük ölçüde commit'siz WIP — "(commit'siz WIP)" işaretle, HEAD halini de karşılaştır).
- Web çalışan sayfaları: `src/pages/{CheckIn,EmployeeSetup}.tsx`.
- Eski audit: `docs/genel-akis-audit/B-pdks-rapor.md` B3/B4/B2-8 (çalışan talep/mobil) + `docs/mobile-audit/**`, `docs/mobile-release/PLAN-20261022.md`.

## Özellikle bak
- Çalışan kimlik doğrulama: token ömrü/yenileme, işten çıkmış (EMPLOYMENT_ENDED) / pasif / erişim başlangıcı gelecekte olan çalışan,
  cihaz bağlama, oturum iptali; token'ın güvenli saklanması (secure storage).
- Mobil QR erişim: QR üretimi/süresi/tek kullanımlık mı, replay, kapı yetki kontrolü bulutta (kural+zaman şablonu+kapı planı) tutarlı mı.
- Mobil ↔ backend sözleşmesi: Dart modellerinin Convex dönüş alanlarıyla eşleşmesi (alan adı, nullable, tarih formatı ms/sn, saat dilimi),
  hata kodlarının (`convex/lib/mobileErrors.ts` ↔ `mobile/lib/core/errors.dart` + error_localizer) birebir eşleşmesi, l10n eksikleri.
- Çevrimdışı/ağ hatası davranışı, yükleniyor/boş/hata durumları, router koruması (giriş yapmamış kullanıcı).
- Talepler (izin + PDKS düzeltme): aç / geri çek / sonucu gör uçtan uca; onay/red bildirimi var mı.
- Ziyaretçi davet (mobil), çalışan check-in (web /check-in) güvenliği.

## İlişkiler (bölüm 4'te mutlaka işle)
M1 (çalışan kaydı, kural üyeliği, ziyaretçi), M2 (mobil QR → kapı açma, sanal okuyucu tablet kamerası), M3 (mobil puantaj özeti/geçmiş,
izin/düzeltme talepleri → yönetici kuyruğu → hesap), M4 (oturum/yetki/denetim logu, KVKK).

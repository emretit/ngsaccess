## Görev: Ziyaretçi modülü audit'i
- Rapor dosyası: `docs/genel-audit-2026-11-03/07-ziyaretci.md` · Bulgu ID öneki: `ZIY-`
- Kapsam (backend): `convex/visitors.ts`, `visitorHosts.ts`, `mobileVisitors.ts`, ziyaretçiyle ilgili `convex/lib/*` (kart yakalama, saklama, KVKK aydınlatma), ziyaretçinin cihaza yazılması (`convex/lib/gateway/persons.ts` ilgili kısım, yalnız ziyaretçi açısından).
- Kapsam (web): `src/pages/Visitors.tsx`, `src/components/visitors/**`.
- Hik kıyası: `KIYAS.md` Temporary Pass satırı + `HIKCONNECT_SAYFALAR.md` Temporary Pass Management (PIN, QR, izin verilen geçiş sayısı, başlangıç/bitiş, durum).
- Önceki audit: `docs/mobile-audit/ziy-*.md`, `.claude/orca-specs/ziy-*.md` ve 2026-10-27 ziyaretçi audit'i (13 bulgu düzeltildi). Yeniden bulgu yazmadan önce düzeltilmiş mi kontrol et. Genel-akış Faz 2.4 (ziyaretçi bitiş saati cihaza yazılıyor mu, Hik bitişi 2037 idi) kapandı mı.
- Özel dikkat: ziyaret bitince cihaz yetkisinin gerçekten kalkması, kartın başka ziyaretçiye/çalışana çakışması, ziyaretçi KVKK verisinin saklama süresi ve imhası, host (ev sahibi) yetkisi ve proje izolasyonu, mobil ziyaretçi uçlarının yetkisi.

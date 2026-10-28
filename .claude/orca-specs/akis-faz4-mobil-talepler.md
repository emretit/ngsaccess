# FAZ 4 — Mobil çalışan talepleri (izin + PDKS düzeltme) — MOBİL EKİP İŞİ

Kaynak: `docs/genel-akis-audit/B-pdks-rapor.md` bulgu 4 (B3/B4 tabloları), `docs/genel-akis-audit/OZET.md` Faz 4.
Sahip: mobil ajan/oturum (`mobile/**` web koordinatörüne yasak). Backend HAZIR ve canlı (W1, c23926d):
- İzin: `convex/leaveRequests.ts` `submit` (:21), `withdraw` (:41), `listMine` (:53) — `employeeAuthedMutation/Query`.
- PDKS düzeltme: `convex/attendanceCorrections.ts` `submit` (:14), `withdraw` (:35), `listMine` (:47).
- Yönetici onay/red web'de var (`/leaves` Talepler sekmesi, `/pdks-records` Düzeltme talepleri).

## Hedef
Çalışan mobilden: izin talebi açar (tür, tarih aralığı, not) · eksik/yanlış okutma için düzeltme talebi açar (gün, giriş/çıkış saati, gerekçe) ·
kendi taleplerini durumuyla görür (bekliyor/onaylandı/reddedildi + red gerekçesi) · bekleyeni geri çeker. Mevcut sınırlar backend'de (≤10 bekleyen, çakışma kontrolü) — hata mesajlarını göster.
## Sonraki (ayrı iş, backend gerekir)
Onay/red sonrası çalışana bildirim (push yok; uygulama içi rozet/liste yenileme yeterli ilk dilim).
## Kurallar
Mobil ekibin kendi kapıları ve yayın akışı; commit/yayın CEO + Emre onayı.

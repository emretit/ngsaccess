# GENEL AKIŞ AUDIT — GRUP B: PDKS (puantaj) + talepler + raporlar (SALT-OKUMA)

ÖNCE oku ve uy: `/Users/emreaydin/ngsaccess/.claude/orca-specs/genel-akis-ortak.md` (yasaklar, yöntem, etiketler, rapor biçimi).
Rapor: `/Users/emreaydin/ngsaccess/docs/genel-akis-audit/B-pdks-rapor.md` (YALNIZ bu dosyayı yaz).

## Akışlar
B1. **Kurulum:** vardiya tanımı (sabit/esnek, W5.3) → vardiya ataması (toplu, W6 temizle) → PDKS kural sürümü (giriş/çıkış zorunluluğu, W5) → check point (hangi kapı/cihaz PDKS'e sayılır) → resmi tatil/izin türleri.
B2. **Günlük puantaj:** geçiş olayı (Grup A'dan devir) → PDKS günü (gece vardiyası, çift okutma, eksik okutma) → geç kalma/erken çıkma/fazla mesai → ana sayfa "bugün" sayıları → mobil çalışan kendi kaydını görür.
B3. **Düzeltme talebi:** çalışan (mobil? web?) eksik okutma için talep → yönetici onay kuyruğu (W1) → onay PDKS'i günceller → rapora yansır. Mobil talep ekranı YOK bilgisi var (`mobile/` leaveRequests/attendanceCorrections çağırmıyor) — çalışan bugün talebi NEREDEN açıyor? Kopukluğu net yaz.
B4. **İzin:** çalışan izin talebi → onay → PDKS'te izinli gün → bakiye/rapor.
B5. **Ay sonu:** raporlar (16 rapor) → Excel/CSV export (kolon seçici) → SGK/bordro çıktısı → ay içinde işten ayrılan (W2) doğru mu → ücret gizleme (project_user).
B6. **Hik-Connect kıyası:** Hik'in 19 Attendance raporu ve ayar sayfaları (`docs/hikconnect-reports/`) ↔ bizim raporlar: hangi kritik rapor/ayar eksik, hangisi fazla.

## Odak
- Yanlış puantaj (bordroya yanlış saat gitmesi) en yüksek öncelik.
- Talep/onay döngüsünün kapanması (çalışan → yönetici → sonuç → çalışana bildirim).
- KVKK: biyometrik verinin PDKS'te kullanılmaması (Faz 1) korunuyor mu.
Kapsam dışı: kapı yetkisi/senkron (Grup A); cihaz/alarm/kullanıcı yönetimi (Grup C).

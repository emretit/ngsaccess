# DENETİM 3 — K-02 W1 FIX2 (kısa, odaklı)
ÖNCE `/Users/emreaydin/ngsaccess/.claude/orca-specs/fix-denetim-ortak.md` OKU. Önceki denetim: `/tmp/tasima-k02-w1-denetim2.md`. Fix spec:
`.claude/orca-specs/tasima-k02-w1-fix2.md`. Worker raporu: `/tmp/tasima-k02-w1-fix2-rapor.md`. Rapor: `/tmp/tasima-k02-w1-denetim3.md` (≤ 50 satır).
Dosyalar: convex/lib/accessTransfer.ts convex/lib/transferGuard.ts(YENİ) convex/lib/employeeCardChange.ts convex/employees.ts convex/ideSync.ts convex/hikvisionSync.ts
convex/lib/grantStatus.ts convex/lib/hikSyncEmployee.ts convex/employeeTermination.ts convex/employeeTransfer.test.ts convex/fixF2bHikEnd.test.ts convex/hikvisionSync.test.ts.
SALT-OKUMA. Koordinatör aynı anda tam kapıyı koşuyor (tam vitest koşma; ilgili dosyaları koş).

Yalnız şunlara bak (önem sırasıyla):
1. **Canlı IDE poll (her gün çalışıyor):** `ideSync.ts` poll'daki "süresi dolmuş msxId'siz rezervasyon → pending" ve `markSent` attempts değişikliği: eski köprü (1f7da54f,
   `scripts/ide-mqtt-bridge.mjs` git geçmişi) ve yeni köprüyle; openDoor/mobil (attempts=1) ve deleteUser/permission işleri etkilenmedi mi; aynı upsert iki kez
   panele gidebilir mi (rezervasyon geri alındıktan sonra geç gelen /sent ya da /ack); poll başına ek okuma (boşta 1 index aralığı) kabul edilebilir mi.
2. **grantStatus effective kesişi:** yalnız taşınmış/aktif devir kaynağı kişide mi devreye giriyor; normal kişide effective yazımı aynen mi; yeni silme
   kuyruğa alınırken sonsuz döngü (silme → effective → silme) ya da her sync'te yeni silme şişmesi var mı; `done` devirde B'nin kartıyla karışma.
3. **İmport/döngü:** `transferGuard` gerçekten hafif mi; kalan `accessTransfer → ideSync/hikvisionSync → grantStatus → accessTransfer` döngüsünde modül yükleme
   sırasında top-level kullanım var mı (Convex bundle'da sorun çıkar mı).
4. Önceki denetimlerin kapanan maddelerinde regresyon yok mu (hızlı bak).
Karar: ENGEL / DÜZELTİLMELİ / TEMİZ.

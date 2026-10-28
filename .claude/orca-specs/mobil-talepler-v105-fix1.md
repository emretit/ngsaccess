# FIX1 — Mobil talepler (1.0.5) denetim notları

Önceki işin devamı: spec `.claude/orca-specs/mobil-talepler-v105.md` (Ownership, YASAK, Kapılar AYNEN geçerli — `git add/commit/stash/reset/checkout/restore` YOK,
`npx convex *` YOK, canlı backend/DB YOK). Denetim raporu: `/tmp/mobil-talepler-denetim.md` (ENGEL 0 / DÜZELTİLMELİ 0 / NOT 7). Önce oku.

## Hedef
Aşağıdaki 6 maddeyi kapat, her biri için test ekle; kapılar yeşil kalsın.

1. **NOT-1** `request_provider.dart` `_command`: `busy` ya da oturum-geçersiz erken dönüşte eski `commandError` kalmasın (erken dönüşte sıfırla veya
   çağıran dönüş değerine baksın); `_withdraw` eski hatayı snackbar'da tekrar göstermesin. Test: önce hatalı withdraw, sonra busy'de ikinci deneme → eski hata görünmez.
2. **NOT-2** Geri çekmede Network/Timeout (ve aşağıdaki belirsiz sınıf) hatasında da tek `refresh()`; otomatik yeniden deneme YOK. Test.
3. **NOT-3** "Belirsiz sonuç" sınıfı = NetworkError + TimeoutError + 5xx `ServerError` (560 dahil değil, mevcut transient tanımıyla tutarlı) + yanıt
   ayrıştırma `ProtocolError`. Gönderim ve geri çekmede aynı yardımcı kullanılsın. Test: 5xx ve ProtocolError'da tek istek + tek yenileme + belirsizlik metni.
4. **NOT-4** İzin notu `trim()`; boşsa `notes` alanı hiç gönderilmez (repository arg testinde `notes` anahtarı yok). Düzeltme gerekçesi zaten trim'li — kontrol et.
5. **NOT-5** İzin bitiş tarihi seçicisinin `firstDate`'i seçili başlangıç (yoksa alt sınır); başlangıç bitişten sonraya alınırsa bitiş temizlenir veya başlangıca eşitlenir.
   "Taleplerim" kartı ziyaretçi kartından farklı tema rengi kullansın (mevcut `AppTheme` paletinden; yeni renk tanımlama). Widget testi.
6. **Veri azaltma (NOT-6 ek)** `convex/leaveRequests.ts` ve `convex/attendanceCorrections.ts` `listMine`: tam doküman yerine yalnız mobilin kullandığı alanları
   döndür (`approvedBy` / `decidedBy` kullanıcı id'si çalışana gitmesin). `returns` validator'ı ekle. Mobil DTO bu alanları zorunlu tutmuyorsa değişmez; tutuyorsa gevşet.
   Backend testi: dönen nesnede `approvedBy`/`decidedBy`/`projectId` yok.

## Kapsam dışı
NOT-6'nın widget/router testi (cihazda doğrulanacak), NOT-7 (başka oturumun dosyaları — DOKUNMA: `docs/**`, `todo.md`, `brand/**`).

## Kapılar
Önceki spec'teki 9 komutun tamamı (backend 5 + mobil 4), sırayla. Testler yeşil olmadan worker_done GÖNDERME.

## Rapor
`/tmp/mobil-talepler-fix1-rapor.md`: madde başına file:line + test adı + kapı son satırları. `worker_done`'da ≤10 satır + `--files-modified` + `--report-path`.

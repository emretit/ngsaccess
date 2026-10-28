# FAZ 1-A — Düzeltme talebi yönetici kuyruğu (X-02) + silinen kişinin bekleyen talepleri (R-03)

ÖNCE `/Users/emreaydin/ngsaccess/.claude/orca-specs/fix-ortak.md` OKU; kurallar bağlayıcı. Rapor: `/tmp/fix-f1-a-talep-rapor.md`.
Kaynak: `docs/sistem-audit-2026-10-25/DOGRULAMA.md` (X-02), `ILISKILER.md` (R-03), `M3-pdks.md` (B3.3), `M5-mobil.md` §4.1.

Bağlam: Mobil 1.0.5 (commit `5de547a8`) çalışanın PDKS düzeltme talebi göndermesini sağlıyor; web'deki yönetici onay paneli
`bb7d942a` ile "mobilde talep yok" gerekçesiyle silinmiş. `src` içinde `attendanceCorrections` tüketicisi yok → talepler kimseye görünmüyor.
Backend uçları duruyor: `attendanceCorrections.listPending/approve/reject`.

## Ownership (yalnız bunlar)
`src/components/pdks/CorrectionRequestsPanel.tsx` (+ test) — `git show bb7d942a^:src/components/pdks/CorrectionRequestsPanel.tsx` ve
`...CorrectionRequestsPanel.test.tsx` içeriğinden geri yaz (git checkout/restore KULLANMA; `git show` ile oku, dosyayı yaz),
`src/pages/PDKSRecords.tsx`, `src/components/pdks/records/**` (yalnız paneli açmak için gerekiyorsa),
`convex/lib/employeeCascade.ts`, `convex/attendanceCorrections.ts`, `convex/leaveRequests.ts` (yalnız gerekiyorsa), yeni test `convex/fixF1Requests.test.ts`.
DOKUNMA: `convex/employees.ts` (Faz 0-A worker'ı yazıyor), `mobile/**`.

## Değişiklikler
1. **X-02** — Paneli geri getir, güncel API ve tasarımla uyumlu hale getir (bb7d942a sonrası değişen prop/import'ları düzelt). PDKS sayfasındaki
   "İşlemler" menüsüne **"Düzeltme talepleri"** öğesi + bekleyen sayısı rozeti (yönetim yetkisi olanlara; yetki adı backend `listPending` ile aynı olsun);
   panel Sheet/Dialog içinde açılsın. Onay/red sonrası liste yenilenir, hata kullanıcıya görünür. Mevcut PDKS testleri yeşil kalsın.
2. **R-03** — Kişi silinince bekleyen talepler kararsız kalmasın: `cascadeRemoveEmployeePII` (veya employees.remove'un çağırdığı cascade zinciri
   `lib/employeeCascade.ts`) içinde aynı kişinin
   - `attendanceCorrections` `pending` kayıtları → `status: "withdrawn"`, `decisionNote: "Kişi kaydı silindi"`, `decidedAt` = şimdi (decidedBy yok);
   - `leaves` içinde `source: "employee"` ve `status: "pending"` olan talepler → silinir (mevcut çalışan geri çekme semantiği: bekleyen talep silinir).
   Onaylı/reddedilmiş geçmiş korunur. Sınırlı okuma (index + take) kullan; sınır aşılırsa sessizce geçme, hata ver.
   `employees.ts`'e dokunmadan çözülemiyorsa `ask`.

## Kabul
- Test: yönetici bekleyen düzeltmeyi panelde görür, onaylar → `pdksRecords` yazılır; reddeder → durum değişir (mevcut backend testleri + panel testi).
- Test: bekleyen düzeltme + bekleyen izin talebi olan kişi silinince düzeltme `withdrawn`, izin talebi silinmiş, onaylı izin duruyor.
- `src/components/pdks/**` testleri, `convex/attendanceCorrections.test.ts`, `convex/leaveRequests.test.ts`, `convex/orphanGuards.test.ts` yeşil.

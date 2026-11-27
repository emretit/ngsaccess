# Ana sayfa 3. tur — D-S1
- `convex/lib/adminGuards.ts:68`: yalnız dashboardCounts/Days/Hours için `cleanup: scheduled`; feed/evidence atomik delete politikasında kaldı.
- `convex/projects.ts:114`: toplam 200 sayısal satır okuyan/silen idempotent parça; bitmediyse hook’lu internal mutation ile zamanlanmış devam, aktif projede erken dönüş.
- `convex/projects.ts:151`: sayısal tablolar 500 satır atomik sınırını atlar; PII ve diğer tablolar sınırda kalır; ilk sayısal parça proje silmeyle aynı transaction’da işlenir.
- `convex/fixF5Consistency.test.ts:222`: 60 gün / 600 sıfır saat / 60 gün satırı / 3 sayaç bulunan proje silinir; feed/evidence görevlerden önce silinir, görevler sonunda tüm dashboard tablolarında hedef proje 0, diğer proje korunur.
- `convex/fixF5Consistency.test.ts:267`: her iki PII tablosunda 501 satır için silme atomik reddedilir, proje/veriler korunur, temizlik görevi oluşmaz; eski görev tekrarı ve aktif proje koruması da test edildi.
- İlgili 4 dosya: 39/39 test; root/app/Convex TypeScript 0 hata, ESLint 0 hata / 5 mevcut uyarı, find-node-leak 0; **TAM `npx vitest run`: 563/563 dosya, 6387/6387 test geçti (49.25 sn), 0 başarısız.**
- PDKS dosyaları, AddShiftDialog, schema ve gerçek DB değişmedi; commit/push/deploy/npx convex yapılmadı.

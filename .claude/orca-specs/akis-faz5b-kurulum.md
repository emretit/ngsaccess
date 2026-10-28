# FAZ 5B — Yeni müşteri kurulum kontrol listesi (ana sayfa)

ÖNCE oku ve uy: `/Users/emreaydin/ngsaccess/.claude/orca-specs/akis-ortak.md`. Kanıt: `docs/genel-akis-audit/C-kurulum-cihaz-yonetim.md` (bulgu 5, C1 tablosu).
Rapor: `/tmp/akis-faz5b-rapor.md`.

## Hedef (test edilebilir)
Seçili projede kurulum tamamlanmamışsa yönetici (super_admin / o projenin project_admin'i) ana sayfanın EN ÜSTÜNDE 5 adımlı kurulum listesini görür;
her adım "tamam / bekliyor" + tek tıkla ilgili sayfaya gider; 5'i de tamamsa liste görünmez. project_user listeyi görmez.

## Adımlar (sunucuda hesaplanır)
1. Proje yöneticisi atandı (projede en az bir project_admin üyeliği; super_admin sayılmaz) → kullanıcı yönetimi sayfası.
2. Cihaz eklendi ve bağlandı (projede en az bir cihaz VE en az birinin `lastSeen`'i var) → /devices. İpucu: cihaz tipine göre "teknik servis gerekebilir" (Hik gateway ISUP ayarı, IDE broker'a alma) kısa metin.
3. Kişi + kart (en az bir aktif çalışan, kart numaralı) → /employees (Excel içe aktarma bağlantısı da).
4. Erişim yetkisi (en az bir aktif erişim kuralı) → /access-control.
5. İlk başarılı geçiş (projede `accessStatus === "izin_verildi"` en az bir kart okuması) → canlı akış / PDKS kayıtları. Tamamlanma ölçütü budur.

## Teknik
- Yeni sorgu `convex/projects.ts` içine (YENİ modül açma): `getSetupStatus({ projectId })` — `adminQuery` + proje kapsamı; her adım için indeksli `.first()`/`take(1)` (tam tablo okuma YOK, `.filter` yerine indeks; uygun indeks yoksa raporda yaz, schema'ya DOKUNMA, en ucuz mevcut indeksi kullan). Dönüş: `{ steps: [{ key, done }], complete }`.
- Ön yüz: yeni `src/components/dashboard/SetupChecklist.tsx`; `src/pages/Index.tsx`'te `TodayStrip`'in üstünde, yalnız yönetici + `!complete`. "Şimdilik gizle" (localStorage, proje başına) — gizlense de complete olunca zaten görünmez. A2 tasarım dili (mevcut dashboard bileşenleriyle aynı kart/tipografi), 360 px'te taşma yok, klavye ile erişilebilir, Türkçe.
- `convex/lib/hikModels.ts`: DS-K1T804 terminal olarak kataloğa (DS-K1T807 ile aynı şekil: tek kapı + tek okuyucu); bu modeli kullanan form/test varsa uyumlu.
- Testler: `getSetupStatus` (boş proje 0/5, adım adım tamamlama, başka projenin yöneticisi reddedilir, project_user reddedilir), `SetupChecklist` render (tamam/bekliyor, complete → render yok, project_user → yok), `Index.test.tsx` güncel.

## Ownership
`convex/projects.ts` (yalnız yeni sorgu), `convex/lib/hikModels.ts`, yeni `convex/projectSetup.test.ts` (veya projects testine ek), `src/pages/Index.tsx`, `src/pages/Index.test.tsx`, yeni `src/components/dashboard/SetupChecklist.tsx` + testi.
## Kapsam dışı
`convex/dashboard.ts` (başka worker olabilir) · `schema.ts` · cihaz ekleme formu · davet akışı · Windows köprüsü · yeni polling.

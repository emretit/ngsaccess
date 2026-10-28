# SİSTEM AUDIT 2026-10-25 — ORTAK KURALLAR (her modül spec'i bunu içerir)

Çalışma dizini: `/Users/emreaydin/ngsaccess` (main, HEAD `520ba5fc`). Worktree AÇMA, dal değiştirme.

## Amaç
ngsaccess'i MODÜL MODÜL incele: senin modülündeki backend (Convex), web (React) ve varsa mobil/köprü kodunda
**hatalı, eksik, yanlış, tutarsız, ölü** olanı KODDAN kanıtla. İkinci hedef: modülünün **diğer modüllerle ilişkisi**
(okuduğu/yazdığı ortak tablolar, çağırdığı fonksiyonlar, ona bağlı olanlar) — sözleşme uyumsuzluğu, kopuk zincir,
çift kaynak, yarış durumu. Hedef okuyucu Emre (teknik olmayan karar verici) + sonraki düzeltme planı.

## Önceki audit (TEKRARLAMA, DURUMUNU YAZ)
2026-10-22 akış audit'i: `docs/genel-akis-audit/{OZET,A-kisi-erisim,B-pdks-rapor,C-kurulum-cihaz-yonetim}.md`.
Sonrasında çok düzeltme girdi (Faz 1 yetki, 2A Hik geri alma, 3A puantaj, 5A alarm, 5B kurulum, cihaz taşıma,
roller, vardiya planı, PDKS ayarları, parmak izi, sanal okuyucu...). `git log --oneline -120` ile bak.
Modülüne düşen eski bulguların HER BİRİ için: **DÜZELDİ / AÇIK / KISMEN** + kanıt file:line. Yeni bulgu listesine
eski maddeyi tekrar koyma (açıksa "Eski audit durumu" bölümünde kalsın).

## Bilinçli kararlar (BULGU DEĞİL — yalnız "çelişki varsa" yaz)
- `project_user` web'den kapı açabilir (59282e5). Roller: 5 sabit rol × 13 yetki, proje bazlı (`convex/lib/roleCatalog.ts`).
- KVKK: biyometrik (yüz/parmak) olaylar PDKS/puantaja GİRMEZ (`convex/lib/pdksSource.ts`) — kasıtlı.
- Windows köprüsü (DS-K2804, `bridge/windows`) ürün olarak ERTELENDİ; roster route'u kota yüzünden kaldırıldı. Yalnız
  "aktif koddan hâlâ çağrılıyor/kırık bağ" varsa yaz.
- IDE poll kapatıldı/backoff'lu (kota). `notable-tern-4` dev deployment canlı sistemdir.
- shifts/departments yazma uçlarının yöneticiye kısıtlanması "sonra" diye ertelendi — açıksa "Eski audit durumu"nda AÇIK yaz.

## Çalışma ağacı uyarısı
Commit'siz değişiklikler BAŞKA OTURUMUN yarım işidir (mobil talepler: `convex/{attendanceCorrections,leaveRequests}.ts`,
`convex/lib/requestRules.ts`, `mobile/lib/**`). Bunları OKU ama bulguda "(commit'siz WIP)" diye işaretle.
`git diff HEAD -- <dosya>` ile ayırt et. Bu dosyalara DOKUNMA.

## YASAK (ihlal = iş geçersiz)
- Rapor dosyan DIŞINDA hiçbir dosya yazma/düzenleme/silme. `git add`, `git commit`, `git stash`, `git checkout`, `git reset`,
  `git restore`, `git switch` YASAK. (Önceki bir Codex worker spec'e rağmen commit attı — atma.)
- push/deploy · `npx convex *` / convex CLI · DB okuma/yazma · Supabase MCP (Pafta'nın canlı DB'si — DOKUNMA) ·
  cihazlara/ağa istek · paket kurma · tarayıcı · Netlify.
- İzinli doğrulama (salt-okuma): `node_modules/.bin/tsc --noEmit -p tsconfig.app.json`, `node_modules/.bin/eslint <yol>`,
  hedefli `node_modules/.bin/vitest run <dosya>` (TAM suite koşma — 5 worker paralel), `flutter analyze` (yalnız mobil worker).

## Yöntem
1. Modül haritası çıkar: dosyalar, sahip olduğu tablolar (`convex/schema.ts`), public/internal fonksiyonlar, cron/scheduler,
   HTTP route'ları, web sayfa/bileşenleri, mobil ekranları.
2. Her public fonksiyon için kontrol: yetki (rol + proje kapsamı + `requireProjectAccess` benzeri), girdi doğrulama,
   hata yolu kullanıcıya görünüyor mu, sınır/kota (take/paginate, döngüde sorgu, `.collect()` büyük tablo), index kullanımı,
   tip güvenliği (`any`, `!`, `filter(Boolean)` — CLAUDE.md kuralları), `convex/_generated/ai/guidelines.md` ihlali.
3. Web ↔ backend sözleşmesi: UI'ın çağırdığı fonksiyon var mı / argümanları eşleşiyor mu; backend'de olup hiçbir yerden
   çağrılmayan public fonksiyon (ölü kod) var mı (`grep -rn "api.<modül>.<fn>" src mobile convex`); UI'ın gizlediği ama
   backend'in izin verdiği işlem (veya tersi).
4. İş mantığı: hesap/karar doğru mu (gece yarısı, saat dilimi UTC+3, tatil, sınır değerler, silinmiş kayıt, pasif çalışan,
   çok proje). Silme/değiştirmede bağlı kayıtlar (cascade/orphan) ne oluyor.
5. Modüller arası: ortak tabloyu senin dışında kim yazıyor/okuyor; alan anlamı iki tarafta aynı mı; bir modüldeki
   değişiklik diğerini haberdar ediyor mu (örn. kişi pasifleşince cihaz/PDKS/mobil).
6. Emin olmadığın yerde **OLASI** veya **TEYİT GEREK (canlı/cihaz)** yaz; tahmini kesin gibi sunma.

## Önem ve tür
- **P0** güvenlik/yetki açığı, projeler arası sızıntı, veri kaybı, yanlış para/puantaj, erişimin geri alınamaması.
- **P1** işlev bozuk/kullanıcı işi bitiremez, sessiz hata, kota/performans riski.
- **P2** eksik/tutarsız davranış, yanıltıcı UI, test boşluğu kritik yolda.
- **P3** temizlik: ölü kod, tekrar, isimlendirme, tip zayıflığı.
- Tür: HATA · EKSİK · YANLIŞ (hesap/karar) · TUTARSIZ (iki yer farklı) · YETKİ · PERF/KOTA · ÖLÜ KOD.
- Emek: S ≤2 sa · M ≤1 gün · L >1 gün. Güven: KESİN (kodda kanıtlı) / OLASI.

## Rapor (yol modül spec'inde) — Türkçe, SADE (jargonu parantezde açıkla), ≤ 450 satır
1. **Sonuç (2-3 cümle)** + sayım (P0/P1/P2/P3).
2. **Modül haritası** (kısa tablo: alan → dosyalar → tablolar → sayfa/ekran).
3. **Bulgular** tablosu, önem sırasına göre, en fazla 30 satır:
   `ID (ör. K-01) | Önem | Tür | Yer (file:line) | Ne oluyor (kullanıcı gözünden) | Kanıt (kısa) | Öneri | Emek | Güven`
4. **Modüller arası ilişkiler**: (a) bu modülün dışarıya verdiği/aldığı arayüzler tablosu
   `Karşı modül | Bağ (tablo/fonksiyon) | Yön | Sorun var mı (file:line)`; (b) sözleşme/zincir sorunları listesi.
5. **Eski audit durumu**: `Eski madde | DÜZELDİ/AÇIK/KISMEN | Kanıt`.
6. **Test boşlukları** (kritik yol, testi olmayan; en fazla 8).
7. **TEYİT GEREK** (canlı/cihaz) ve **Kapsam dışı bıraktıkların**.

`worker_done` özetinde ≤10 satır: sayım, en önemli 3 bulgu (file:line), rapor yolu. `--outcome succeeded`.

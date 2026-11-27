# Kişiler smoke testi — yerel boş Convex (item #319)

## Hedef
Main'deki commit'siz Kişiler değişikliklerini, CANLIYA DOKUNMADAN, yerel bir Convex backend + ayrı vite sunucusu
üzerinde Orca tarayıcısında uçtan uca dene; her akış için geçti/kaldı + kanıt (ekran görüntüsü) raporla.

## KESİN YASAKLAR (canlı = notable-tern-4)
- `/Users/emreaydin/ngsaccess` içinde HİÇBİR dosyaya yazma (özellikle `.env.local`, `convex/_generated`). `npx convex ...`
  komutunu ana dizinde ÇALIŞTIRMA — `convex dev` ana dizinde koşarsa canlıya push eder.
- notable-tern-4'e hiçbir istek/push yok. Kopyada `.env.local`'i ilk iş olarak yerel deployment'a çevir, sonra doğrula:
  `grep CONVEX /tmp/ngs-smoke/.env.local` içinde `notable-tern` GEÇMEMELİ. Geçiyorsa DUR, raporla.
- commit/push/deploy/migration YOK. Port 8081'deki sunucuya dokunma (Emre'nin). Emre'nin tarayıcı sekmelerine dokunma.

## Kurulum (~20 dk)
1. Çalışma kopyası (commit'siz değişiklikler dahil):
   `rm -rf /tmp/ngs-smoke && mkdir /tmp/ngs-smoke && rsync -a --exclude node_modules --exclude .git --exclude dist /Users/emreaydin/ngsaccess/ /tmp/ngs-smoke/`
2. `.env.local`'den `CONVEX_DEPLOYMENT` ve `VITE_CONVEX_URL` satırlarını SİL (diğer anahtarlar kalsın), `cd /tmp/ngs-smoke && npm ci`.
3. Yerel backend: `cd /tmp/ngs-smoke && npx convex dev --local --once` (gerekirse `--configure new`/`--local` sorularını yerel seç;
   etkileşim gerekiyorsa `CONVEX_AGENT_MODE=anonymous npx convex dev --once` dene). Sonra `.env.local` yerel URL'i gösteriyor mu doğrula (yasak §2).
   Sürekli açık backend için arka planda `npx convex dev --local` (kopyada).
4. Auth: yerel deployment'a Convex Auth env'lerini kur (JWT_PRIVATE_KEY, JWKS, SITE_URL=http://localhost:8082) —
   `npx @convex-dev/auth` veya repo'daki dokümana göre (`docs/` içinde ara). Canlı env değerlerini KOPYALAMA, yenisini üret.
5. Web: `cd /tmp/ngs-smoke && npx vite --port 8082 --strictPort`.
6. Seed: uygulama üzerinden test hesabı kaydı (smoke@test.local + rastgele şifre, şifreyi rapora yazma), proje oluştur,
   2-3 departman (biri alt departman), Excel/form ile ~8 test kişisi (kartlı, kartsız, pasif, geçerlilik bitişli).
   UI ile mümkün değilse kopyada `npx convex run` ile internal seed — yalnız yerel deployment'a.

## Tarayıcı
Orca tarayıcısı: `orca tab create --url http://localhost:8082/ --json`, dönen browserPageId'yi HER komutta `--page` ile ver.
Tıklama: `orca click --element @ref` güvenilmez → eval ile getBoundingClientRect merkezi + `orca mouse move/down/up`.
Ekran görüntüsü: `orca screenshot --page <id> --json` → base64 PNG → `/tmp/ngs-smoke-shots/NN-ad.png`.

## Akışlar (her biri geçti/kaldı + ekran görüntüsü)
1. Kişiler listesi açılıyor (`employees:listSummary`); sıralama (ad, departman, kart vb.), arama, durum filtresi, alt departman filtresi.
2. Kişi ekle: kartlı · kartsız · geçersiz kart (anlamlı hata mesajı) · TC tekilliği (aynı TC ikinci kez reddedilmeli).
3. Kişi düzenle: isim değişimi, kart ekleme (kartsız kişiye), kart değişimi, geçerlilik bitişi.
4. Toplu işlem: departman değişimi → şirket alanı da güncelleniyor mu (F03).
5. Excel: şablon indir → 'Aktif: Hayır' + kartsız satır ile içe aktar → pasif kalıyor mu (F01), kartsız oluşuyor mu (F07).
6. Kişi ayrıntısı: sayfa açılıyor (getById), cihaz teslim kartı görünüyor (cihaz yoksa boş durum mesajı), yüz kartı güncel kartı gösteriyor (F10).
7. Silme / pasifleştirme.
8. 390px mobil: liste + ayrıntı (kendi sekmende iframe yöntemi; `orca set device` KULLANMA).
Konsol hatalarını her akışta topla (`orca exec --page <id> --command console`).
Cihaz (Hik/IDE) senkronu yerelde test edilemez → "kapsam dışı" yaz.

## Bitirince
- vite ve yerel convex süreçlerini durdur; `/tmp/ngs-smoke` kalsın (koordinatör tekrar bakabilir).
- Rapor: `docs/kisiler-audit/SMOKE_LOCAL_2026-11-27.md` — BU TEK DOSYAYI ana dizine yazabilirsin. Akış tablosu, kaldıysa
  adım + beklenen/gerçek + dosya:satır tahmini, konsol hataları, ekran görüntüsü yolları.
- `worker_done`: ≤10 satır, kalan akışlar dosya:satır.
- Kod düzeltme YAPMA; yalnız raporla.

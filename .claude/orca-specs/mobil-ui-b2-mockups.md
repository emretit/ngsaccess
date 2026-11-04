# Mobil UI — B2: Yön B kalan ekran mockup'ları

## Hedef (test edilebilir)
`docs/mobile-ui-audit/directions/B/` altında DESIGN_B.md §5'teki her ekran/durum için 390×844 statik HTML + `_shots/B-*.png`
vardır ve `directions/B/index.html` hepsini tek sayfada (ekran grubu başlıklarıyla) gösterir. D2/D3 worker'ları bu görselleri
hedef görünüm olarak kullanacak. Kod (mobile/**) DEĞİŞMEZ — aynı anda D1 worker'ı mobile/ üzerinde çalışıyor, ona dokunma.

## Kaynak
- `docs/mobile-ui-audit/DESIGN_B.md` (§1-3 token/ölçü, §4 bileşenler, §5 ekran düzenleri, §6 metinler) — birebir uy.
- Mevcut B ekranları: `directions/B/{home,history,qr,home-dark}.html` (stil temeli; ortak CSS'i `directions/B/_b.css` olarak çıkarabilirsin).

## Çizilecek ekranlar (açık tema; * olanlar koyu da)
1. Açılış: yükleniyor, hata
2. Giriş*: boş, hata ("Mobil erişiminiz kapatıldı" + sonraki adım), giriş yapılıyor
3. Şifre yardımı
4. Ana Sayfa: yükleniyor (iskelet), hata, bugün kayıt yok (boş)
5. QR: Tara sekmesi (kamera çerçevesi, izin yer tutucusu ayrı), QR süresi doldu
6. Kapı seçimi: dolu (seçili satır), boş
7. Kapı kurtarma diyaloğu
8. Geçmiş: Takvim, Özet, filtre sheet açık, kayıt ayrıntısı sheet, boş
9. Talepler*: liste (izin + düzeltme sekmesi), boş; İzin formu* (dolu + alan hatası), Düzeltme formu, geri çekme onayı
10. Ziyaretçiler*: liste, boş, yükleme hatası; Ziyaretçi formu* (dolu, klavye açıkken yapışkan eylem çubuğu), ayrıntı sheet, iptal onayı
11. Profil*: ana sayfa, tema seçici sheet

Toplam ~40 görünüm. Her biri ayrı HTML (`B/<ekran>-<durum>[-dark].html`); sheet/diyalog arka planında ilgili ekran soluk görünür.

## Kurallar
- Veri ve metinler DESIGN_B §6 yeni metinleri + W3 verisi (Ayşe Yılmaz, NGS Teknoloji — Merkez, 4 Kasım Çarşamba …). Ünlem/emoji/"→" yok.
- Bant yalnız Açılış, Giriş, Ana Sayfa. Dolu bordo buton ekranda en fazla 1. Gölge yalnız §1'de izinli yerlerde.
- Harici kaynak yok, sistem fontu, yatay taşma 0, dokunma hedefleri ≥48px.
- Playwright (`/Users/emreaydin/pafta/node_modules/playwright`) ile her HTML'nin PNG'si (DPR2) `_shots/B-<ad>.png`; en az 10'unu
  view_image ile aç ve tutarlılık kontrolü yap (aynı bileşen her ekranda aynı mı).
- Mockup çizerken DESIGN_B'de eksik/çelişkili bir şey bulursan DESIGN_B.md'yi DEĞİŞTİRME (D1 ona göre kod yazıyor); `directions/B/GAPS.md`
  dosyasına yaz (bölüm, sorun, önerilen düzeltme).

## Ownership (yalnız bunlara yaz)
- `docs/mobile-ui-audit/directions/B/**` (mevcut 4 HTML'yi bozmadan), `docs/mobile-ui-audit/directions/_shots/B-*.png`

## YASAK
- `mobile/**`, `src/**`, `convex/**`, `DESIGN_B.md` değişmez.
- `git add`, `git commit`, `git stash`, `git reset`, `git checkout -- <dosya>`, `git restore` ÇALIŞTIRMA. Commit/push/deploy YOK.

## Rapor (worker_done, ≤10 satır)
HTML/PNG sayısı · index yolu · GAPS.md bulgu sayısı (varsa en önemli 3) · görsel kontrol sonucu.

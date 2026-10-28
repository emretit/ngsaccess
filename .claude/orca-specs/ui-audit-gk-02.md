# Geçiş Kontrol UX/UI audit — sekme 02 "Zaman Şablonları" (http://localhost:8081/access-control?tab=templates)

## Hedef
NGS Plus web uygulamasında Geçiş Kontrol sayfasının **"Zaman Şablonları"** sekmesi için UX/UI + kullanıcı dostu olma denetim
raporunu `docs/ui-audit-gk/02-zaman-sablonlari.md` dosyasına yaz. Rapor + ekran görüntüleri yazılınca iş biter. Kod DEĞİŞTİRİLMEZ.

## Bağlam
- Sayfa 4 sekmeli: Kurallar (koordinatör denetliyor) · Zaman Şablonları · Yetki Durumu · Kapı Planları. Sen yalnız "Zaman Şablonları" sekmesini denetlersin.
- Kullanıcı profili: bina/şantiye/fabrika yöneticisi, teknik değil. Hik-Connect (Hikvision portalı) alışkanlığı olabilir.
  "Kullanıcı dostu" sorusu: teknik olmayan biri bu sekmede amacını anlar mı, işini kaç adımda bitirir, takıldığında ne yapacağını bilir mi?
- Önceki audit: `docs/ui-audit-2/05-gecis-kontrol.md` (2026-10-19, o zaman yalnız Kurallar vardı). Eski bulguyu tekrar yazma.
- Tasarım dili: `docs/ui-scan/DESIGN_DIRECTION.md` + `docs/ux-audit/DESIGN_SYSTEM.md` ("A2 bileşenleri"). Ortak bileşenler `src/components/shared/`.
- Sekme giriş noktası: `src/components/access-control/unified/UnifiedAccessControl.tsx` → `src/components/access-control/unified/templates/` (TemplatesPage, TemplateEditor, TemplatePicker, WeekPreview, RuleScheduleSummary). Bileşenleri ve çağırdığı Convex sorgularını (`convex/`) buradan izle.
- Zaman şablonu = kişinin hangi gün/saatlerde geçebileceği (kurala bağlanır). Kapı planı (Kapı Planları sekmesi) kapının kendisinin açık/kilitli/doğrulama modudur; ikisi karıştırılmamalı.
- Senaryolar:
  S1. "Hafta içi 08:00-18:00, cumartesi 08:00-13:00" şablonu oluştur (kaydetme).
  S2. Var olan bir şablonu düzenle: hangi kuralların etkileneceğini ve cihazlara ne zaman gideceğini anlayabiliyor musun?
  S3. Kurallar sekmesindeki kural sihirbazının 3. adımında "Şablon kullan" → şablon seç / "şablonu düzenle" yoluyla bu sekmeye geçiş (CreateRuleDialog + TimeSchedule + TemplatePicker).
  S4. Gece vardiyası (22:00-06:00) gibi geceyi aşan saat girilirse ne oluyor?

## Tarayıcı (Orca gömülü tarayıcı; oturum açık, aktif proje NGS)
- Kendi sekmeni aç, kullanıcının sekmelerine DOKUNMA:
  `orca tab create --url "http://localhost:8081/access-control?tab=templates" --worktree current --json` → dönen `result.browserPageId`.
  Masaüstü için bir sekme, mobil için ikinci sekme; mobil sekmede `orca set device --page <id> --name "iPhone 12"` (390px).
- HER orca komutunda `--page <id>` ver (vermezsen kullanıcının aktif sekmesine gider).
- Ekran görüntüsü: `orca screenshot --page <id> --json` → `result.data` base64 PNG → `docs/ui-audit-gk/02-zaman-sablonlari/` altına kaydet, aç ve bak.
- Tıklama: `orca click --element @ref` GÜVENİLMEZ. Şunu kullan: `/tmp/orcaclick.sh <pageId> "<JS ifadesi, elemanı döndürür>"`
  (ör. `/tmp/orcaclick.sh $P "[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Yeni şablon')"`). Tıklamadan sonra ~1.5 sn bekle.
- Input doldurma (React): `orca eval --page $P --expression "(()=>{const el=document.getElementById('x');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,'deneme');el.dispatchEvent(new Event('input',{bubbles:true}));return 1})()"`
- Sayfa `main` içinde kayar: `orca eval --page $P --expression "document.querySelector('main').scrollTop=800"`.
- Mobil ekran görüntüsünde dikeyde 3 kez tekrar sorunu var; yalnız ÜST parça (~312 CSS px) gerçek. Kaydırarak birden çok çek.
- İş bitince açtığın sekmeleri kapat: `orca tab close --page <id> --json`.

## Kontrol listesi
1. Görev akışları (en önemli): aşağıdaki "Senaryolar"ı ekranda baştan sona yürü (kaydetmeden). Her biri için adım sayısı,
   takıldığın yer, belirsiz kelime, eksik yönlendirme (boş durum, ipucu, sonraki adım bağlantısı).
2. Ekran: masaüstü (1440px) ve 390px mobil. Hiza, boşluk, tipografi, A2 tutarlılığı, taşma, boş/yükleme/hata durumları.
3. Etkileşim: her buton/menü/filtre/dialog ne yapıyor, çalışıyor mu; klavye (Tab/Escape), odak, kaydedilmemiş değişiklik uyarısı.
4. İçerik: Türkçe metin (anlaşılırlık, teknik jargon, tutarlı terim: kural/şablon/plan/kapı/panel/cihaz), sayı doğruluğu, tarih/saat UTC+3.
5. Sekmeler arası: diğer sekmelerle terim ve bileşen tutarlılığı; diğer sekmelere/sayfalara gerekli bağlantılar var mı.
6. Kod: UI hataları, erişilebilirlik (aria, rol, 44px dokunma hedefi), gereksiz/ağır sorgu, tutarsız bileşen kullanımı.

## Yasaklar (canlı veri! localhost canlı Convex'e bağlı)
- Kod/dosya DEĞİŞTİRME; yalnız rapor + ekran görüntüleri. `git add` / `git commit` / push / deploy YASAK. Convex mutation / `npx convex run` YASAK.
- Kaydet / Sil / Onayla / Gönder / Kopyala / Uygula / "cihaza gönder" ya da veri değiştiren HİÇBİR düğmeye BASMA (onay dialoğunu açmak serbest, sonra Vazgeç/Escape).
  Form açmak, alan doldurmak, adımlar arası gezinmek serbest; sonunda Vazgeç/Escape ile çık, "kaydedilmemiş değişiklik" uyarısında çıkışı seç.
- Aktif proje seçicisini değiştirme. Şifre girme. Dev sunucusunu yeniden başlatma.

## Rapor biçimi (Türkçe, sade dil; jargonu parantezle açıkla)
1. Üstte 2-3 cümle özet + sayı tablosu (Yüksek / Orta / Düşük).
2. "Senaryolar" bölümü: her senaryo için adım sayısı + takılma noktaları (2-4 satır).
3. Bulgular tablosu, önemliler önce, en fazla 20: `ID (02-H1, 02-O1, 02-D1)` | önem | kategori | ne görülüyor | neden sorun | öneri | kanıt (`file:line` veya ekran görüntüsü).
   Kanıtı olmayan bulgu yazma; tahminse "doğrulanmadı" de.
4. "Hızlı düzeltmeler" (her biri ≤30 dk).
5. "Ürün kararı gereken" sorular (en fazla 3, her biri 2-3 seçenekli).

## worker_done
≤10 satır: Yüksek bulguların tek satırlık listesi + rapor yolu. `--report-path docs/ui-audit-gk/02-zaman-sablonlari.md`.

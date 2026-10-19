# C2c W-10-ui — 10 İzinler sayfası A2 (frontend)
Önce `.claude/orca-specs/c2c-common.md` (→ c2-common.md) oku. Hedef: `docs/ui-scan/pages/10-izinler/REPORT.md` (tüm "Yeni tasarım":
bilgi mimarisi, kolonlar ve 390px, filtre ve durum sözleşmesi, form ve detay, PDKS etkisi metinleri, boş/yükleniyor/hata) + `mockup.html`.
Backend sözleşmesi (TEK kaynak): `.claude/orca-specs/reports/c2c-10-api.md` — leaves.listPage / summary / update / create hata kodları /
employeeOptions (varsa).

## Hedef (test edilebilir)
`/leaves` A2 düzende: PageHeader (tek birincil "İzin ekle", yalnız admin) → FilterBar (kişi, tür, dönem = İstanbul geçerli ay varsayılan +
özel aralık; URL'de; filtre/proje değişince cursor sıfır) → `listPage` ile cursor'lı 42px tablo (kişi adı = ayrıntı düğmesi, ⋯ menüsü),
390px'te aynı sorgudan semantik liste → ayrıntı Sheet'i (kişi/departman, tür/durum, tarih/takvim süresi, açıklama, PDKS açıklama metni,
admin "Düzenle", herkes "PDKS kayıtlarını aç") → ekle/düzenle formu (560px Dialog, mobilde 100dvh Sheet, tek sütun, dirty korumalı).
Toplu seçim/BulkBar YOK. 1440/390 yatay taşma yok; kapılar yeşil.

## İş
1. `src/pages/Leaves.tsx` (bugün 340 satır tek dosya) → `src/components/leaves/**` altına bölünür: liste, filtreler, ayrıntı, form,
   `lib/` (durum/tür etiket eşlemesi, dönem hesapları + testler). Durum: Onaylı success · Beklemede warning (legacy) · Reddedildi danger;
   renk tek bilgi taşıyıcı değil.
2. Form: Kişi → Tür → Başlangıç/Bitiş → hesaplanan takvim süresi → Açıklama → etki metni → İptal/Kaydet. Alan altı hata metinleri rapordaki
   gibi; sunucu hata kodları (`LEAVE_OVERLAP` vb.) alan/üst hata olarak eşlenir, çakışmada çakışan kaydın aralığı + "Kaydı aç" bağlantısı.
   Düzenle: kişi sabit, yalnız approved; `expectedUpdatedAt` gönderilir, `LEAVE_STALE` → "Kayıt başka bir yerde değişti; yenileyip tekrar
   deneyin."; notes temizleme backend sözleşmesiyle (null). Kaydederken form kilitli, hata olursa açık kalır, değerler korunur.
3. Liste: sayaç yalnız `summary.truncated=false` iken kesin ("N kayıt · M kişi"), aksi halde "25 kayıt gösteriliyor"; dönem filtresi kaydın
   süresini kısaltmaz. Kişi artık yoksa "Personel bulunamadı" + tarih/tür korunur.
4. "PDKS kayıtlarını aç": `/pdks-records` hedefinin URL filtre sözleşmesini oku (`src/components/pdks/**` grep). Kişi+dönem parametresi
   destekleniyorsa bağla; desteklenmiyorsa yalnız sayfaya git + metinde kişi/dönemi göster, vaat etme. PDKS dosyalarına DOKUNMA.
5. Boş/yükleniyor/hata/yetki yok/proje seçilmemiş durumları rapordaki Türkçe metinlerle; QuerySectionBoundary bölüm bazında. Proje değişiminde
   açık taslak → koruma sorusu (Router v7 dersi: c2c-common).

## Ownership
src/pages/Leaves.tsx · src/components/leaves/** (yeni)

## Kapsam dışı
convex/** (ask) · Vardiyalar takvimindeki izin gösterimi (`src/components/shifts/**`) · PDKS sayfaları · saatlik/yarım gün · bakiye · ui|shared|layout.

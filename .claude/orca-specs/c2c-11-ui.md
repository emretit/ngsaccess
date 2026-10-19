# C2c W-11-ui — 11 Denetim Kaydı sayfası A2 (frontend)
Önce `.claude/orca-specs/c2c-common.md` (→ c2-common.md) oku. Hedef: `docs/ui-scan/pages/11-denetim-kaydi/REPORT.md` (tüm "Yeni tasarım":
bilgi mimarisi ve eylemler, kolon sözleşmesi, filtre ve cursor davranışı, arama/maskeleme/rol, durum metinleri, ayrıntı paneli) + `mockup.html`.
Backend sözleşmesi (TEK kaynak): `.claude/orca-specs/reports/c2c-11-api.md` — `auditLog.actorOptions` + `list`'in yeni `actor: "system"` arg'ı.

## Hedef (test edilebilir)
`/audit-log` (gerçek rota adını App.tsx'ten doğrula) A2 düzende: PageHeader ("Denetim Kaydı" + kapsam satırı; süper admin için ayrı
"Tüm projeler" anahtarı) → FilterBar (görünür arama 300ms debounce + URL `q`; kullanıcı [actorOptions: tarihsel aktörler + "Sistem"],
eylem, varlık; ikinci satır başlangıç/bitiş + temizle) → sonuç çizgisi ("N eşleşen kayıt yüklendi · Daha fazla kayıt olabilir",
"En yeni önce" / "Uygunluk sırası") → sakin 42px olay tablosu (tek işlem "Ayrıntı") → ayrıntı paneli (720px, mobilde tam genişlik,
önce/sonra karşılaştırması erişilebilir, `targetId` tam değer + Kopyala) → alt bilgi + "Daha fazla yükle". Dışa aktarma butonu YOK.
Form/mutasyon/BulkBar YOK. 1440/390 yatay taşma yok; kapılar yeşil.

## İş
1. `src/pages/AuditLog.tsx` (503 satır) → `src/components/audit/**` altına bölünür (filtreler, tablo/mobil liste, ayrıntı paneli, URL
   state hook'u). Mevcut `auditLabels.ts` ve `AuditChangeDetail.tsx` yeniden kullanılır; `AuditChangeDetail`'in dışa açık props'u
   başka yerde (PDKS `PDKSAuditTimeline`) kullanılıyorsa geriye uyumlu kalır (grep ile doğrula).
2. **"Filtreleri temizle" proje kapsamını KORUR** (ADM-29 kararının bilinçli revizyonu): kullanıcı/eylem/varlık/tarih/q sıfırlanır,
   allProjects ve seçili proje kalır. Proje/kapsam değişiminde kullanıcı filtresi ve cursor sıfırlanır; eski projenin satırları yeni
   kapsam altında gösterilmez.
3. Kullanıcı filtresi: `actorOptions` — label + durum alt metni (Silinmiş kullanıcı vb. backend raporundaki etiketlerle); "Sistem"
   seçilince `list({ actor: "system" })`, userId gönderilmez (sahte ID yok). `truncated` iken seçici altında dürüst kısa not.
4. Tarih: başlangıç dahil İstanbul 00:00, bitiş dahil gün sonu; ters aralıkta alan altı hata "Başlangıç tarihi bitiş tarihinden sonra
   olamaz." + `aria-describedby`, query atılmaz, sahte sıfır gösterilmez.
5. Mevcut davranışları KORU: ilk sıfır eşleşmede en çok 5 otomatik devam, `LoadingMore` sırasında satırlar kalır ve çift istek yok,
   project_user için "Denetim kaydını görüntüleme yetkiniz yok." ve query mount edilmez, searchText'siz eski kayıtlar için arama
   kapsamı açıklaması.
6. Boş/yükleniyor/hata/yetki yok/proje seçilmemiş durumları rapordaki Türkçe metinlerle; QuerySectionBoundary bölüm bazında.

## Ownership
src/pages/AuditLog.tsx · src/components/audit/** (yeni dosyalar dahil)

## Kapsam dışı
convex/** (ask) · PDKS bileşenleri (`src/components/pdks/**`) · dışa aktarma · ui|shared|layout.

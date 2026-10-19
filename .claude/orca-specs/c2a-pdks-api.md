# C2a W-pdks-api — 08 PDKS Kayıtları backend (B3): kapsam, gün durumu, biyometri ayrımı, zorunlu gerekçe
Önce `.claude/orca-specs/c2-common.md` ve `convex/_generated/ai/guidelines.md` oku. Bağlam: `docs/ui-scan/pages/08-pdks-kayitlari/REPORT.md`
("Veri sözleşmesi ve backend gereksinimi", PDKS-UI-06/15/16/18/19/20/21), `docs/PDKS_AUDIT_VE_PLAN_2026-10-16.md` Faz 1 madde 1.
Bu worker'ın çıktısını 08 frontend worker'ı tüketecek; sözleşmeyi raporda kesin yaz.

## Hedef (test edilebilir)
PDKS hesapları (tablo, puantaj, grafik, gün detayı, bordro cetveli, SGK/APHB, zamanlanmış rapor, dashboard aktivite, asistan veri
yükü) biyometrik doğrulamalı okumalardan **hiç kayıt üretmez**; tüm PDKS sorguları opsiyonel `projectId` ile başlıktaki projeye
kapsanır; günlük satır da hafta tatili/resmî tatil/gelecek/veri yok ayrımını ve sayısal süreleri döner; manuel düzeltmede gerekçe zorunlu.
Vitest ile kanıtlanır.

## İş
1. **Kaynak sınıflandırma (KVKK 2026/921 — açık rızayla bile mesai takibinde biyometri yasak):** yeni saf modül
   `convex/lib/pdksSource.ts` → `classifyReadingSource(reading): "card" | "pin" | "qr" | "mobile" | "manual" | "biometric" | "unknown"`
   ve `isPdksEligibleReading(reading): boolean`. Kaynak: `hikCurrentVerifyMode` (ör. face/fingerPrint/cardOrFace…),
   `hikMajorEventType`/`hikSubEventType` (`convex/lib/hikEventCatalog.ts` alt kodları: yüz/parmak doğrulandı vs kart doğrulandı),
   IDE Smart (kart/PIN), QR/mobil check-in kayıtları (`employeeCheckIn.ts`, `http.ts` /card-reader nasıl yazıyor — oku).
   Kural: biyometrik faktörün katıldığı her olay (yalnız yüz, kart+yüz, parmak…) PDKS-dışı; kararsız Hikvision olayı biyometri
   varsayılmaz ama `unknown` kalır ve raporda sayılır. Ham erişim kaydı (`cardReadings`) SİLİNMEZ/DEĞİŞMEZ: Canlı İzleme ve
   erişim logu aynen görür; ayrım yalnız PDKS hesap katmanında. Ingest'e dokunma (07 C2b'de).
2. Filtreyi tek noktadan uygula: PDKS okumalarını yükleyen her yolda (getPdksTableData, getPdksChartData, getMonthlyPayrollSheet,
   getEmployeeAttendanceDetail, sgkExport, lib/reportAttendance, dashboard aktivite özeti, actions/getChatData PDKS bölümü) okuma
   listesi hesap motoruna girmeden `isPdksEligibleReading` ile süzülür. Mümkünse ortak yükleyiciye koy; her çağrı yerinde kopya yok.
3. **Proje kapsamı:** bu sorgulara `projectId: v.optional(v.id("projects"))` ekle; verilirse `resolveProjectScope`
   (`convex/lib/projectScope.ts`) ile yetki doğrulanır ve yalnız o proje okunur (super_admin dahil); verilmezse bugünkü davranış
   (geriye uyum). Ayar/tatil/vardiya referansı verilen projeden alınır (`referenceProjectId`). getMonthlyPayrollSheet proje/ay kapsamı
   kazanır; APHB mevcut projectId desteği korunur.
4. **Gün durumu tek sözleşme (`convex/lib/pdksTable.ts`):** tek gün de matrix gibi sınıflandırılsın: `present | late | absent |
   leave | weekend | holiday | future | noData` (isimler senin kararın, raporda yaz). Bugünden sonraki gün `future` (devamsızlık
   üretme); veri dönmeyen geçmiş hücre `noData`; `absent` yalnız çalışma günü + izin/tatil yok + PDKS-uygun okuma yok iken.
   Satıra sayısal `totalMinutes`/`overtimeMinutes` ekle (mevcut string alanlar kalabilir — eski UI). İzin türü (`leaveType`) varsa
   satır/hücreye. Yönü kesin olmayan hareket `direction: "unknown"` (her izinli hareketi "Giriş" sayma — PDKS-UI-18). "ID" alanı
   iç anahtar basmasın: kart no ayrı alan, yoksa boş.
5. **Manuel düzeltme (`convex/pdksRecords.ts` upsertManual):** gerekçe ZORUNLU (kullanıcı kararı): trim sonrası 3–500 karakter,
   aksi `ConvexError` Türkçe mesaj; audit kaydına gerekçe yazılır. İki saat birden boşsa reddet ("En az bir saat girin") — bugünkü
   "absent yaz" anlamı kalkar. Gece yarısını aşan çıkış kapsam dışı (mevcut hata kalır). Proje yetki kontrolü `resolveProjectScope`
   desenine taşınabilir (davranış aynı).
6. Testler: `pdksSource.test.ts` (verify mode / alt kod tablosu, kart+yüz → biometric, IDE kart → card, QR → qr, bilinmeyen →
   unknown), pdksTable gün durumu (gelecek/hafta sonu/tatil/noData/absent), upsertManual doğrulamaları (saf yardımcıya çıkar),
   kapsam: projectId verilince başka proje okuması yok (saf scope yardımcısı ile). Golden/mevcut testler yeşil kalır; değişen
   beklenti varsa nedenini raporla.

## Ownership
convex/cardReadings.ts · convex/pdksRecords.ts · convex/lib/pdks*.ts (+test) · yeni convex/lib/pdksSource.ts (+test) ·
convex/sgkExport.ts · convex/lib/reportAttendance.ts (+test) · convex/lib/sgkEksikGun.ts · convex/dashboard.ts ve
convex/lib/dashboardActivity*.ts (YALNIZ okuma süzgeci satırları) · convex/actions/getChatData.ts (YALNIZ PDKS okuma süzgeci)

## Kapsam dışı
Frontend (08 frontend worker'ı sonra) · schema.ts (ingest'te yeni alan gerekiyorsa `ask`; bu iş için gerekmemeli) · Canlı İzleme /
ingest / http.ts / hikGatewayDevice.ts · biyometri modülü opt-in, imha aracı, rıza metni (KVKK Faz 1 kalanı) · sunucu sayfalama /
aggregate · Faz 2 hesap motoru birleştirme · `convex/lib/cardReadingAudit.ts` (önceden kirli, başka işin — dokunma).

## Rapor (worker_done)
≤10 satır + `.claude/orca-specs/reports/c2a-pdks-api.md` dosyasına: (a) yeni/değişen query arg'ları ve dönüş alanları (tip adıyla),
(b) gün durumu enum'u ve Türkçe karşılık önerisi, (c) canlı veride kaç okuma biometric/unknown sayılırdı tahmini yapamıyorsan
"DB okunmadı" yaz, (d) upsertManual yeni arg sözleşmesi.

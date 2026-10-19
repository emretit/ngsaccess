# C2b W-07-api — 07 Canlı İzleme backend: kaynak sınıflama, canlı watermark, filtreler, güvenli kart atama
Önce `.claude/orca-specs/c2b-common.md` (→ c2-common.md) ve `convex/_generated/ai/guidelines.md` oku. Bağlam:
`docs/ui-scan/pages/07-canli-izleme/REPORT.md` ("Canlı akış sözleşmesi", "Kaynak ayrımı", "Okuma ayrıntısı ve bilinmeyen kart",
"Backend gereksinimi" 1-5). Ürün kararı: bilinmeyen kart Canlı İzleme'den ONAYLI atanır (dar mutation + yarış kontrolü).
Açık soru varsayılanları: canlı görünüm = bugün + sınırlı tampon (geçmiş ayrı); kapı/kişi filtresi backend ile birlikte bu dalgada.

## Hedef (test edilebilir)
Canlı İzleme için: her okuma satırında sunucudan gelen tek kaynak sınıfı; kaçırılan olayları tamamlayan sınırlı "bundan sonrası"
sorgusu; kişi/kapı/sonuç filtreleri; yetkili tek okuma ayrıntısı; okumadaki kartı kişiye atomik ve yarış kontrollü atayan mutation.
Mevcut `cardReadings.*` imzaları kırılmaz; vitest yeşil.

## İş
1. **Çalışma ağacındaki değişikliği KORU:** `convex/lib/cardReadingAudit.ts`'te commit'lenmemiş `loadDevicesById` (cihazları tek seferde
   yükleme; davranış eşdeğer) var — bu senin dosyan, üzerine çalış, geri alma.
2. **Kaynak sınıfı:** `convex/lib/pdksSource.ts`'teki sınıflamayı KULLAN (yeniden yazma; değiştirme gerekiyorsa `ask`). Liste/canlı
   satırlarına `source: "card" | "qr" | "mobile" | "biometric" | "unknown"` (+ `sourceLabel` gerekmez, frontend etiketler) ekle.
   Hik verify-mode çelişkisi ve karma biyometri pdksSource kurallarıyla aynı sonuç vermeli (VEYA modu + kart → card).
3. **Canlı watermark:** yeni `cardReadings.listLiveSince({ projectId, afterCreationTime?, limit })` — sunucu alım sırası `_creationTime`
   (accessTime geç teslimde yetersiz; `cardReadings.ts:1542` eski backfill notu). İlk çağrı (afterCreationTime yok) bugünün (TR günü)
   son N okuması; sonraki çağrılar yalnız daha yeni `_creationTime`. Dönüş `{ rows, latestCreationTime, hasMore }`; `hasMore` true ise
   frontend "yeniden yükle" der. Bounded (`take`). Index gerekirse (`by_project_creation` gibi; Convex `_creationTime` sistem index'i
   tek başına proje süzmez) `ask` ile tanım iste.
4. **Filtreler:** listeleme sorgusuna (mevcut `list` veya yeni `listFiltered`) opsiyonel `employeeId`, `doorId` (IDE `ideIoId`→`doors.ioId`
   eşlemesi; `cardReadingAudit.ts:84` enrichment kapı ID'si de döndürsün), `result: "granted" | "denied" | "unknown"`. Index planı raporla;
   uygun index yoksa `ask`. Mevcut yerel arama metni kalabilir ama sunucu filtresi dürüst olmalı.
5. **`cardReadings.getReading({ readingId })`:** yetkili tek okuma (proje kapsamı), zenginleştirilmiş (cihaz, kapı, kişi, kaynak,
   hikDenialReason). Doğrudan URL açılışı için.
6. **`cardReadings.assignCardFromReading({ readingId, employeeId, expectedCurrentCard: string | null })`** (adminMutation): okuma ve
   kişi AYNI projede; okumadaki kart numarası geçerli fiziksel credential (QR/mobil/biyometri kaynaklı okuma → reddet); kişinin şu anki
   kartı `expectedCurrentCard` ile eşleşmiyorsa `ConvexError` (yarış: form açıldıktan sonra değişti); kart başka kişide ise duplicate
   hatası (mevcut employees duplicate kontrolüyle aynı kural); kişiye kartı yaz + mevcut cihaz senkron yolunu tetikle (employees.update'in
   yaptığı gibi — o mantığı çağır, kopyalama; `convex/employees.ts`'e dokunman gerekirse `ask`) + auditLog kaydı. ESKİ OKUMANIN
   employeeId/geçmişini DEĞİŞTİRME. Türkçe hata mesajları.
7. Saf mantık `convex/lib/liveReadings.ts` (+test): watermark birleştirme/sıralama, sonuç filtresi eşlemesi, atama ön koşul kararı
   (kaynak uygun mu, kart eşleşiyor mu, duplicate).

## Ownership
convex/cardReadings.ts · convex/lib/cardReadingAudit.ts · yeni convex/lib/liveReadings.ts (+test) · convex/_generated/api.d.ts (kendi satırların)

## Kapsam dışı
Frontend · lib/pdksSource.ts (yalnız import) · PDKS hesapları/raporlar (C2a'da bitti) · employees.ts (ask) · schema.ts (ask) ·
ingest yolları (/card-reader, Hik köprü) · ruleId ile "ilgili kuralı aç".

## Rapor
`.claude/orca-specs/reports/c2b-07-api.md`: tüm yeni/değişen fonksiyon arg+dönüş tipleri, kaynak enum'u + Türkçe etiket önerisi,
watermark kullanım örneği (frontend döngüsü), filtrelerin index/sayfa-içi kapsamı, assign hata kodları/mesajları.

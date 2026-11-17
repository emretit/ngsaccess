## Görev GAF-PRIV: Kişisel veri sızıntısı küçükleri
- Bulgular: `07-ziyaretci.md` ZIY-01, ZIY-02 · `06-alarm-denetim.md` ALM-001, ALM-010, ALM-012 · `01-kisi-organizasyon.md` KIS-001 (koordinatör P2).
  1. **ZIY-01:** `convex/lib/visitorStatus.ts` `visitorMatchesSearch` ham `cardNumber`'ı yalnız hassas alan yetkisi (`canRead`) olan kullanıcı için arasın; `convex/visitors.ts` listesi bu bilgiyi geçsin.
  2. **ZIY-02:** ziyaretçi oluşturma/güncellemede etkin başlangıç < bitiş zorunlu; ters/eşit aralık reddedilsin (cihaz uyumluluk yardımcısının aralığı genişletmesine güvenme).
  3. **ALM-001:** `convex/alarms.ts` `list` yanıtında `cardNo` ve `rawData` yalnız `employees.view` izni olan kullanıcıya dönsün (izin adını `convex/lib/permissions.ts`'ten doğrula); diğerlerine dönmesin. Arayüz bu alanı kullanıyorsa yoksa "—" göstersin.
  4. **ALM-010:** `src/pages/Alarms.tsx` seçim proje değişince ve filtre değişince sıfırlansın; seçim 50 ile sınırlı.
  5. **ALM-012:** alarm aramasında `to` üst sınırı da index aralığına (`lte("eventTime", to)`) girsin.
  6. **KIS-001:** `convex/employees.ts` `bulkUpdateDepartment` ziyaretçi kayıtlarını reddetsin (mevcut `assertEmployeeRecord` benzeri kontrol).
- Ownership: `convex/lib/visitorStatus.ts`, `convex/visitors.ts`, `convex/alarms.ts`, `src/pages/Alarms.tsx`, `src/components/alarms/**`, `convex/employees.ts`, bunların testleri.
- Kabul: ZIY-01 maske çözme senaryosu (24 sorgu) artık hedef ID'yi döndürmez; ALM-001 görüntüleyici rolü `cardNo/rawData` almaz; ZIY-02 ters aralık reddi; mevcut ziyaretçi/alarm/kişi testleri geçer.

## Görev GAF-DOC: Hik-Connect kıyas belgelerini audit sonucuna göre güncelle
- Kaynak: `docs/genel-audit-2026-11-03/01..08-*.md` raporlarının "Hik-Connect kıyası" ve "Önceki audit açıkları" bölümleri + `OZET.md` (koordinatör yeniden sınıflaması bağlayıcı; GK-02 bulgu değil).
- Hedef: `docs/hikconnect-audit/KIYAS.md`, `docs/hikconnect-audit/PDKS_KIYAS.md`, `docs/hikconnect-reports/README.md` (yalnız ngsaccess karşılık kolonları/notları; Hik tarafı gözlemlerine dokunma) içinde raporların "belgeye göre değişti" dediği ~42 satırı güncelle: durum işareti (✅/🟡/❌/➕), not ve kanıt (`dosya:satır`). Belge başına en üste tek satır "Güncelleme 2026-11-03: genel audit sonrası N satır düzeltildi (docs/genel-audit-2026-11-03/)" ekle. Yeni satır yalnız raporların "KIYAS'ta ayrı satır yok; yeni kıyas" dediği yerlere.
- Kod DEĞİŞTİRME. Kod okuması yalnız rapordaki kanıt satırı belirsizse.
- Ownership: yalnız yukarıdaki 3 belge.
- Kapılar: kod kapıları gerekmez; `git diff --stat` yalnız bu 3 dosyayı göstermeli (diğer satırlar başka worker'ların). worker_done'da modül başına değişen satır sayısı.

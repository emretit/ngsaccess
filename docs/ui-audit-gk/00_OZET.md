# Geçiş Kontrol UX/UI audit — özet (2026-10-27)

## Durum
- [x] 01 Kurallar — koordinatör (Claude), kararlar alındı
- [x] 02 Zaman Şablonları — Codex worker, kararlar alındı
- [x] 03 Yetki Durumu — Codex worker, kararlar alındı
- [x] 04 Kapı Planları — Codex worker, kararlar alındı
- [ ] Düzeltme dalgaları — başlamadı

| Sekme | Yüksek | Orta | Düşük | Rapor |
|---|---|---|---|---|
| 01 Kurallar | 2 | 8 | 4 | [01-kurallar.md](01-kurallar.md) |
| 02 Zaman Şablonları | 1 | 8 | 1 | [02-zaman-sablonlari.md](02-zaman-sablonlari.md) |
| 03 Yetki Durumu | 2 | 10 | 1 | [03-yetki-durumu.md](03-yetki-durumu.md) |
| 04 Kapı Planları | 2 | 8 | 2 | [04-kapi-planlari.md](04-kapi-planlari.md) |
| **Toplam** | **7** | **34** | **8** | 49 bulgu |

Yüksek bulguların hepsi koordinatör tarafından kodda doğrulandı (02-H1, 03-H1/H2, 04-H1/H2 kod; 01-H1/H2 tarayıcı + kod).

## Ortak temalar
1. **Ekran gerçeği söylemiyor:** sahte başarı (04-H1 boş gönderime "cihaza uygulandı"), "Kısmi sonuç" ama hiçbir şey gitmedi (01-H2), rozet ile filtre farklı durum (03-H2), seçilmemiş şablona "Şablon kullanılıyor" (02-O8), gönderilmeyecek işlem için "20 sn içinde gönderim" (02-O7).
2. **Düğme ne yaptığını söylemiyor:** "Kaydet" cihaza da gönderiyor (04-H2), seçili zaman kaynağı görünmüyor (01-H1).
3. **Boş durumda yol yok:** şablon seçici (01-O5 / 02-O2 / 04-O8 — aynı `TemplatePicker`), tatil (04-O3), kaydı olmayan kişi (03-H1), şablonsuz sekme (02-O1).
4. **Terim karmaşası:** panel/cihaz (01-O8), "Kapalı" = plan etkin değil (04-O2), "Sürekli Kapalı/kilitli", teknik dil (01-O4, 02-O5, 03-D1).
5. **Sekmeler tutarsız:** H1 Kurallar'da "Geçiş Kontrol", diğerlerinde sekme adı, Kapı Planları'nda yok; sekme şeridi mobilde 2 satır (01-D1).

## Düzeltme dalgaları (öneri)
**Dalga 1 — yanlış bilgi (önce bunlar, ~1 gün):** 04-H1, 04-H2, 01-H1, 03-H2, 02-O7, 02-O8, 01-H2'nin metin kısmı ("Gönderilemedi").
**Dalga 2 — metin, terim, boş durum (~yarım gün):** 01-O4, 01-O8 (cihaz), 04-O2, 03-D1, 02-O5, ortak `TemplatePicker` boş durumu (01-O5/02-O2/04-O8), 04-O3, 02-O1 açıklaması, sekme başlıkları, 01-D2, 01-D3, 03-O2.
**Dalga 3 — etkileşim, erişilebilirlik, mobil (~1 gün):** 01-O2, 01-O3, 01-O6, 01-D1, 02-O4, 03-O3..O8, 04-O1, 04-O4..O7, 04-D1.
**Dalga 4 — ürün kararlı backend işleri (her biri ayrı plan):** 01-O1 dinamik departman, 01-H2 otomatik yeniden gönderim + düğme, 01-D4/02-O6 kuralda gece bölme, 02-H1 etkilenen kural listesi, 02-O3 taslak sakla + "Kurala dön", 02-O1 hazır şablonlar, 03-H1 + 03-O1 teşhis akışı, 03-O9, 03-O10, 02-D1, 04-D2.

## Kararlar (Emre, 2026-10-27)
- Departman dinamik · çevrimdışı = otomatik + "Yeniden gönder" · terim "cihaz" (01).
- Şablon düzenlemede taslak saklanır · etkilenen kurallar hep görünür · hazır taslaklar · kuralda gece otomatik bölünür (02).
- Yetki Durumu = teşhis ekranı · arama tüm kişiler · sayaç = sabit özet + filtre sonucu (03).
- Tek "Kaydet ve cihaza gönder" + etki özeti · tüm tatiller + önizleme · kopyada plan türü seçilir (04).

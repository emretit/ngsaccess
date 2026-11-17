# GK2-A4 — Geçiş Kontrol eski kararları: yapıldı mı? (kod doğrulaması)

## Hedef (test edilebilir)
`docs/ui-audit-gk/tur2/kararlar-dogrulama.md` dosyasında 2026-10-27 Geçiş Kontrol kararlarının HER BİRİ için durum + kanıt tablosu olur. Kod değişmez. Tarayıcı gerekmez.

## Ownership (yalnız buna yazabilirsin)
- docs/ui-audit-gk/tur2/kararlar-dogrulama.md

## Kaynaklar
- `docs/ui-audit-gk/00_OZET.md` (özellikle satır ~31 "Dalga 4" listesi ve "Kararlar" bölümü)
- `docs/ui-audit-gk/01-kurallar.md`, `03-yetki-durumu.md`, `04-kapi-planlari.md` → sondaki "Kararlar (Emre, 2026-10-27)" bölümleri
- `docs/ui-audit-gk/sadelestirme/*.md`, `.claude/handoff-gk-sadelestirme.md`, `.claude/plan-gk-sadelestirme.md`
- Bağlam: "Zaman Şablonları" sekmesi ve şablon tablosu 2026-10-27'de TAMAMEN silindi (Emre) → 02-* kararlarının çoğu geçersiz olabilir; kurala taşınanlar (ör. "kuralda gece otomatik böl") hâlâ geçerli.
- 01-O1 "dinamik departman" YAPILMADI (koordinatör doğruladı: `src/components/access-control/unified/components/DepartmentTree.tsx:216`) → tabloya yaz, yeniden araştırma.

## Yöntem
Her karar için kodda ara (`src/`, `convex/`, testler). Durum: **Yapıldı** (file:line kanıtı) / **Kısmen** (ne eksik) / **Yapılmadı** (aradığın yer + neden yok dedin) / **Geçersiz** (şablon silindi vb.) / **Belirsiz**.
Örnek kararlar: 01-H2 çevrimdışı cihaza otomatik yeniden gönderim + "Yeniden gönder" düğmesi; 01-D4/02-O6 kuralda gece saatini otomatik bölme; 02-H1 etkilenen kurallar; 02-O3 taslak sakla + "Kurala dön"; 03-H1/03-O1 teşhis akışı + tüm kişilerde arama; 03-O2 sabit özet + "Filtre sonucu: N"; 03-O9; 03-O10; 02-D1; 04-D2; 04-H2 tek "Kaydet ve cihaza gönder"; 04-O3 tüm tatiller + önizleme; 04-O5 kopyada plan türü. Listede olmayan karar bulursan ekle.

## Yasaklar
Kaynak dosya değiştirme. `git add`, `git commit`, `git stash`, `git reset`, `git checkout`, push, deploy ÇALIŞTIRMA. `npx convex *` YASAK.

## Rapor biçimi (Türkçe, sade)
Üstte 2 cümle özet + sayılar (Yapıldı/Kısmen/Yapılmadı/Geçersiz). Tablo: Karar ID | karar (1 satır) | durum | kanıt (file:line) | eksik/not. Sonda "Yapılmayanlar — tahmini iş" (her biri: küçük ≤1 sa / orta ≤yarım gün / büyük).

## worker_done
≤10 satır: Yapılmadı + Kısmen olanların tek satırlık listesi + rapor yolu. `--report-path docs/ui-audit-gk/tur2/kararlar-dogrulama.md`.

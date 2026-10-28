# Sadeleştirme raporu — Kurallar sekmesi (SALT OKUMA)

## Hedef
Kurallar sekmesini (liste + kural ayrıntı çekmecesi + yeni/düzenle sihirbazı + son gönderim kartı) sadeleştirme açısından inceleyip öncelikli öneri raporu yaz.

## Okunacak dosyalar (ownership: yalnız rapor dosyası)
- src/components/access-control/unified/AccessRulesList.tsx, rules-list/*.tsx, AccessRuleDetails.tsx, CreateRuleDialog.tsx, components/*.tsx, SyncRuns.tsx, lib/presentation.ts, hooks/useRuleForm.ts
- Veri şekli için: convex/accessRules.ts (listSummaries, getDetails), convex/deviceSyncRuns.ts (listRecent, latestForRule)
- docs/ui-audit-gk/01-kurallar.md

## Bağlam
- Proje: /Users/emreaydin/ngsaccess (React + Convex). Sayfa: Geçiş Kontrol (/access-control). Sekmeler: Kurallar, Yetki Durumu, Kapı Planları. "Zaman Şablonları" sekmesi KALDIRILIYOR (karar verildi) — onunla ilgili öneri yazma.
- Kullanıcı geri bildirimi (2026-10-27): "çok fazla detay veriyoruz". Arayüz sade olmalı: kullanıcı ADHD; her ekranda yalnız karar/aksiyon için gereken bilgi kalsın.
- Bugün bulunan örnek hata: kuralın "son gönderim" kartı 5 gün önceki eski sonucu güncelmiş gibi gösterdi ("Cihaz çevrimdışı" — cihaz aslında çevrimiçi). Bu tür "eski/yanlış bilgiyi güncel gibi gösterme" risklerini de ara.
- Önceki UX audit raporları docs/ui-audit-gk/ altında (00_OZET.md, 01..04). Onları oku; aynı bulguyu tekrar yazma, yalnız SADELEŞTİRME açısından yeni ya da hâlâ geçerli olanları yaz.
- Çalışma dizininde başka oturumun commit'lenmemiş değişiklikleri var (Dalga 3). Mevcut dosya içeriğini olduğu gibi oku.

## Ne üreteceksin
Tek dosya: docs/ui-audit-gk/sadelestirme/kurallar.md
Biçim (Türkçe, sade dil):
1. En üstte 2-3 cümle özet: sekme şu an ne gösteriyor, en büyük sadeleştirme fırsatı ne.
2. Tablo, en fazla 15 satır, öncelik sırasına göre: `# | Ekrandaki öğe | Öneri (Kaldır / Birleştir / Kısalt / Gizle-aç / Düzelt) | Neden (1 cümle) | file:line | Etki (Yüksek/Orta/Düşük)`.
3. "Kalsın" listesi: dokunulmaması gereken öğeler, her biri 1 satır gerekçe (en fazla 5).
4. "Yanlış/eski bilgi riski" bölümü: varsa, file:line + nasıl yanıltır.
Kod önerisini tarif et, kod yazma.

## Kapsam dışı / YASAK
- Kaynak koda DOKUNMA. Tek yazacağın dosya yukarıdaki rapor.
- `git add`, `git commit`, `git stash`, `git checkout`, `git reset` YASAK. Commit/push/deploy YOK.
- `npx convex deploy`, `npx convex dev`, `npx convex run`, DB'ye yazan her komut YASAK. Supabase MCP kullanma.
- Başka worker'ların rapor dosyalarına yazma.

## Kapı
- `test -s docs/ui-audit-gk/sadelestirme/kurallar.md` dolu olmalı. Kod değişmediği için test koşmana gerek yok.

## Rapor
worker_done özetinde ≤10 satır: en önemli 3 öneri (file:line) + rapor yolu. --report-path docs/ui-audit-gk/sadelestirme/kurallar.md ver.

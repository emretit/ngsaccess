# PDKS Faz A — mola kuralı

## Hedef
Planlı mola çalışma aralıklarıyla örtüştüğü kadar düşülür, ara çıkışta dışarıda geçen süre ikinci kez kesilmez; mola tanımsızsa her iki hesap yönteminde yasal mola uygulanır.

## Bugünkü hata (convex/lib/pdksDay.ts:~164-187, singleVisitBreak)
- eachPunch'ta birden fazla ziyaret (ör. 11:00–11:01 ara çıkış) varsa planlı mola (12:00–13:00) hiç düşülmüyor.
- Tanımsız molada legacy (ilk-son) yöntem legalBreakMinutes düşüyor, eachPunch 0 düşüyor.

## İstenen (Emre kararları; geçmiş tüm dönemlere uygulanır — tarih kapısı YOK)
1. Sabit vardiyada planlı mola penceresi: kesinti = planlı pencerenin çalışılan (içeride geçen) aralıklarla kesişimi. Mola penceresinde zaten dışarıdaysa o kısım tekrar kesilmez. eachPunch ve legacy yolunda aynı.
2. Mola tanımsız (breakStart/breakEnd yok, esnek mola yok): iki yöntemde de yasal mola (İş K. 68: çalışma ≤4 sa → 15 dk, 4–7,5 sa → 30 dk, >7,5 sa → 60 dk; mevcut legalBreakMinutes'i kullan/doğrula). Ara çıkışlarla dışarıda geçen süre bundan düşülür (yasal mola − dışarıda geçen, en az 0).
3. Esnek vardiya (breakMode "duration"): aynı "dışarıda geçen süreyi ikinci kez kesme" ilkesine uyuyorsa dokunma; uymuyorsa düzelt ve raporla.
4. Eksik günlere (missingEntry/missingExit) varsayımsal mola eklenmez.
5. Çok vardiyalı/gece parçalarında (pdksMultiShift) aynı kural.

## Ownership
convex/lib/pdksDay.ts, convex/lib/pdksFlexible.ts (gerekirse), convex/lib/pdksMultiShift.ts (gerekirse), convex/lib/pdksBreakFixes.test.ts, convex/lib/pdksDay*.test.ts, yeni convex/lib/pdksBreakRule.test.ts.
Kapsam dışı: convex/dashboard.ts (Faz B), convex/lib/pdksEvidence.ts ve dataMigrations.ts (Faz C), bordro dönem kapatma ve schema.ts (Faz D).

## Zorunlu testler
- 11:00–11:01 ara çıkış + 12:00–13:00 mola → 60 dk düşülür
- molada 12:10–12:40 dışarıda → toplam düşüş 60 dk (30 dışarı + 30 kesinti)
- tanımsız mola, 8 sa tek ziyaret → 60 dk, her iki yöntemde
- tanımsız mola, 8 sa + 20 dk ara çıkış → 40 dk ek kesinti
- eksik gün → 0 mola

Ortak kurallar: .claude/orca-specs/pdks-ortak-kurallar.md dosyasını OKU ve uygula.

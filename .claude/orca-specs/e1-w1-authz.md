# E1-W1 — Kapı/bölge create orphan kapatma + groupDoors silme kaskadı

## Hedef
1. `convex/zones.ts` create (:34) ve `convex/doors.ts` create (:98) projectId'siz (orphan) kayıt üretemez: proje çağıranın erişebildiği projelerden biri olmalı (`getProjectIdsForUser` + `isProjectAllowed`, convex/lib/auth.ts). Kapıda proje verilmemişse bağlı bölge/cihazdan türetilebiliyorsa türet; türetilemiyorsa ConvexError (Türkçe mesaj). Mevcut yetkili akış değişmez.
2. Kapı silindiğinde `groupDoors` bağı da silinir: `doors.remove` (doors.ts ~:258-277) ve `purgeDeviceCascade` (convex/lib/deviceHelpers.ts:19, cihazın kapılarını siler). Ortak yardımcı `deleteGroupDoorsForDoor(ctx, doorId)` (index `groupDoors.by_door`) yaz, iki yerde de kullan. Kaynak bulgu: `.claude/orca-specs/reports/review-fazb-b3.md` Y1 (sarkan groupDoors bağı kuralı UI'dan silinemez hale getiriyor).
3. `convex/devices.ts` releaseDevice (~:899-905) da kapıları satır içi siliyor — o dosya BAŞKA EKİBİN, DOKUNMA; rapora "devices.ts:<satır> şu çağrı eklenmeli" diye tam satırı yaz (coordinator ekler).

## Ownership
convex/zones.ts · convex/doors.ts · convex/lib/deviceHelpers.ts · convex/orphanGuards.test.ts · yeni test: convex/lib/deviceHelpers.test.ts (yoksa) veya mevcut kapı testleri

## Kapsam dışı
devices.ts, employees.ts, accessRules.ts (yalnız oku), cihaz create orphan'ı, UI.

## Kabul testleri
project_user/project_admin projesiz zone/door create → ret, DB yazımı yok · yetkili projeyle create → OK · kapı silinince groupDoors satırı silinir · purgeDeviceCascade cihaz kapılarının groupDoors satırlarını siler.

Ortak kurallar: `.claude/orca-specs/e1-common.md` (oku, uy). Rapor dosyası: /tmp/e1-w1.md

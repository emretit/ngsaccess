# Takip görevi: Dalga 0b — ADM-20 proje silme engelini kullanılabilir yap

## Sorun (koordinatör denetimi)
convex/projects.ts `remove` şu an 37 tabloyu "bağlı kayıt" sayıyor. Sonuç: pratikte HİÇBİR proje silinemez — sahibin kendi `userProjects` üyeliği, projeyle otomatik oluşan ayar satırları (generalSettings, workSettings…) ve her işlemde yazılan `auditLog` her zaman engeller; kullanıcı bunları "taşıyamaz/silemez". Ayrıca employeeAuth, hik/idePendingOperations, idePanelUsers, invites proje index'i olmadan TAM TABLO taranıyor (okuma limiti → mutation her zaman düşer).

## Değişiklik (yalnız convex/projects.ts `remove` + convex/lib/adminGuards.ts + test + AdminProjectsPanel metni gerekiyorsa)
Kullanıcı kararı "bağlı kayıt varsa silmeyi engelle" — bunu İŞ VERİSİ için uygula:
1. **Engelleyen (iş verisi, index ile say, ≤101):** employees, devices, zones, doors, readers, hikBridges, accessRules, cardReadings, pdksRecords, leaves, shifts, shiftAssignments, companies, departments, positions, employeeFaces, employeeFingerprints, groupMembers, groupDevices, groupDoors, deviceEvents.
2. **Projeyle birlikte silinen (yapılandırma/bağlantı; yalnız 1. grup boşsa):** userProjects, generalSettings, mailSettings, notificationSettings, workSettings, overtimeRates, holidays, reportScheduleSettings, leaveBalances, chatConversations (+ alt mesaj tablosu varsa onu da), invites (proje alanı varsa; index yoksa tablo küçük — `.filter` ile proje eşleşenleri sil, bunu kodda yorumla).
3. **Dokunulmayan:** auditLog (geçmiş kalır). employeeAuth / idePanelUsers / hik-idePendingOperations kontrolden ÇIKAR (çalışan/cihaz engeli bunları zaten kapsar; tam tarama yapma).
4. Hata mesajı yalnız 1. grubu listeler; "pasife alabilirsiniz" ipucu kalsın (proje düzenleme formunda isActive var).
5. Saf yardımcıya (adminGuards) "engelleyen/silinen tablo listesi" kararını koy ve vitest'te: yalnız ayar+üyelik+auditLog olan proje silinebilir; personeli olan proje engellenir.

## Ownership
convex/projects.ts · convex/lib/adminGuards.ts · convex/adminSettingsGuards.test.ts · src/components/admin/AdminProjectsPanel.tsx (yalnız onay metni)

## Kapılar + YASAK
Önceki görevdekiyle aynı (tsc app + convex, eslint 0 error, vitest yeşil; commit/push/deploy/DB YOK). worker_done'da ≤6 satır: tablo grupları, test sayısı.

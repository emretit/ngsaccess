# Alan B — Personel, PDKS, vardiya, izin ve talepler

## Özet

23 durum makinesi / birbirine bağlı durum ailesi tespit edildi; salt okunur kod incelemesidir, test veya canlı mutation/action çalıştırılmadı.
7 bulgu: **critical 1, high 3, medium 1, low 2**. Şiddetler gerçekleşmesi mümkün senaryonun etkisini anlatır; üretimde gerçekleşmiş olay iddiası değildir.
En kritik bulgu B-01: erişim için pasife alınan, ayrılış tarihi olmayan personelin geçmiş PDKS verileri requirements modunda hesap dışına çıkabiliyor.
Web/mobil taleplerin mevcut değerleri uyumlu; `cancelled` izin durumu yoktur: izin geri çekilince silinir, düzeltme `withdrawn` olur. Mobil ana ekranın içeride/dışarıda durumu PDKS gün etiketi değildir.
`employeeConsents` tümüyle ölü değildir: ziyaretçi KVKK yolunda kullanılıyor. `employeeTransfer.ts` dosyası yok; taşıma uygulaması `employeeTermination.ts` ve `lib/transferGuard.ts` içindedir.

## Keşif sayımları

Başlangıç `git diff --stat | tail -1`: `211 files changed, 4049 insertions(+), 2058 deletions(-)`.
AGENTS.md ve convex/_generated/ai/guidelines.md okundu. Convex'te DB trigger veya CHECK/foreign-key kısıtı yoktur; index tek başına unique değildir. Aşağıdaki tabloda schema yalnız değer kümesini, mutation ön-kontrol ise geçişi zorlar; bu iki garanti birbirinin yerine geçmez.

Tüm köklerde içerik keşfi (dosya adı listesine dayanmaz):

```sh
rg -l -i 'employee|pdks|shift|leaveBalance|leaveRequest|attendanceCorrection|reportSchedule|workSettings|overtimeRate|sgkExport|holiday' convex src mobile/lib infra bridge
# 755 dosya; testler ve üretilen kod dahil geniş aday kümesi
# Her dönen dosya için aşağıdaki desenlerde rg -o çıktısının satır sayısı:
rg -o 'status' <keşfedilen-dosyalar>
rg -o 'state' <keşfedilen-dosyalar>
rg -o 'phase' <keşfedilen-dosyalar>
rg -o 'v\.literal\(' <keşfedilen-dosyalar>
rg -o '\b\w*At\s*:' <keşfedilen-dosyalar>
rg -o '\bis[A-Z]\w*' <keşfedilen-dosyalar>
```

Sayılar eşleşme adedidir; `status` alt dizgesi sayılır, yalnız alan tanımı değildir. Geniş küme Alan A/C ile kesişimleri içerir; yazma yolu ekinde ilgili B modülleri ayrılmıştır. İkinci sütun test, snapshot, `_generated`, üretilen Dart yerelleştirmelerini dışlar.

| Desen | Geniş küme | Üretim adayları |
|---|---:|---:|
| `status` | 2824 | 1575 |
| `state` | 1594 | 485 |
| `phase` | 33 | 23 |
| `v\.literal\(` | 549 | 549 |
| `\b\w*At\s*:` | 2196 | 682 |
| `\bis[A-Z]\w*` | 2911 | 1747 |

Diğer taramalar: `rg -n 'db\.(patch|insert|replace|delete)|status:|state:|isActive:|usedAt:|lastSentAt:' convex src mobile/lib infra bridge`; `rg -n 'employeeConsents|leaveBalances' convex src mobile/lib infra bridge`; `rg -n 'runMutation|http.route|employeeAuth|checkIn' convex/http.ts`; `rg -n 'status|case |withdrawn|cancelled|noShift|noData' mobile/lib src convex/lib`. Eksik varsayımsal dosya adlarından sonuç çıkarılmadı; içerik taraması gerçek dosyaları verdi.

## Makine listesi

| # | Varlık | Saklama / tanım | Durumlar | Zorlama yeri | Bulgu sayısı |
|---|---|---|---|---|---:|
| 1 | İstihdam ve erişim başlangıcı | employees.isActive/employmentEndDate/terminatedAt/accessStartsAt; convex/schema.ts:110 | aktif, pasif, ayrılış planlı, ayrılmış; erişim henüz başlamadı/başladı | schema türleri + mutation ön-kontrol | 1 |
| 2 | Proje taşıma | accessTransfers.status; convex/employeeTermination.ts:197 | requested, revoking, revoked, provisioning, stuck, done, cancelled | schema enum + mutation ön-kontrol | 0 |
| 3 | Taşıma hedef onayı | accessTransferTargets.state; convex/employeeTermination.ts:206 | pending, confirmed, failed, superseded, deviceRemoved | schema enum + mutation ön-kontrol | 0 |
| 4 | Departman geçmişi | employees.hasDepartmentHistory + employeeDepartmentHistory.validFrom/source; convex/schema.ts:592 | baseline/change; tarihe göre geçerli departman | schema enum + mutation aynı gün unique-benzeri kontrol | 0 |
| 5 | Şifre kurulum/sıfırlama | employeeAuth.passwordHash/passwordVersion/setupToken/tokenExpiresAt; convex/schema.ts:199 | kurulmamış, token geçerli/süresi dolmuş, şifre hazır; ok/expired/invalid sonuç | mutation token/süre kontrolü | 0 |
| 6 | Mobil oturum | employeeSessions.expiresAt/passwordVersion + çalışan aktifliği; convex/schema.ts:215 | geçerli, expired, revoked, inactive/ended, silinmiş | mutation/query doğrulama; DB çapraz alan kısıtı yok | 1 |
| 7 | Check-in QR token | checkInTokens.purpose/expiresAt/usedAt/authVersion/sessionId/locationRecorded; convex/schema.ts:181 | pending, consumed, expired; reader amaçlı | schema purpose literal + mutation süre/tek kullanım kontrolü | 0 |
| 8 | Saklanan manuel PDKS | pdksRecords.status/manualEntry/entryTime/exitTime/editedAt; convex/schema.ts:1021 | manuel giriş/çıkış/çift saat; status present yazılır | status için schema v.string; mutation saat doğrulama | 0 |
| 9 | PDKS kanıt ve punch eşleşmesi | convex/lib/pdksDay.ts:111; lib/pdksEvidence.ts; lib/pdksPunchPairs.ts | present/absent/incomplete; ölçülebilir/ölçülemez; eksik giriş/çıkış; yönsüz/çift kayıt | yalnız hesap fonksiyonları; kalıcı status değil | 0 |
| 10 | PDKS gün/payroll sınıflaması | convex/lib/pdksTable.ts:31; pdksCalc.ts:126; pdksPayroll.ts | present,late,absent,leave,weekend,holiday,future,noData,notEmployed,incomplete; noShift; overtime overlay | TypeScript union + hesap koşulları; DB zorlaması yok | 0 |
| 11 | PDKS kural yürürlük sürümü | pdksRuleVersions.effectiveFrom/punchMode/calculationMode; convex/schema.ts:277 | gelecek/etkin/geçmiş; legacy/requirements; firstLast/eachPunch; absent/review | schema enum + mutation tarih/unique-benzeri kontrol | 0 |
| 12 | PDKS kontrol noktası seçimi | pdksCheckpointSelections.targetType/pointType + checkpointMode; convex/schema.ts:291 | all/selected; door/device/reader; both/entry/exit | schema enum + publish mutation referans doğrulama | 0 |
| 13 | Vardiya tanımı ve sürümleri | shifts.isActive/scheduleType/versionedUntil + shiftVersions; convex/schema.ts:1063 | aktif/pasif; fixed/flexible; sürümsüz/sürümlü | schema enum + mutation ön-kontrol | 0 |
| 14 | Vardiya takvim deseni | shifts.scheduleMode/dayPlan + assignment.plan.kind; convex/lib/shiftSchedule.ts:6 | daily/weekly/cycle; weekly/dayCycle/weekCycle; çalışma/dinlenme slotu | schema enum + mutation validateShiftSchedule/validateShiftPlan | 0 |
| 15 | Personel vardiya ataması | shiftAssignments.startDate/endDate/plan + shiftPlanRefs; convex/schema.ts:1086 | atanacak/çakışma/izin/tatil/skipped; assigned/skipped_conflict/skipped_leave/failed; dönem geçerli/dışı | mutation ön-kontrol + schema plan enum | 0 |
| 16 | Departman planı ve çözüm önceliği | departmentShiftAssignments + dayPlan.kind/source; convex/schema.ts:1104; convex/lib/shiftResolver.ts:29 | employee/department/project kaynak; shifts/rest/none; açık/bitmiş dönem | schema plan enum + mutation ve resolver önceliği | 0 |
| 17 | İzin ve mobil izin talebi | leaves.status/source/approvedBy/decidedAt; convex/schema.ts:1226 | pending/approved/rejected; admin/employee; geri çekme=silinme | schema enum + mutation pending kontrolü | 0 |
| 18 | İzin bakiyesi | leaveBalances.totalDays/usedDays/remainingDays; convex/schema.ts:1295 | tanımlı/kullanılmış/kalan; efektif akışa bağlı değil | schema yalnız sayılar; hesap eşitliği zorlaması yok | 1 |
| 19 | PDKS düzeltme talebi | attendanceCorrections.status/correctionType/decidedAt; convex/schema.ts:1271 | pending/approved/rejected/withdrawn; checkIn/checkOut/both | schema enum + mutation pending/kimlik kontrolü | 1 |
| 20 | Tatil, çalışma ve fazla mesai ayarları | holidays.isHalfDay/isRecurring; workSettings.allowLateEntry; overtimeRates mode/basis; convex/schema.ts:1310; :1381; :1395 | tam/yarım tatil; tekrar; night combine max/multiply/add; overtime daily/weekly | schema enum + ayar mutation doğrulama | 0 |
| 21 | Rapor hatırlatma ve gönderim | reportScheduleSettings.enabled/lastSentAt/updatedAt; convex/schema.ts:1457 | kapalı/açık; hiç gönderilmemiş/gönderilmiş; başarısızlık yalnız log | schema türleri; save mutation enum; teslimde kalıcı ön-durum yok | 2 |
| 22 | Retention, cleanup ve mobil komut belirsizliği | privacyRetention stage/batch/cursor/runAt; request_provider loading/busy/uncertain/generation; convex/privacyRetention.ts:212 | aşama/sonraki aşama/durmuş; idle/loading/busy/uncertain; session epoch | internal mutation arg/limit kontrolü; mobil yalnız UI | 0 |

| 23 | Personel/ziyaretçi rıza yaşam döngüsü | employeeConsents.consentType/grantedAt/revokedAt; convex/schema.ts:1348 | verilmiş, geri alınmış; visitor_kvkk ve eski personel türleri | schema enum + mutation aktif rıza kontrolü | 1 |

## Makineler

### 1. İstihdam ve erişim başlangıcı

Durumlar: aktif, pasif, ayrılış planlı, ayrılmış; erişim henüz başlamadı/başladı. Saklama: employees.isActive/employmentEndDate/terminatedAt/accessStartsAt; convex/schema.ts:110. Zorlama: schema türleri + mutation ön-kontrol. Bulgular: B-01.

| Kaynak → hedef | Yazan yol / hesaplayan yol | Ön-koşul kontrolü |
|---|---|---|
| yok → aktif/pasif | convex/employees.ts:262; convex/employeeImport.ts:97 | varsayılan aktif; yetki ve alan doğrulama |
| aktif ↔ pasif / erişim başlangıcı değişir | convex/employees.ts:388 | taşıma kilidi; ayrılmışı aktifleştirme engeli :420 |
| aktif → ayrılış planlı/ayrılmış | convex/employeeTermination.ts:85 | aktif, ayrılış yok, tarih aralığı :62 |
| planlı → pasif | convex/employeeTermination.ts:124; :36 | bugünden eski bitiş; cron 00:05 TR |
| ayrılmış → aktif | convex/employeeTermination.ts:105 | bitiş var; transfer değil; metadata temizlenir |

Okuyan kopyalar ve sınırlar: src/components/employees/EmployeeEmploymentBadge.tsx:6; src/components/employees/lib/employment.ts:19; convex/lib/employment.ts:8. Mobil getCurrentEmployee ayrılış ve pasifliği ayrı hata koduyla okur (convex/lib/employeeAuth.ts:26).

### 2. Proje taşıma

Durumlar: requested, revoking, revoked, provisioning, stuck, done, cancelled. Saklama: accessTransfers.status; convex/employeeTermination.ts:197. Zorlama: schema enum + mutation ön-kontrol. Bulgular: —.

| Kaynak → hedef | Yazan yol / hesaplayan yol | Ön-koşul kontrolü |
|---|---|---|
| yok → revoking | convex/employeeTermination.ts:197 | iki proje yetkisi, preflight, çevrimiçi cihazlar |
| revoking/stuck → revoked | convex/lib/transferGuard.ts:114 | hedefler confirmed/deviceRemoved |
| revoked → provisioning → done / stuck | convex/employeeTermination.ts:226; :238; :241; :250 | kart/kimlik/proje ve hedef planı tekrar doğrulanır |
| revoking → stuck → revoking | convex/employeeTermination.ts:320; :302 | deadline / retry yalnız stuck |
| revoking/stuck → cancelled | convex/employeeTermination.ts:263; :267 | terminal geçiş engeli; kaynağı geri yükler |

Okuyan kopyalar ve sınırlar: src/components/employees/lib/employment.ts:19; EmployeeTransferDialog ve EmployeeTransferStatus bileşenleri. Mobilde yönetim yolu yok. requested değerinin employee taşıma başlangıcında yazarı yok; ortak erişim taşıma makinesinin değeri olduğundan burada ölü enum bulgusu sayılmadı.

### 3. Taşıma hedef onayı

Durumlar: pending, confirmed, failed, superseded, deviceRemoved. Saklama: accessTransferTargets.state; convex/employeeTermination.ts:206. Zorlama: schema enum + mutation ön-kontrol. Bulgular: —.

| Kaynak → hedef | Yazan yol / hesaplayan yol | Ön-koşul kontrolü |
|---|---|---|
| yok → pending | convex/employeeTermination.ts:206 | kaynak cihaz listesi |
| pending/failed → confirmed/failed/superseded | convex/lib/transferGuard.ts:118 | aktif transfer ve hedef kimliği kontrol edilir |
| hedef → deviceRemoved | convex/lib/transferGuard.ts:149 | kaynak projeden cihaz kaldırma |
| failed/pending → pending | convex/employeeTermination.ts:305 | retry; superseded varsa engel |
| bekleyen → superseded | convex/employeeTermination.ts:270 | iptal |

Okuyan kopyalar ve sınırlar: convex/employeeTermination.ts:353 web için state/confirmedAt/lastError döndürür; cihaz ACK uygulamasının Alan A ayrıntıları kapsam dışıdır.

### 4. Departman geçmişi

Durumlar: baseline/change; tarihe göre geçerli departman. Saklama: employees.hasDepartmentHistory + employeeDepartmentHistory.validFrom/source; convex/schema.ts:592. Zorlama: schema enum + mutation aynı gün unique-benzeri kontrol. Bulgular: —.

| Kaynak → hedef | Yazan yol / hesaplayan yol | Ön-koşul kontrolü |
|---|---|---|
| geçmiş yok → baseline | convex/lib/employeeDepartmentHistory.ts:12; :14 | 0001-01-01; önceki departman korunur |
| baseline/change → change | convex/lib/employeeDepartmentHistory.ts:29 | aynı gün unique sorgu; varsa patch yoksa insert |
| geçmiş → silinmiş | convex/lib/employeeCascade.ts:123 | kişi silme; limit aşılırsa transaction geri alınır |

Okuyan kopyalar ve sınırlar: convex/lib/employeeDepartmentHistory.ts:43 departmentAt; convex/lib/shiftResolver.ts tarihli departmandan plan çözer. Web vardiya takvimi backend çözümünü okur; mobil ayrı geçmiş enumu tutmaz.

### 5. Şifre kurulum/sıfırlama

Durumlar: kurulmamış, token geçerli/süresi dolmuş, şifre hazır; ok/expired/invalid sonuç. Saklama: employeeAuth.passwordHash/passwordVersion/setupToken/tokenExpiresAt; convex/schema.ts:199. Zorlama: mutation token/süre kontrolü. Bulgular: —.

| Kaynak → hedef | Yazan yol / hesaplayan yol | Ön-koşul kontrolü |
|---|---|---|
| yok/hazır → kurulum tokenlı | convex/employeeAuth.ts:60; :70; :135 | çalışan uygunluğu; internal yollar |
| geçerli token → şifre hazır | convex/employeeAuth.ts:174; convex/lib/employeeAuth.ts:47 | token bulunur; son kullanım tarihi kontrolü; sürüm artırılır, token silinir |
| tokenlı → tokensız | convex/employeeAuth.ts:209 | günlük cleanup; süre dolmuş |
| hazır → yeni şifre/sürüm | convex/employeeAuth.ts:359; convex/lib/employeeAuth.ts:47 | mevcut oturum/eski şifre doğrulaması |

Okuyan kopyalar ve sınırlar: convex/actions/setPassword.ts ve src/pages/EmployeeSetup.tsx; mobile/lib/repositories/auth_repository.dart. Şifre sürümü ve hash tek mutation içinde değişir; eski oturumlar sürümden reddedilir.

### 6. Mobil oturum

Durumlar: geçerli, expired, revoked, inactive/ended, silinmiş. Saklama: employeeSessions.expiresAt/passwordVersion + çalışan aktifliği; convex/schema.ts:215. Zorlama: mutation/query doğrulama; DB çapraz alan kısıtı yok. Bulgular: B-02.

| Kaynak → hedef | Yazan yol / hesaplayan yol | Ön-koşul kontrolü |
|---|---|---|
| yok → geçerli | convex/employeeAuth.ts:307 | şifre ve aktiflik; oturum sürümü kopyalanır |
| geçerli → silinmiş | convex/employeeAuth.ts:352 | signOut; token eşleşmesi |
| geçerli → revoked | convex/lib/employeeAuth.ts:47 | şifre sürümü artar; satır silinmez |
| geçerli ↔ inactive/ended | convex/lib/employeeAuth.ts:26 | anlık personel alanından türetilir |
| expired → silinmiş | convex/privacyRetention.ts:332 | retention cutoff |

Okuyan kopyalar ve sınırlar: mobile/lib/providers/auth_provider.dart; mobile/lib/services/session_store.dart; convex/employeeAuth.ts:401 me. B-02 yalnız normal pasifleştirme ve geri açma için; proje taşıması auth/session belgelerini ayrıca siler (:211).

### 7. Check-in QR token

Durumlar: pending, consumed, expired; reader amaçlı. Saklama: checkInTokens.purpose/expiresAt/usedAt/authVersion/sessionId/locationRecorded; convex/schema.ts:181. Zorlama: schema purpose literal + mutation süre/tek kullanım kontrolü. Bulgular: —.

| Kaynak → hedef | Yazan yol / hesaplayan yol | Ön-koşul kontrolü |
|---|---|---|
| yok → pending | convex/employeeCheckIn.ts:26 | çalışan oturumu/proje doğrulanır |
| pending → consumed | convex/lib/processCardReadingCore.ts:339; :353 | usedAt yok, session sürümü ve auth sürümü geçerli |
| pending → expired | convex/employeeCheckIn.ts:47 | saat veya oturum iptali; türetilmiş |
| consumed/expired → silinmiş | convex/privacyRetention.ts:312; convex/lib/employeeCascade.ts:182 | retention/kişi silme |

Okuyan kopyalar ve sınırlar: convex/employeeCheckIn.ts:34; src/pages/CheckIn.tsx; mobile/lib/providers/qr_provider.dart. checkInWithToken eski yol yalnız kullanılan token sonucunu bildirir; tüketim gerçek okuyucu akışındadır. HTTP/bridge okumaları processCardReading üzerinden ulaşır, ayrı B tablo yazarı yok.

### 8. Saklanan manuel PDKS

Durumlar: manuel giriş/çıkış/çift saat; status present yazılır. Saklama: pdksRecords.status/manualEntry/entryTime/exitTime/editedAt; convex/schema.ts:1021. Zorlama: status için schema v.string; mutation saat doğrulama. Bulgular: —.

| Kaynak → hedef | Yazan yol / hesaplayan yol | Ön-koşul kontrolü |
|---|---|---|
| yok / mevcut → present,manualEntry=true | convex/lib/pdksManualWrite.ts:33; :37; :46 | en az bir geçerli saat, gece vardiyası sırası; ön-status kontrolü yok, düzenleme amaçlı |
| CSV → toplu upsert | convex/actions/pdksImport.ts:179; convex/pdksRecords.ts:86 | önizleme ardından mutation yeniden doğrular |
| pending correction → manuel kayıt | convex/attendanceCorrections.ts:102 | aynı mutation içinde karar ve PDKS yazılır |

Okuyan kopyalar ve sınırlar: src/components/pdks/ManualPdksEditDialog.tsx; convex/lib/pdksTable.ts:308; mobileAttendance summary. Saklanan present nihai gün sınıfı değildir; eksik saatte hesap inceleme verebilir. Bu nedenle string schema tek başına sahte devamsızlık üretimi olarak raporlanmadı.

### 9. PDKS kanıt ve punch eşleşmesi

Durumlar: present/absent/incomplete; ölçülebilir/ölçülemez; eksik giriş/çıkış; yönsüz/çift kayıt. Saklama: convex/lib/pdksDay.ts:111; lib/pdksEvidence.ts; lib/pdksPunchPairs.ts. Zorlama: yalnız hesap fonksiyonları; kalıcı status değil. Bulgular: —.

| Kaynak → hedef | Yazan yol / hesaplayan yol | Ön-koşul kontrolü |
|---|---|---|
| okumalar+manuel → kanıt | convex/lib/pdksDay.ts:111 | legacy/requirements/eachPunch ayrımı |
| kanıt → incomplete | convex/lib/pdksDay.ts:145 | flexibleConflict; durationMeasured ve attendanceCredit false |
| giriş → açık çift → kapanmış çift | convex/lib/pdksPunchPairs.ts | sıralı okumalar; minPunchInterval; fonksiyon çıktısı |

Okuyan kopyalar ve sınırlar: convex/lib/pdksTable.ts:360; src/components/pdks/dashboard/PdksDaySegments.tsx; mobil ayrı kanıt enumu sunmaz. Kanıt, zaman akışında aynı belgeyi patch eden bir makine değil; her sorguda yeniden hesaplanır.

### 10. PDKS gün/payroll sınıflaması

Durumlar: present,late,absent,leave,weekend,holiday,future,noData,notEmployed,incomplete; noShift; overtime overlay. Saklama: convex/lib/pdksTable.ts:31; pdksCalc.ts:126; pdksPayroll.ts. Zorlama: TypeScript union + hesap koşulları; DB zorlaması yok. Bulgular: —.

| Kaynak → hedef | Yazan yol / hesaplayan yol | Ön-koşul kontrolü |
|---|---|---|
| kanıt/takvim → gün | convex/lib/pdksTable.ts:64; :344 | istihdam, plan, veri varlığı, izin, tatil ve saat önceliği |
| future → present/late/absent/incomplete | convex/lib/pdksTable.ts:73 | Date.now ve yeni okumayla yeniden hesap |
| günler → bordro/SGK | convex/sgkExport.ts:96; convex/lib/pdksPayroll.ts | incomplete/noData inceleme günleri ayrılır |

Okuyan kopyalar ve sınırlar: src/components/pdks/statusMeta.ts:41 tüm backend değerlerini ve overtime ekini kapsar; :65 noShift ve devam ediyor etiketi. Mobil attendanceStatus inside/out/none ayrı kavramdır; geç/devamsız etiketi sunmaması aynı enumun eksik switchi değildir. B-01 kök makine #1 altında sayıldı.

### 11. PDKS kural yürürlük sürümü

Durumlar: gelecek/etkin/geçmiş; legacy/requirements; firstLast/eachPunch; absent/review. Saklama: pdksRuleVersions.effectiveFrom/punchMode/calculationMode; convex/schema.ts:277. Zorlama: schema enum + mutation tarih/unique-benzeri kontrol. Bulgular: —.

| Kaynak → hedef | Yazan yol / hesaplayan yol | Ön-koşul kontrolü |
|---|---|---|
| yok → gelecek sürüm | convex/pdksRules.ts:153; :203 | en erken yarın; gerekli punch seçenekleri kontrolü |
| gelecek → düzenlenmiş/silinmiş | convex/pdksRules.ts:194; :201; :218 | aynı effectiveFrom unique; etkin sürüm değişmez/silinmez |
| gelecek → etkin → geçmiş | convex/lib/pdksRules.ts | tarih resolverı; cron yazımı yok |

Okuyan kopyalar ve sınırlar: src/components/settings/sections/components/PdksRulesSettings.tsx; pdksRulesModel.ts; mobil backend summary hesaplarını tüketir.

### 12. PDKS kontrol noktası seçimi

Durumlar: all/selected; door/device/reader; both/entry/exit. Saklama: pdksCheckpointSelections.targetType/pointType + checkpointMode; convex/schema.ts:291. Zorlama: schema enum + publish mutation referans doğrulama. Bulgular: —.

| Kaynak → hedef | Yazan yol / hesaplayan yol | Ön-koşul kontrolü |
|---|---|---|
| seçimler → yeni snapshot | convex/pdksRules.ts:201; :204 | yayınla birlikte eski seçimler silinir; yeni snapshot atomik |
| snapshot → uyarılı eşleşme | convex/pdksRules.ts:110 | okuyucu taşınmış/silinmiş; uyarı hesaplanır |

Okuyan kopyalar ve sınırlar: src/components/pdks/settings/CheckpointWarnings.tsx; mobil ayrı seçim yönetmez. HTTP/bridge yalnız okuma kanıtı sağlar; seçim yazmaz.

### 13. Vardiya tanımı ve sürümleri

Durumlar: aktif/pasif; fixed/flexible; sürümsüz/sürümlü. Saklama: shifts.isActive/scheduleType/versionedUntil + shiftVersions; convex/schema.ts:1063. Zorlama: schema enum + mutation ön-kontrol. Bulgular: —.

| Kaynak → hedef | Yazan yol / hesaplayan yol | Ön-koşul kontrolü |
|---|---|---|
| yok → tanım | convex/shifts.ts:533 | takvim ve saat doğrulama |
| tanım → kosmetik güncelleme | convex/shifts.ts:583 | ad/aktiflik; hesap snapshotı açılmaz |
| hesap değişimi → geçmiş snapshot + yeni kurallar | convex/shifts.ts:589; :614 | başlangıç bugün/geçmiş; sınır geri gidemez; en çok 200 |
| tanım → silinmiş | convex/shifts.ts:684; :685 | kullanım/etki; sürümler de silinir |

Okuyan kopyalar ve sınırlar: src/components/shifts/definitions/shiftFormSchema.ts; src/components/shifts/useShiftDefinitionActions.ts. Tarihli lookup convex/lib/shiftVersions.ts:73; mobil vardiya tanım kopyası tutmaz.

### 14. Vardiya takvim deseni

Durumlar: daily/weekly/cycle; weekly/dayCycle/weekCycle; çalışma/dinlenme slotu. Saklama: shifts.scheduleMode/dayPlan + assignment.plan.kind; convex/lib/shiftSchedule.ts:6. Zorlama: schema enum + mutation validateShiftSchedule/validateShiftPlan. Bulgular: —.

| Kaynak → hedef | Yazan yol / hesaplayan yol | Ön-koşul kontrolü |
|---|---|---|
| tanım → atama deseni kopyası | convex/lib/shiftSchedule.ts:29 | weekly 7 gün; cycle 2–31; en az bir çalışma günü |
| tarih → slot/rest | convex/lib/shiftPlan.ts:30 | anchorDate ve mod hesabı; tarih aralığı |

Okuyan kopyalar ve sınırlar: src/components/shifts/RotationEditor.tsx; AssignmentPatternEditor.tsx; backend daySlotValidator ve plan sınırları esas. Tanım deseni değişmesi eski atama desenini yeniden yazmaz.

### 15. Personel vardiya ataması

Durumlar: atanacak/çakışma/izin/tatil/skipped; assigned/skipped_conflict/skipped_leave/failed; dönem geçerli/dışı. Saklama: shiftAssignments.startDate/endDate/plan + shiftPlanRefs; convex/schema.ts:1086. Zorlama: mutation ön-kontrol + schema plan enum. Bulgular: —.

| Kaynak → hedef | Yazan yol / hesaplayan yol | Ön-koşul kontrolü |
|---|---|---|
| preview → assigned | convex/shifts.ts:265; :287 | preview sonucu yeniden hesaplanır; force/calendarConfirm kontrolü |
| atama → güncellenmiş | convex/shifts.ts:196 | aralık ve çakışma yeniden kontrol edilir |
| atama → bölünmüş/kısaltılmış/silinmiş | convex/shifts.ts:776; :777; :784; :786; :789 | clear aralığı kesişimi |
| refs → yeniden kurulmuş | convex/lib/shiftAssign.ts:176 | aynı transaction; eski ref sil, plan IDlerini insert |

Okuyan kopyalar ve sınırlar: src/components/shifts/AssignShiftDialog.tsx; AssignmentEditDialog.tsx; lib/planning.ts. Preview durumları kaydedilen belge status alanı değildir. Her yazımın tam satır dizini aşağıdadır.

### 16. Departman planı ve çözüm önceliği

Durumlar: employee/department/project kaynak; shifts/rest/none; açık/bitmiş dönem. Saklama: departmentShiftAssignments + dayPlan.kind/source; convex/schema.ts:1104; convex/lib/shiftResolver.ts:29. Zorlama: schema plan enum + mutation ve resolver önceliği. Bulgular: —.

| Kaynak → hedef | Yazan yol / hesaplayan yol | Ön-koşul kontrolü |
|---|---|---|
| yok → departman planı | convex/shiftPlans.ts:110 | aktif vardiya; hedef departman/proje; normalize |
| plan → düzenlenmiş/silinmiş | convex/shiftPlans.ts:137; :151 | yetki ve plan referansları aynı transaction |
| tarih → employee/department plan veya none | convex/lib/shiftResolver.ts:138; :179 | kişisel plan öncelikli; tarihli departman geçmişi |

Okuyan kopyalar ve sınırlar: src/components/shifts/DepartmentAssignments.tsx; calendar/shiftCalendarModel.ts; mobil summary aynı resolverı kullanır.

### 17. İzin ve mobil izin talebi

Durumlar: pending/approved/rejected; admin/employee; geri çekme=silinme. Saklama: leaves.status/source/approvedBy/decidedAt; convex/schema.ts:1226. Zorlama: schema enum + mutation pending kontrolü. Bulgular: —.

| Kaynak → hedef | Yazan yol / hesaplayan yol | Ön-koşul kontrolü |
|---|---|---|
| yok → approved | convex/leaves.ts:199; :218; convex/lib/leaveRules.ts:12 | admin attendance.approve; çakışma yok |
| yok → pending | convex/leaveRequests.ts:36 | mobil çalışan; tarih/sayı/çakışma kontrolleri |
| pending → approved/rejected | convex/leaveRequests.ts:161; :192 | pending; proje/çalışan eşleşmesi; onayda çakışma tekrar kontrolü |
| pending → silinmiş | convex/leaveRequests.ts:46; convex/lib/employeeCascade.ts:141 | kendi employee kaynaklı talebi / kişi silme |
| approved → approved düzenleme | convex/leaves.ts:236; :251 | approved; expectedUpdatedAt; tarih değişirse çakışma |

Okuyan kopyalar ve sınırlar: src/components/leaves/lib/leaveState.ts; LeaveRequestsPanel.tsx; mobile/lib/models/employee_request.dart:45; mobile/lib/screens/requests/requests_screen.dart:31. TR/EN arb requestsPending/Approved/Rejected/Withdrawn/Unknown tutarlı. cancelled schema değeri değildir; geri çekme için bu değer beklenmemeli.

### 18. İzin bakiyesi

Durumlar: tanımlı/kullanılmış/kalan; efektif akışa bağlı değil. Saklama: leaveBalances.totalDays/usedDays/remainingDays; convex/schema.ts:1295. Zorlama: schema yalnız sayılar; hesap eşitliği zorlaması yok. Bulgular: B-06.

| Kaynak → hedef | Yazan yol / hesaplayan yol | Ön-koşul kontrolü |
|---|---|---|
| yok → kayıt / kullanım → yeni bakiye | üretim yazarı bulunmadı | uygulanmış geçiş yok; yalnız schema ve idari silme referansı |

Okuyan kopyalar ve sınırlar: Web/mobilde bakiye okuyucusu bulunmadı. İzin onayı bakiye düşmez; tabloyu mevcut ürün özelliği gibi yorumlamak yanlış olur.

### 19. PDKS düzeltme talebi

Durumlar: pending/approved/rejected/withdrawn; checkIn/checkOut/both. Saklama: attendanceCorrections.status/correctionType/decidedAt; convex/schema.ts:1271. Zorlama: schema enum + mutation pending/kimlik kontrolü. Bulgular: B-03.

| Kaynak → hedef | Yazan yol / hesaplayan yol | Ön-koşul kontrolü |
|---|---|---|
| yok → pending | convex/attendanceCorrections.ts:29 | tarih, gerekçe, saat türü; aynı gün pending kontrolü |
| pending → withdrawn | convex/attendanceCorrections.ts:41; convex/lib/employeeCascade.ts:135 | kendi talebi / kişi silme |
| pending → approved/rejected | convex/attendanceCorrections.ts:91; :104 | yalnız pending; onay aynı transactionda manuel PDKS yazar |

Okuyan kopyalar ve sınırlar: src/components/pdks/CorrectionRequestsPanel.tsx; mobile/lib/models/employee_request.dart:73; requests_screen.dart:31. Mobil bilinmeyen status için Bilinmiyor, withdrawn için Geri çekildi etiketi var; current enum eksikliği yok.

### 20. Tatil, çalışma ve fazla mesai ayarları

Durumlar: tam/yarım tatil; tekrar; night combine max/multiply/add; overtime daily/weekly. Saklama: holidays.isHalfDay/isRecurring; workSettings.allowLateEntry; overtimeRates mode/basis; convex/schema.ts:1310; :1381; :1395. Zorlama: schema enum + ayar mutation doğrulama. Bulgular: —.

| Kaynak → hedef | Yazan yol / hesaplayan yol | Ön-koşul kontrolü |
|---|---|---|
| yok → tatil | convex/holidays.ts:81; :146 | yetki/tarih/tekrar; seed mevcut günleri gözetir |
| tatil → silinmiş | convex/holidays.ts:107 | yönetici yetkisi |
| ayar yok/mevcut → yeni ayar | convex/settings.ts:196; :198; :202 | saveOvertime ortak doğrulama ve tek transaction |

Okuyan kopyalar ve sınırlar: src/components/settings/sections/components/HolidayCalendarManager.tsx; OvertimeSettingsForm.tsx; pdksHelpers/payroll ve sgkExport tüketir. Tarihli ayar snapshotı yok; geçmiş raporların güncel ayarla yeniden hesaplanması gözlemidir, tarihsel değer saklama ürün sözleşmesi doğrulanmadığından ayrıca hata sayılmadı.

### 21. Rapor hatırlatma ve gönderim

Durumlar: kapalı/açık; hiç gönderilmemiş/gönderilmiş; başarısızlık yalnız log. Saklama: reportScheduleSettings.enabled/lastSentAt/updatedAt; convex/schema.ts:1457. Zorlama: schema türleri; save mutation enum; teslimde kalıcı ön-durum yok. Bulgular: B-04, B-05.

| Kaynak → hedef | Yazan yol / hesaplayan yol | Ön-koşul kontrolü |
|---|---|---|
| yok/kapalı ↔ açık | convex/reports.ts:296; :297 | kullanıcı/proje ve e-posta doğrulanır |
| açık → gönderim denemesi | convex/reports.ts:348; convex/actions/sendScheduledReports.ts:21 | aylık cron; scope query |
| deneme → lastSentAt | convex/actions/sendScheduledReports.ts:44; convex/reports.ts:341 | posta sent.ok; mutation yalnız güncel enabled/scope kontrol eder |
| deneme → başarısız log | convex/actions/sendScheduledReports.ts:45; :47 | kalıcı failure/retry durumu yok |

Okuyan kopyalar ve sınırlar: src/components/settings/sections/reports/ReportReminderSettings.tsx:74 Kayıtlı durum Açık/Kapalı; mobil yönetim yok. reportType schema v.string; public save enum ile sınırlı; UI safeParse fallback sgk.

### 22. Retention, cleanup ve mobil komut belirsizliği

Durumlar: aşama/sonraki aşama/durmuş; idle/loading/busy/uncertain; session epoch. Saklama: privacyRetention stage/batch/cursor/runAt; request_provider loading/busy/uncertain/generation; convex/privacyRetention.ts:212. Zorlama: internal mutation arg/limit kontrolü; mobil yalnız UI. Bulgular: —.

| Kaynak → hedef | Yazan yol / hesaplayan yol | Ön-koşul kontrolü |
|---|---|---|
| cron → aşama 0 / grup başlangıcı | convex/privacyRetention.ts:239 | group; batch=0; sabit runAt |
| sayfa → aynı/sonraki aşama → bitiş | convex/privacyRetention.ts:214; :221 | MAX_CHAIN_LENGTH; cursor yalnız aynı aşamada korunur |
| idle → busy → success/uncertain → refresh → idle | mobile/lib/providers/request_provider.dart:109 | busy eşzamanlı komutu engeller; network/protocol/5xx belirsiz |
| kimlik değişimi → yerel sıfırlama | mobile/lib/providers/request_provider.dart:18 | generation/load artırılır; eski sonuç uygulanmaz |

Okuyan kopyalar ve sınırlar: convex/crons.ts:5; :8; :101; :117; :122 günlük/aylık yollar. PDKS ve izin durumunu ilerleten ayrı cron yok: gün sınıfı saatle türetilir; izin kararı kullanıcı mutationı. employeeAuth setup cleanup sayfalarla devam eder; token/session cleanup retention ile siler; ham PDKS/leaves purge işi yok. Mobil unknown sonucunda otomatik submit retry yapmaz; refresh ile uzlaştırır.

### 23. Personel/ziyaretçi rıza yaşam döngüsü

Durumlar: grantedAt var, revokedAt yok → aktif; revokedAt var → geri alınmış. consentType: biometric_face, biometric_fingerprint, card, photo, visitor_kvkk. Zorlama: schema enum; grantKvkkConsent aktif kaydı kontrol eder, DB tekillik kısıtı yoktur. Bulgu: B-07.

| Kaynak → hedef | Yazan yol | Ön-koşul kontrolü |
|---|---|---|
| yok → verilmiş visitor_kvkk | convex/visitors.ts:89 | aktif onay yok; notice URL/sürüm doğrulanır |
| verilmiş → geri alınmış | convex/lib/employeeCascade.ts:174 | revokedAt boşsa; kişi silme cascade'i |
| eski personel türü → yeni aktif onay | üretim yazarı bulunmadı | eski türler yalnız schema'da kalmış |

Okuyan kopyalar: convex/visitors.ts:64 aktifKvkkConsentId; convex/files.ts:25 ve :80 belge bağlantıları; web ziyaretçi formu Alan C'ye aittir. Mobil personel için bağımsız consent yönetim ekranı saptanmadı. Tablo silinmemiştir ve ziyaretçi tarafında canlıdır; B alanındaki eski türleri ziyaretçi akışından ayırmak gerekir.

## Bulgular

| ID | Şiddet | Makine | Başlık | Kanıt dosya:satır | Senaryo | Önerilen düzeltme |
|---|---|---|---|---|---|---|
| B-01 | critical | 1 → 10 | Pasifleştirme geçmiş PDKS saatlerini hesap dışına çıkarır | convex/lib/employment.ts:8; convex/lib/pdksTable.ts:303; convex/employees.ts:388 | Requirements etkin, geçmiş ayda vardiyası ve ölçülmüş okumaları olan kişi isActive=false yapılır, employmentEndDate boş kalır → eski günler notEmployed, okumalar/manuel saatler kaldırılmış olarak hesaplanır | Erişim aktifliğinden bağımsız tarihli istihdam dönemini sakla; geçmiş gerçek saatleri koru |
| B-02 | high | 6 | Pasifleştirme kalıcı oturum iptali sağlamıyor | convex/lib/employeeAuth.ts:26; :34; convex/employees.ts:388 | T tokenı henüz süresi dolmadan kişi pasife, sonra aktife alınır → T aynı passwordVersion ile yeniden geçerli olur | Pasifleştirme/işten ayrılmada auth sürümünü artır veya oturumları iptal et |
| B-03 | high | 19 | Düzeltme kuyruğu 200 kayıtta kesilip ilerlemeyen cursor üretiyor | convex/attendanceCorrections.ts:74; :80 | Tek projede 201 pending → ilk 200 sonrası cursor=200, page=[], isDone=false ve yine cursor=200; en eski talebe sayfalamayla ulaşılamaz | Gerçek indeks cursoruyla paginate et veya kaynak başına ilerlemeyi cursor içinde sakla |
| B-04 | high | 21 | Başarısız aylık gönderim takip ve tekrar denemesiz kaybolur | convex/actions/sendScheduledReports.ts:44; convex/crons.ts:8 | SMTP aylık çalışmada hata verir → yalnız console.error, lastSentAt değişmez, gelecek aya kadar yeniden deneme planlanmaz | Dönem bazlı delivery kaydı, failed/retryAt/attempts ve sınırlı retry ekle |
| B-05 | medium | 21 | Gönderim eski ayarla yapılırken yeni ayar gönderildi işaretlenebilir | convex/actions/sendScheduledReports.ts:21; :43; convex/reports.ts:341 | Query email=A'yı okur, yönetici email=B kaydeder, action A'ya yollar, mutation aynı ID'deki B ayarına lastSentAt yazar | Ayar sürümü ve alıcıyı teslim kaydına bağla; markReportSent beklenen sürümü doğrulasın |
| B-06 | low | 18 | İzin bakiyesi şeması iş akışına bağlı değil | convex/schema.ts:1295; convex/lib/adminGuards.ts:73 | İzin approved olur → leaveBalances için insert/patch yok; tablo durumu onayları temsil edemez | Kullanılmayan tabloyu kaldır veya tek işlemde bakiye güncelleme sözleşmesi kur |
| B-07 | low | employeeConsents | Eski personel consentType değerleri üretim yazarı olmayan kalıntılar | convex/schema.ts:1351; convex/visitors.ts:91 | biometric_face/fingerprint/card/photo değerleri schema'da kalıyor, mevcut üretim yazarı yalnız visitor_kvkk üretir | Eski veriyi inceleyerek kaldırma/legacy belgeleme yap; visitor_kvkk tablosunu yanlışlıkla kaldırma |

### Kanıt alıntıları ve sınırlar

**B-01:** `convex/lib/employment.ts:8–11`:
```ts
if (employee.employmentEndDate) return dateKey <= employee.employmentEndDate;
return employee.isActive === true;
```
`convex/lib/pdksTable.ts:303–308`:
```ts
const outsideEmployment = params.policyFor?.(date).punchMode === "requirements" && employee !== null && !employedOn(employee, date);
const readings = noShift || outsideEmployment ? [] : byDate.get(date) ?? [];
const manual = noShift || outsideEmployment ? undefined : params.manualPdksByEmpDate.get(`${empKey}__${date}`);
```
Somut girdi: 2026-10-05 günü giriş/çıkışı olan aktif personel, requirements policy ve atanmış vardiya; kasımda yalnız isActive=false. Eski ekim hesabı aynı ham kayıtlar durmasına rağmen okumasız/manuel verisiz olur. `employment.ts` yorumu eski pasifleri geçmişten dışlamayı açıkça söylüyor; risk, erişim pasifleştirmenin aynı alanı yazmasıdır. Canlı bordro sonucu çalıştırılmadı; veri silinmesi değil yeniden hesaplamada saat kaybı raporlanıyor.

**B-02:** `convex/lib/employeeAuth.ts:26–34`:
```ts
if (employee.isActive === false) throw mobileError("EMPLOYEE_INACTIVE");
if (!auth?.passwordHash || (session.passwordVersion ?? 0) !== (auth.passwordVersion ?? 0)) {
  throw mobileError("SESSION_REVOKED");
```
`convex/employees.ts:388` normal update personel alanını yazar; auth sürümü bu geçişte artırılmaz. `convex/employeeTermination.ts:36` closeAccess da isActive=false yapar; :105 reinstate yeniden true yapar. Koşul: oturumun expiresAt'i hâlâ gelecekte ve arada şifre değiştirilmemiş. Pasifken erişim engeli çalışır; tekrar aktifleştirmeden sonra kalıcı iptal varsayımı bozulur. Politika askıya alma sonrası eski oturumu bilerek açmayı istiyorsa bu bulgu ürün kararıyla düşürülebilir; mevcut mekanik davranış doğrulandı.

**B-03:** `convex/attendanceCorrections.ts:74–80`:
```ts
const hasMore = projectRows.some(rows => rows.length === 200);
const page = all.slice(start, start + Math.min(args.paginationOpts.numItems, 100));
return { /* ... */ isDone: start + page.length >= all.length && !hasMore, hasMore, continueCursor: String(start + page.length) };
```
Önceki satır her proje için `.order("desc").take(200)` kullanır. Tek proje + 201 kayıt örneği hiçbir eşzamanlı yazı gerektirmez. Kuyruktaki kayıtlar kararlandıkça eski talep öne gelebilir; yüksek hacimde sürekli yeni pending ile görünmez kalır. Tam 200 kayıtta da son sayfa isDone=false verir. UI hasMore uyarısı veri kesilmesini görünür kılabilir; backend cursor yine daha eski veriye ulaşmaz.

**B-04:** `convex/actions/sendScheduledReports.ts:45–48`:
```ts
if (sent.ok) await ctx.runMutation(internal.reports.markReportSent, { scheduleId: s._id });
else console.error("Zamanlanmış rapor gönderilemedi", s._id, sent.channel, sent.error);
} catch (error: unknown) {
```
Hata catch içinde de yalnız loglanır; action başarıyla tamamlanır. `crons.ts:8` ayın birinde çalıştırır, yeniden deneme cron'u yok. Bu bir e-posta hatırlatmasıdır; bordro dosyası gönderimi değildir. Gönderim başarılı olup markReportSent öncesi kesilme ve aynı dönem action'ının iki kez çağrılması için de dönem bazlı tekillik yok; bunlar otomatik tekrarın gerçekleştiği iddiası değil, aynı idempotency eksikliğinin sınırlarıdır.

**B-05:** `convex/actions/sendScheduledReports.ts:44–45`:
```ts
const sent = await deliverProjectMail(ctx, s.projectId, { to: s.email, subject, html });
if (sent.ok) await ctx.runMutation(internal.reports.markReportSent, { scheduleId: s._id });
```
`convex/reports.ts:340–341`:
```ts
if (!schedule?.enabled || !await resolveScheduleScope(ctx, schedule)) return;
await ctx.db.patch(schedule._id, { lastSentAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
```
Query → dış posta çağrısı → mutation tek işlem değildir; settings.updatedAt veya alıcı karşılaştırılmaz. Scope, gönderim özeti okunurken tekrar denetleniyor; bu bulgu yetkisiz rapor içeriği sızıntısı iddiası değildir.

**B-06:** `convex/schema.ts:1300–1303`:
```ts
 totalDays: v.number(),
 usedDays: v.number(),
 remainingDays: v.number(),
```
İçerik taraması üretimde yalnız schema ve adminGuards idari silme bağımlılığını buldu; `leaves.ts` ve `leaveRequests.ts` onay yolları bakiye yazmıyor. DB'de mevcut eski kayıt olup olmadığı salt kod incelemesinden bilinmez. Eksik uygulanmış özellik için critical maaş hatası iddia edilmedi.

**B-07:** `convex/visitors.ts:89–91`:
```ts
const consentId = await ctx.db.insert("employeeConsents", {
  employeeId,
  consentType: "visitor_kvkk",
```
Schema diğer dört türü de kabul ediyor; kişi cascade'i revokedAt yazıyor (`convex/lib/employeeCascade.ts:174`), files.ts belge bağlantısını okuyor. Bu nedenle tablonun kendisi değil yalnız eski üretim-yazarsız değerler düşük şiddetli kalıntıdır. Eski kayıtların bulunması olasıdır, silme önerisi veri incelemesi gerektirir.

## Ek A — İlgili tabloların tüm şema alanları

Satır numarasıyla tam alan tanımları aşağıdadır; sistem alanları `_id` ve `_creationTime` Convex tarafından otomatik eklenir. employees ziyaretçi alanları bağlam için korunmuş, ziyaretçi makinesi Alan C'ye bırakılmıştır. Paylaşılan validator alanları ayrıca eklenmiştir.

### employees

```ts
93:   employees: defineTable({
94:     hasDepartmentHistory: v.optional(v.boolean()),
95:     projectId: v.optional(v.id("projects")),
96:     firstName: v.string(),
97:     lastName: v.string(),
98:     email: v.string(),
99:     tcNo: v.optional(v.string()),
100:     cardNumber: v.string(),
101:     hikCardless: v.optional(v.boolean()),
102:     payrollCode: v.optional(v.string()),
103:     departmentId: v.optional(v.id("departments")),
104:     companyId: v.optional(v.id("companies")),
105:     positionId: v.optional(v.id("positions")),
106:     shiftId: v.optional(v.id("shifts")),
107:     accessRuleId: v.optional(v.id("accessRules")),
108:     photoUrl: v.optional(v.string()),
109:     photoStorageId: v.optional(v.id("_storage")),
110:     isActive: v.optional(v.boolean()),
111:     employmentEndDate: v.optional(v.string()),
112:     terminationType: v.optional(v.union(
113:       v.literal("resignation"), v.literal("employerTermination"),
114:       v.literal("retirement"), v.literal("contractEnd"), v.literal("other"), v.literal("transfer"),
115:     )),
116:     terminationReason: v.optional(v.string()),
117:     sgkExitCode: v.optional(v.string()),
118:     terminatedAt: v.optional(v.string()),
119:     terminatedBy: v.optional(v.id("users")),
120:     transferredFromEmployeeId: v.optional(v.id("employees")),
121:     transferredToEmployeeId: v.optional(v.id("employees")),
122:     transferredCardNumber: v.optional(v.string()),
123:     notes: v.optional(v.string()),
124:     shift: v.optional(v.string()),
125:     hourlyRate: v.optional(v.number()),
126:     monthlySalary: v.optional(v.number()),
130:     isVisitor: v.optional(v.boolean()),
132:     accessExpiresAt: v.optional(v.string()),
134:     accessStartsAt: v.optional(v.string()),
135:     visitorCompany: v.optional(v.string()),
136:     visitorPhone: v.optional(v.string()),
137:     visitPurpose: v.optional(v.string()),
139:     hostEmployeeId: v.optional(v.id("employees")),
140:     mobileVisitorRequestId: v.optional(v.string()),
141:     mobileVisitorRequestFingerprint: v.optional(v.string()),
142:     mobileVisitorNoticeUrl: v.optional(v.string()),
143:     mobileVisitorNoticeVersion: v.optional(v.string()),
145:     visitorStatus: v.optional(
146:       v.union(
147:         v.literal("preRegistered"),
148:         v.literal("checkedIn"),
149:         v.literal("checkedOut"),
150:         v.literal("expired"),
151:       ),
152:     ),
153:     createdAt: v.optional(v.string()),
154:     updatedAt: v.optional(v.string()),
155:   })
156:     .index("by_active_employment_end", ["isActive", "employmentEndDate"])
157:     .index("by_project", ["projectId"])
158:     .index("by_email", ["email"])
159:     .index("by_card", ["cardNumber"])
160:     .index("by_tc", ["tcNo"])
161:     .index("by_visitor", ["isVisitor"])
162:     .index("by_department", ["departmentId"])
163:     .index("by_company", ["companyId"])
164:     .index("by_position", ["positionId"])
165:     .index("by_photo_storage", ["photoStorageId"])
166:     .index("by_project_visitor", ["projectId", "isVisitor"])
167:     .index("by_project_host_visitor", ["projectId", "hostEmployeeId", "isVisitor"])
168:     .index("by_host_mobile_visitor_request", ["hostEmployeeId", "mobileVisitorRequestId"])
170:     .index("by_project_visitor_expiry", ["projectId", "isVisitor", "accessExpiresAt"])
172:     .index("by_project_visitor_status_expiry", ["projectId", "isVisitor", "visitorStatus", "accessExpiresAt"])
175:     .index("by_project_visitor_active_expiry", ["projectId", "isVisitor", "isActive", "accessExpiresAt"])
176:     .searchIndex("search_first_name", { searchField: "firstName", filterFields: ["projectId"] })
177:     .searchIndex("search_last_name", { searchField: "lastName", filterFields: ["projectId"] })
179:     .index("by_visitor_active_expiry", ["isVisitor", "isActive", "accessExpiresAt"]),
180: 
```

### checkInTokens

```ts
181:   checkInTokens: defineTable({
182:     employeeId: v.id("employees"),
183:     purpose: v.optional(v.literal("reader")),
184:     projectId: v.optional(v.id("projects")),
185:     authVersion: v.optional(v.number()),
186:     sessionId: v.optional(v.id("employeeSessions")),
187:     token: v.string(),
188:     expiresAt: v.string(),
189:     usedAt: v.optional(v.string()),
190:     employeeName: v.optional(v.string()),
191:     locationRecorded: v.optional(v.boolean()),
192:     createdAt: v.string(),
193:   })
194:     .index("by_expiresAt", ["expiresAt"])
195:     .index("by_usedAt", ["usedAt"])
196:     .index("by_token", ["token"])
197:     .index("by_employee", ["employeeId"]),
198: 
```

### employeeAuth

```ts
199:   employeeAuth: defineTable({
200:     employeeId: v.id("employees"),
201:     projectId: v.optional(v.id("projects")),
202:     email: v.optional(v.string()),
203:     phone: v.optional(v.string()),
204:     passwordHash: v.optional(v.string()),
205:     passwordVersion: v.optional(v.number()),
206:     setupToken: v.optional(v.string()),
207:     tokenExpiresAt: v.optional(v.string()),
208:     lastLogin: v.optional(v.string()),
209:     createdAt: v.string(),
210:     updatedAt: v.string(),
211:   })
212:     .index("by_employee", ["employeeId"])
213:     .index("by_token", ["setupToken"]),
214: 
```

### employeeSessions

```ts
215:   employeeSessions: defineTable({
216:     employeeId: v.id("employees"),
217:     passwordVersion: v.optional(v.number()),
218:     token: v.string(),
219:     expiresAt: v.string(),
220:     createdAt: v.string(),
221:     lastUsedAt: v.optional(v.string()),
222:   })
223:     .index("by_expiresAt", ["expiresAt"])
224:     .index("by_token", ["token"])
225:     .index("by_employee", ["employeeId"]),
226: 
```

### pdksRecords

```ts
1021:   pdksRecords: defineTable({
1022:     projectId: v.optional(v.id("projects")),
1023:     employeeId: v.id("employees"),
1024:     employeeFirstName: v.string(),
1025:     employeeLastName: v.string(),
1026:     date: v.string(),
1027:     entryTime: v.optional(v.string()),
1028:     exitTime: v.optional(v.string()),
1029:     status: v.string(),
1030:     manualEntry: v.optional(v.boolean()),
1031:     manualNote: v.optional(v.string()),
1032:     editedBy: v.optional(v.id("users")),
1033:     editedAt: v.optional(v.number()),
1034:     createdAt: v.string(),
1035:     updatedAt: v.string(),
1036:   })
1037:     .index("by_project", ["projectId"])
1038:     .index("by_employee", ["employeeId"])
1039:     .index("by_date", ["date"])
1040:     .index("by_employee_date", ["employeeId", "date"]),
1041: 
```

### pdksRuleVersions

```ts
277:   pdksRuleVersions: defineTable({
278:     calculationMode: v.optional(v.union(v.literal("firstLast"), v.literal("eachPunch"))),
279:     minPunchIntervalMinutes: v.optional(v.number()),
280:     projectId: v.id("projects"),
281:     effectiveFrom: v.string(),
282:     punchMode: v.union(v.literal("legacy"), v.literal("requirements")),
283:     requireCheckIn: v.optional(v.boolean()),
284:     requireCheckOut: v.optional(v.boolean()),
285:     missingRequiredPunch: v.optional(v.union(v.literal("absent"), v.literal("review"))),
286:     noPunch: v.optional(v.union(v.literal("absent"), v.literal("review"))),
287:     checkpointMode: v.union(v.literal("all"), v.literal("selected")),
288:     createdAt: v.string(),
289:     createdBy: v.id("users"),
290:   }).index("by_projectId_and_effectiveFrom", ["projectId", "effectiveFrom"]),
```

### pdksCheckpointSelections

```ts
291:   pdksCheckpointSelections: defineTable({
292:     projectId: v.id("projects"),
293:     ruleVersionId: v.id("pdksRuleVersions"),
294:     targetType: v.union(v.literal("door"), v.literal("device"), v.literal("reader")),
295:     readerId: v.optional(v.id("readers")),
296:     pointType: v.optional(v.union(v.literal("both"), v.literal("entry"), v.literal("exit"))),
297:     deviceId: v.id("devices"),
298:     doorId: v.optional(v.id("doors")),
299:     ioId: v.optional(v.number()),
301:     hikReaderNo: v.optional(v.number()),
302:   }).index("by_ruleVersionId", ["ruleVersionId"]),
303: 
```

### employeeDepartmentHistory

```ts
592:   employeeDepartmentHistory: defineTable({
593:     employeeId: v.id("employees"),
594:     projectId: v.id("projects"),
595:     departmentId: v.optional(v.id("departments")),
596:     companyId: v.optional(v.id("companies")),
597:     validFrom: v.string(),
598:     source: v.union(v.literal("baseline"), v.literal("change")),
599:     createdAt: v.string(),
600:   })
601:     .index("by_employee_validFrom", ["employeeId", "validFrom"])
602:     .index("by_project_employee", ["projectId", "employeeId"]),
603: 
```

### shifts

```ts
1063:   shifts: defineTable({
1064:     scheduleMode: v.optional(scheduleModeValidator),
1065:     dayPlan: v.optional(v.array(v.boolean())),
1066:     name: v.string(),
1067:     color: v.optional(shiftColorValidator),
1068:     projectId: v.optional(v.id("projects")),
1069:     ...shiftRuleFields,
1070:     /** Son geçmiş sürümün bitiş günü; varsa hesaplar tarihe göre `shiftVersions`'tan okunur. */
1071:     versionedUntil: v.optional(v.string()),
1072:     isActive: v.optional(v.boolean()),
1073:     createdAt: v.string(),
1074:     updatedAt: v.string(),
1075:   }).index("by_project", ["projectId"]),
1076: 
1077:   /** Vardiya hesap alanlarının eski sürümleri: `validUntil` dahil o güne kadar geçerli. Tanım silinince silinir. */
```

### shiftVersions

```ts
1078:   shiftVersions: defineTable({
1079:     shiftId: v.id("shifts"),
1080:     validUntil: v.string(),
1081:     rules: shiftRulesValidator,
1082:     createdAt: v.string(),
1083:     createdBy: v.optional(v.id("users")),
1084:   }).index("by_shift_until", ["shiftId", "validUntil"]),
1085: 
```

### shiftAssignments

```ts
1086:   shiftAssignments: defineTable({
1087:     employeeId: v.id("employees"),
1088:     plan: v.optional(shiftPlanValidator),
1089:     shiftId: v.id("shifts"),
1090:     projectId: v.optional(v.id("projects")),
1091:     startDate: v.string(),
1092:     endDate: v.string(),
1093:     weekPattern: v.optional(v.array(v.string())),
1094:     createdAt: v.string(),
1095:     updatedAt: v.string(),
1096:   })
1097:     .index("by_employee", ["employeeId"])
1098:     .index("by_shift", ["shiftId"])
1099:     .index("by_project", ["projectId"])
1100:     .index("by_dates", ["startDate", "endDate"])
1101:     .index("by_project_end", ["projectId", "endDate"])
1102:     .index("by_employee_end", ["employeeId", "endDate"]),
1103: 
```

### departmentShiftAssignments

```ts
1104:   departmentShiftAssignments: defineTable({
1105:     departmentId: v.id("departments"),
1106:     ...shiftPlanFields,
1107:     projectId: v.id("projects"),
1108:   })
1109:     .index("by_department_end", ["departmentId", "endDate"])
1110:     .index("by_project_end", ["projectId", "endDate"])
1111:     .index("by_shift", ["shiftId"]),
1112: 
```

### shiftPlanRefs

```ts
1113:   shiftPlanRefs: defineTable({
1114:     projectId: v.id("projects"),
1115:     shiftId: v.id("shifts"),
1116:     assignmentId: v.optional(v.id("shiftAssignments")),
1117:     departmentAssignmentId: v.optional(v.id("departmentShiftAssignments")),
1118:   })
1119:     .index("by_project", ["projectId"])
1120:     .index("by_shift", ["shiftId"])
1121:     .index("by_assignment", ["assignmentId"])
1122:     .index("by_department_assignment", ["departmentAssignmentId"]),
1123: 
```

### leaves

```ts
1226:   leaves: defineTable({
1227:     employeeId: v.id("employees"),
1228:     projectId: v.optional(v.id("projects")),
1229:     leaveType: v.union(
1230:       v.literal("annual"),
1231:       v.literal("sick"),
1232:       v.literal("excuse"),
1233:       v.literal("unpaid"),
1234:       v.literal("parental"),
1235:       v.literal("marriage"),
1236:       v.literal("bereavement"),
1237:       v.literal("paternity"),
1238:       v.literal("lactation"),
1239:       v.literal("compensatory")
1240:     ),
1241:     startDate: v.string(),
1242:     endDate: v.string(),
1243:     status: v.union(
1244:       v.literal("pending"),
1245:       v.literal("approved"),
1246:       v.literal("rejected")
1247:     ),
1248:     approvedBy: v.optional(v.id("users")),
1249:     notes: v.optional(v.string()),
1250:     decisionNote: v.optional(v.string()),
1251:     decidedAt: v.optional(v.string()),
1254:     source: v.optional(v.union(v.literal("admin"), v.literal("employee"))),
1255:     createdAt: v.string(),
1256:     updatedAt: v.string(),
1257:   })
1258:     .index("by_employee", ["employeeId"])
1259:     .index("by_project", ["projectId"])
1260:     .index("by_status", ["status"])
1261:     .index("by_project_status", ["projectId", "status"])
1262:     .index("by_dates", ["startDate", "endDate"])
1263:     .index("by_project_start", ["projectId", "startDate"])
1264:     .index("by_project_end", ["projectId", "endDate"])
1265:     .index("by_project_type_end", ["projectId", "leaveType", "endDate"])
1266:     .index("by_project_employee_end", ["projectId", "employeeId", "endDate"])
1267:     .index("by_project_employee_type_end", ["projectId", "employeeId", "leaveType", "endDate"])
1268:     .index("by_employee_start", ["employeeId", "startDate"]),
1269: 
```

### attendanceCorrections

```ts
1271:   attendanceCorrections: defineTable({
1272:     employeeId: v.id("employees"),
1273:     projectId: v.optional(v.id("projects")),
1274:     date: v.string(), // YYYY-MM-DD (TR günü)
1275:     correctionType: v.union(v.literal("checkIn"), v.literal("checkOut"), v.literal("both")),
1276:     requestedCheckIn: v.optional(v.string()), // HH:mm
1277:     requestedCheckOut: v.optional(v.string()), // HH:mm
1278:     reason: v.string(),
1279:     status: v.union(
1280:       v.literal("pending"),
1281:       v.literal("approved"),
1282:       v.literal("rejected"),
1283:       v.literal("withdrawn")
1284:     ),
1285:     decidedBy: v.optional(v.id("users")),
1286:     decidedAt: v.optional(v.string()),
1287:     decisionNote: v.optional(v.string()),
1288:     createdAt: v.string(),
1289:     updatedAt: v.string(),
1290:   })
1291:     .index("by_employee", ["employeeId"])
1292:     .index("by_project_status", ["projectId", "status"])
1293:     .index("by_employee_date", ["employeeId", "date"]),
1294: 
```

### leaveBalances

```ts
1295:   leaveBalances: defineTable({
1296:     employeeId: v.id("employees"),
1297:     projectId: v.optional(v.id("projects")),
1298:     leaveType: v.string(),
1299:     year: v.number(),
1300:     totalDays: v.number(),
1301:     usedDays: v.number(),
1302:     remainingDays: v.number(),
1303:     createdAt: v.string(),
1304:     updatedAt: v.string(),
1305:   })
1306:     .index("by_employee", ["employeeId"])
1307:     .index("by_project", ["projectId"])
1308:     .index("by_employee_year", ["employeeId", "year"]),
1309: 
```

### workSettings

```ts
1310:   workSettings: defineTable({
1311:     projectId: v.optional(v.id("projects")),
1312:     workStartTime: v.optional(v.string()),
1313:     workEndTime: v.optional(v.string()),
1314:     lunchBreakStart: v.optional(v.string()),
1315:     lunchBreakEnd: v.optional(v.string()),
1316:     maxLateMinutes: v.optional(v.number()),
1317:     earlyExitToleranceMinutes: v.optional(v.number()),
1318:     allowLateEntry: v.optional(v.boolean()),
1319:     annualOvertimeLimitHours: v.optional(v.number()),
1320:     overtimeMultiplier: v.optional(v.number()),
1321:     overtimeStartToleranceMinutes: v.optional(v.number()),
1322:     monthlyHoursBase: v.optional(v.number()),
1323:     updatedAt: v.optional(v.string()),
1324:   }).index("by_project", ["projectId"]),
1325: 
```

### employeeConsents

```ts
1348:   employeeConsents: defineTable({
1349:     employeeId: v.id("employees"),
1350:     consentType: v.union(
1351:       v.literal("biometric_face"),
1352:       v.literal("biometric_fingerprint"),
1353:       v.literal("card"),
1354:       v.literal("photo"),
1356:       v.literal("visitor_kvkk"),
1357:     ),
1358:     grantedAt: v.string(),
1359:     revokedAt: v.optional(v.string()),
1360:     documentUrl: v.optional(v.string()),
1361:     documentStorageId: v.optional(v.id("_storage")),
1363:     documentVersion: v.optional(v.string()),
1364:     grantedBy: v.optional(v.id("users")),
1365:     notes: v.optional(v.string()),
1366:   })
1367:     .index("by_employee", ["employeeId"])
1368:     .index("by_employee_type", ["employeeId", "consentType"])
1369:     .index("by_document_storage", ["documentStorageId"]),
1370: 
```

### holidays

```ts
1381:   holidays: defineTable({
1382:     projectId: v.optional(v.id("projects")),
1383:     date: v.string(),
1384:     name: v.string(),
1385:     isHalfDay: v.optional(v.boolean()),
1386:     type: v.optional(
1387:       v.union(v.literal("national"), v.literal("religious"), v.literal("company")),
1388:     ),
1389:     createdAt: v.string(),
1390:   })
1391:     .index("by_project", ["projectId"])
1392:     .index("by_project_date", ["projectId", "date"])
1393:     .index("by_date", ["date"]),
1394: 
```

### overtimeRates

```ts
1395:   overtimeRates: defineTable({
1396:     projectId: v.optional(v.id("projects")),
1397:     weekdayMultiplier: v.number(),
1398:     weekendMultiplier: v.number(),
1399:     holidayMultiplier: v.number(),
1400:     nightShiftMultiplier: v.number(),
1401:     nightShiftStart: v.string(),
1402:     nightShiftEnd: v.string(),
1404:     nightCombineMode: v.optional(v.union(v.literal("max"), v.literal("multiply"), v.literal("additive"))),
1405:     overtimeBasis: v.optional(v.union(v.literal("weekly45"), v.literal("dailyShift"))),
1406:     nightShiftDayMode: v.optional(v.union(v.literal("shiftStart"), v.literal("splitAtMidnight"))),
1407:     updatedAt: v.string(),
1408:   }).index("by_project", ["projectId"]),
1409: 
```

### reportScheduleSettings

```ts
1457:   reportScheduleSettings: defineTable({
1458:     userId: v.id("users"),
1459:     projectId: v.optional(v.id("projects")),
1460:     reportType: v.string(),
1461:     email: v.string(),
1462:     enabled: v.boolean(),
1463:     lastSentAt: v.optional(v.string()),
1464:     createdAt: v.string(),
1465:     updatedAt: v.string(),
1466:   })
1467:     .index("by_user", ["userId"])
1468:     .index("by_project", ["projectId"])
1469:     .index("by_user_project", ["userId", "projectId"]),
1470: 
```

### accessTransfers

```ts
513:   accessTransfers: defineTable({
514:     kind: v.union(v.literal("employee"), v.literal("ide_panel")),
515:     status: v.union(v.literal("requested"), v.literal("revoking"), v.literal("revoked"), v.literal("provisioning"), v.literal("done"), v.literal("stuck"), v.literal("cancelled")),
516:     sourceProjectId: v.id("projects"), targetProjectId: v.id("projects"),
517:     employeeId: v.id("employees"), targetEmployeeId: v.id("employees"), cardNumber: v.string(),
518:     targetPlan: v.object({ accessRuleIds: v.array(v.id("accessRules")), departmentId: v.optional(v.id("departments")) }),
520:     sourceAccessRuleIds: v.array(v.id("accessRules")),
521:     requestedBy: v.id("users"), requestedAt: v.number(), deadlineAt: v.number(),
522:     completedAt: v.optional(v.number()), stuckReason: v.optional(v.string()), lastError: v.optional(v.string()),
523:   }).index("by_status_deadline", ["status", "deadlineAt"])
524:     .index("by_employee_status", ["employeeId", "status"])
525:     .index("by_target_employee_status", ["targetEmployeeId", "status"])
526:     .index("by_source_project_requested_at", ["sourceProjectId", "requestedAt"]),
527: 
```

### accessTransferTargets

```ts
528:   accessTransferTargets: defineTable({
529:     transferId: v.id("accessTransfers"), employeeId: v.id("employees"), deviceId: v.id("devices"),
530:     brand: v.union(v.literal("hikvision"), v.literal("ide_smart")),
531:     state: v.union(v.literal("pending"), v.literal("confirmed"), v.literal("failed"), v.literal("superseded"), v.literal("deviceRemoved")),
532:     lastError: v.optional(v.string()), confirmedAt: v.optional(v.number()), updatedAt: v.number(),
533:   }).index("by_transfer_state", ["transferId", "state"])
534:     .index("by_device_state", ["deviceId", "state"])
535:     .index("by_employee_device", ["employeeId", "deviceId"]),
536: 
```

Paylaşılan alanlar: convex/lib/shiftVersions.ts

```ts
1: import { v } from "convex/values";
2: import type { Doc, Id } from "../_generated/dataModel";
3: import type { QueryCtx } from "../_generated/server";
4: 
5: /** Giriş/çıkış penceresi alanları; `validWindow` ve esnek vardiya aynı biçimi paylaşır. */
6: const windowFields = {
7:   checkInStart: v.string(), checkInEnd: v.string(),
8:   checkOutStart: v.string(), checkOutEnd: v.string(),
9:   checkOutEndDayOffset: v.union(v.literal(0), v.literal(1)),
10: };
11: /**
12:  * Vardiya hesap alanlarının geçerlilik tarihli sürümleri.
13:  * `shifts` belgesi bugünden itibaren geçerli değerleri tutar; her `shiftVersions` satırı
14:  * `validUntil` tarihine kadar (dahil) geçerli olan ESKİ değerlerin anlık görüntüsüdür.
15:  * Ad ve aktiflik sürümlenmez; tür (sabit/esnek) değişikliği yeni tanım gerektirir.
16:  */
17: export const shiftRuleFields = {
18:   scheduleType: v.optional(v.union(v.literal("fixed"), v.literal("flexible"))),
19:   flexible: v.optional(v.object({
20:     requiredNetMinutes: v.number(),
21:     ...windowFields,
22:     maxSpanMinutes: v.number(),
23:     breakMode: v.union(v.literal("duration"), v.literal("existingLegal")),
24:     breakMinutes: v.optional(v.number()),
25:   })),
26:   validWindow: v.optional(v.object(windowFields)),
27:   absentAfterLateMinutes: v.optional(v.number()),
28:   minWorkMinutes: v.optional(v.number()),
29:   missingCheckInLateMinutes: v.optional(v.number()),
30:   holidayWorkRequired: v.optional(v.boolean()),
31:   startTime: v.string(),
32:   endTime: v.string(),
33:   breakStart: v.optional(v.string()),
34:   breakEnd: v.optional(v.string()),
35:   lateToleranceMinutes: v.optional(v.number()),
36:   earlyExitToleranceMinutes: v.optional(v.number()),
37:   overtimeStartToleranceMinutes: v.optional(v.number()),
38:   overtimeEnabled: v.optional(v.boolean()),
39: };
40: export const shiftRulesValidator = v.object(shiftRuleFields);
```

Paylaşılan alanlar: convex/lib/shiftPlan.ts

```ts
1: import { ConvexError, v, type Infer } from "convex/values";
2: import type { Doc, Id } from "../_generated/dataModel";
3: import { flexibleSchedule, flexibleSessionEnd } from "./pdksFlexible";
4: 
5: export const MAX_SHIFTS_PER_DAY = 8;
6: export const MIN_SPLIT_GAP_MINUTES = 30;
7: export const MAX_DAY_CYCLE = 31;
8: export const MAX_WEEK_CYCLE = 52;
9: const DAY = 86_400_000;
10: const WEEKDAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
11: export const daySlotValidator = v.array(v.id("shifts"));
12: export const shiftPlanValidator = v.union(
13:   v.object({ kind: v.literal("weekly"), shiftIds: daySlotValidator }),
14:   v.object({ kind: v.literal("dayCycle"), anchorDate: v.string(), slots: v.array(daySlotValidator) }),
15:   v.object({ kind: v.literal("weekCycle"), anchorDate: v.string(), slots: v.array(daySlotValidator) }),
16: );
17: export type ShiftPlan = Infer<typeof shiftPlanValidator>;
18: export const shiftPlanFields = {
19:   shiftId: v.id("shifts"), projectId: v.optional(v.id("projects")),
20:   startDate: v.string(), endDate: v.string(), weekPattern: v.optional(v.array(v.string())),
21:   plan: v.optional(shiftPlanValidator), createdAt: v.string(), updatedAt: v.string(),
22: };
```

## Ek B — Yazma yolu dizini

İlgili üretim modüllerinin `db.insert/patch/replace/delete` eşleşmeleri, durum atamaları ve export girişleri. Dolaylı patch nesneleri de yakalansın diye yalnız `status:` aranmamıştır. İzin kararı helper'ı ve plan ref helper'ı ortak yazardır. Bu dizindeki devre dışı bırakma/silme, admin cascade ve migration yolları runtime erişilebilir geçişlerle karıştırılmamalıdır; test fixture'ları dışarıda tutuldu.

```text
convex/attendanceCorrections.ts:15:export const submit = employeeAuthedMutation({
convex/attendanceCorrections.ts:30:    const id = await ctx.db.insert("attendanceCorrections", { ...args, reason: args.reason.trim(), employeeId: employee._id, projectId: employee.projectId, status: "pending", createdAt: now, updatedAt: now });
convex/attendanceCorrections.ts:31:    await writeAudit(ctx, { user: null, projectId: employee.projectId, action: "create", targetTable: "attendanceCorrections", targetId: id, newValue: { actorType: "employee", employeeId: employee._id, status: "pending" }, note: "Çalışan talebi" });
convex/attendanceCorrections.ts:36:export const withdraw = employeeAuthedMutation({
convex/attendanceCorrections.ts:42:    await ctx.db.patch(id, { status: "withdrawn", updatedAt: new Date().toISOString() });
convex/attendanceCorrections.ts:43:    await writeAudit(ctx, { user: null, projectId: row.projectId, action: "update", targetTable: "attendanceCorrections", targetId: id, oldValue: { actorType: "employee", employeeId: ctx.employee._id, status: row.status }, newValue: { actorType: "employee", employeeId: ctx.employee._id, status: "withdrawn" }, note: "Çalışan talebi" });
convex/attendanceCorrections.ts:48:export const listMine = employeeAuthedQuery({
convex/attendanceCorrections.ts:53:    status: v.union(v.literal("pending"), v.literal("approved"), v.literal("rejected"), v.literal("withdrawn")),
convex/attendanceCorrections.ts:65:export const listPending = authedQuery({
convex/attendanceCorrections.ts:99:  await ctx.db.patch(id, { status: approve ? "approved" : "rejected", decidedBy: ctx.user._id, decidedAt: now, decisionNote: note, updatedAt: now });
convex/attendanceCorrections.ts:100:  await writeAudit(ctx, { user: ctx.user, projectId: row.projectId, action: "update", targetTable: "attendanceCorrections", targetId: id, oldValue: { status: row.status }, newValue: { status: approve ? "approved" : "rejected", date: row.date }, note });
convex/attendanceCorrections.ts:103:export const approve = authedMutation({ args: { id: v.id("attendanceCorrections"), note: v.optional(v.string()) }, handler: async (ctx, args) => { await decision(ctx, args.id, true, args.note); return null; } });
convex/attendanceCorrections.ts:104:export const reject = authedMutation({ args: { id: v.id("attendanceCorrections"), note: v.string() }, handler: async (ctx, args) => { if (args.note.trim().length < 3 || args.note.length > 500) throw new ConvexError("Red gerekçesi en az 3 karakter olmalı"); await decision(ctx, args.id, false, args.note.trim()); return null; } });
convex/employeeAuth.ts:54:export const getSetupEmailTarget = internalQuery({
convex/employeeAuth.ts:60:export const issueSetupEmailToken = internalMutation({
convex/employeeAuth.ts:70:    if (existing) await ctx.db.patch(existing._id, values);
convex/employeeAuth.ts:71:    else await ctx.db.insert("employeeAuth", { employeeId, ...values, createdAt: now });
convex/employeeAuth.ts:80:export const getByEmployee = internalQuery({
convex/employeeAuth.ts:90:export const getByToken = query({
convex/employeeAuth.ts:110:export const getByTokenInternal = internalQuery({
convex/employeeAuth.ts:124:export const create = internalMutation({
convex/employeeAuth.ts:135:    return await ctx.db.insert("employeeAuth", {
convex/employeeAuth.ts:144:export const update = internalMutation({
convex/employeeAuth.ts:169:      await ctx.db.patch(authId, clean);
convex/employeeAuth.ts:174:export const consumeSetupToken = internalMutation({
convex/employeeAuth.ts:177:    v.object({ status: v.literal("invalid") }),
convex/employeeAuth.ts:178:    v.object({ status: v.literal("expired") }),
convex/employeeAuth.ts:179:    v.object({ status: v.literal("ok") }),
convex/employeeAuth.ts:186:    if (!auth) return { status: "invalid" as const };
convex/employeeAuth.ts:188:      return { status: "expired" as const };
convex/employeeAuth.ts:192:    return { status: "ok" as const };
convex/employeeAuth.ts:198:export const cleanupExpiredSetupTokens = internalMutation({
convex/employeeAuth.ts:209:        await ctx.db.patch(auth._id, {
convex/employeeAuth.ts:230:export const signIn = mutation({
convex/employeeAuth.ts:307:    await ctx.db.insert("employeeSessions", {
convex/employeeAuth.ts:309:      passwordVersion: auth.passwordVersion ?? 0,
convex/employeeAuth.ts:316:    await ctx.db.patch(auth._id, {
convex/employeeAuth.ts:343:export const signOut = mutation({
convex/employeeAuth.ts:352:      await ctx.db.delete(session._id);
convex/employeeAuth.ts:359:export const changePassword = employeeAuthedMutation({
convex/employeeAuth.ts:401:export const me = employeeAuthedQuery({
convex/employeeAuth.ts:443:export const wipeLegacyHashes = internalMutation({
convex/leaveRequests.ts:22:export const submit = employeeAuthedMutation({
convex/leaveRequests.ts:36:    const id = await ctx.db.insert("leaves", { employeeId: employee._id, projectId: employee.projectId, ...args, status: "pending", source: "employee", createdAt: now, updatedAt: now });
convex/leaveRequests.ts:37:    await writeAudit(ctx, { user: null, projectId: employee.projectId, action: "create", targetTable: "leaves", targetId: id, newValue: { actorType: "employee", employeeId: employee._id, status: "pending" }, note: "Çalışan talebi" });
convex/leaveRequests.ts:42:export const withdraw = employeeAuthedMutation({
convex/leaveRequests.ts:48:    await ctx.db.delete(leaveId);
convex/leaveRequests.ts:49:    await writeAudit(ctx, { user: null, projectId: leave.projectId, action: "delete", targetTable: "leaves", targetId: leaveId, oldValue: { actorType: "employee", employeeId: ctx.employee._id, status: leave.status }, note: "Çalışan talebi" });
convex/leaveRequests.ts:54:export const listMine = employeeAuthedQuery({
convex/leaveRequests.ts:58:    status: v.union(v.literal("pending"), v.literal("approved"), v.literal("rejected")),
convex/leaveRequests.ts:89:export const listPending = authedQuery({
convex/leaveRequests.ts:134:export const pendingCount = authedQuery({
convex/leaveRequests.ts:157:  status: "approved" | "rejected",
convex/leaveRequests.ts:192:  await ctx.db.patch(leaveId, patch);
convex/leaveRequests.ts:199:    oldValue: { status: leave.status },
convex/leaveRequests.ts:206:export const approve = authedMutation({
convex/leaveRequests.ts:211:export const reject = authedMutation({
convex/employeeImport.ts:18:  department: v.optional(v.string()), position: v.optional(v.string()), company: v.optional(v.string()), isActive: v.optional(v.boolean()),
convex/employeeImport.ts:30:export const importChunk = authedMutation({
convex/employeeImport.ts:47:    const results: { rowNumber: number; status: "created" | "skippedDuplicate" | "error"; message: string }[] = [];
convex/employeeImport.ts:70:      if (errors.length) { results.push({ rowNumber: row.rowNumber, status: "error", message: errors.join("; ") }); continue; }
convex/employeeImport.ts:94:      if (duplicateMessage) { results.push({ rowNumber: row.rowNumber, status: "skippedDuplicate", message: duplicateMessage }); continue; }
convex/employeeImport.ts:95:      if (args.dryRun) { results.push({ rowNumber: row.rowNumber, status: "created", message: "İçe aktarmaya hazır" }); continue; }
convex/employeeImport.ts:97:      const employeeId = await ctx.db.insert("employees", {
convex/employeeImport.ts:103:        isActive: row.isActive ?? true, createdAt: now, updatedAt: now,
convex/employeeImport.ts:109:      results.push({ rowNumber: row.rowNumber, status: "created", message: "Kişi oluşturuldu" });
convex/employeeImport.ts:126:export const assignCards = authedMutation({
convex/employeeImport.ts:131:    const results: { employeeId: string; status: "assigned" | "error"; message: string }[] = [];
convex/employeeImport.ts:137:        results.push({ employeeId: assignment.employeeId, status: "error", message: "Kişiye erişim yetkiniz yok" });
convex/employeeImport.ts:147:        results.push({ employeeId: assignment.employeeId, status: "error", message: "Kart numarası biçimi geçersiz" });
convex/employeeImport.ts:152:        results.push({ employeeId: assignment.employeeId, status: "error", message: cardConflictMessage(cardNumber, conflict, "Kart numarası başka bir kişide kullanılıyor") });
convex/employeeImport.ts:157:      await ctx.db.patch(employee._id, { cardNumber, updatedAt: new Date().toISOString() });
convex/employeeImport.ts:159:      results.push({ employeeId: assignment.employeeId, status: "assigned", message: "Kart atandı" });
convex/employeeImport.ts:173:export const logExport = authedMutation({
convex/employeeTermination.ts:36:  await ctx.db.patch(employee._id, { isActive: false, updatedAt: now });
convex/employeeTermination.ts:52:export const terminate = authedMutation({
convex/employeeTermination.ts:85:    await ctx.db.patch(employeeId, updates);
convex/employeeTermination.ts:92:    await writeAudit(ctx, { user: ctx.user, projectId: employee.projectId, action: "update", targetTable: "employees", targetId: employeeId, oldValue: employee, newValue: { ...updates, isActive: args.employmentEndDate < today ? false : employee.isActive }, note: "İşten ayrılma" });
convex/employeeTermination.ts:97:export const reinstate = authedMutation({
convex/employeeTermination.ts:105:    await ctx.db.patch(employeeId, {
convex/employeeTermination.ts:108:      isActive: true, updatedAt: new Date().toISOString(),
convex/employeeTermination.ts:118:export const closeEndedEmployments = internalMutation({
convex/employeeTermination.ts:156:export const startTransfer = authedMutation({
convex/employeeTermination.ts:189:    const targetEmployeeId = await ctx.db.insert("employees", {
convex/employeeTermination.ts:194:      departmentId: args.departmentId, companyId, cardNumber: "", isActive: true, transferredFromEmployeeId: employee._id,
convex/employeeTermination.ts:197:    const transferId = await ctx.db.insert("accessTransfers", {
convex/employeeTermination.ts:198:      kind: "employee", status: "revoking", sourceProjectId: employee.projectId, targetProjectId: args.targetProjectId,
convex/employeeTermination.ts:206:      await ctx.db.insert("accessTransferTargets", { transferId, employeeId: employee._id, deviceId: device._id, brand: device.brand, state: "pending", updatedAt: Date.now() });
convex/employeeTermination.ts:208:    await ctx.db.patch(employee._id, { isActive: false, employmentEndDate: trTodayKey(), terminationType: "transfer", terminatedAt: now, terminatedBy: ctx.user._id, transferredToEmployeeId: targetEmployeeId, updatedAt: now });
convex/employeeTermination.ts:210:    for (const member of memberships) await ctx.db.delete(member._id);
convex/employeeTermination.ts:213:      for (const row of rows) await ctx.db.delete(row._id);
convex/employeeTermination.ts:217:      await ctx.db.patch(transferId, { status: "revoked" });
convex/employeeTermination.ts:238:    await ctx.db.patch(transferId, { status: "stuck", stuckReason: error, lastError: error });
convex/employeeTermination.ts:241:  await ctx.db.patch(transferId, { status: "provisioning" });
convex/employeeTermination.ts:243:  await ctx.db.patch(source._id, { cardNumber: "", transferredCardNumber: transfer.cardNumber, updatedAt: now });
convex/employeeTermination.ts:244:  await ctx.db.patch(target._id, { cardNumber: transfer.cardNumber, departmentId: transfer.targetPlan.departmentId, companyId, updatedAt: now });
convex/employeeTermination.ts:250:  await ctx.db.patch(transferId, { status: "done", completedAt: Date.now(), stuckReason: undefined, lastError: undefined });
convex/employeeTermination.ts:252:  for (const projectId of [transfer.sourceProjectId, transfer.targetProjectId]) await writeAudit(ctx, { user, projectId, action: "update", targetTable: "accessTransfers", targetId: transferId, newValue: { status: "done", employeeId: source._id, targetEmployeeId: target._id }, note: "Başka projeye taşıma tamamlandı" });
convex/employeeTermination.ts:254:export const completeTransfer = internalMutation({
convex/employeeTermination.ts:259:export const cancelTransfer = authedMutation({
convex/employeeTermination.ts:267:    await ctx.db.patch(transferId, { status: "cancelled", completedAt: Date.now() });
convex/employeeTermination.ts:270:      if (row.state !== "confirmed" && row.state !== "deviceRemoved") await ctx.db.patch(row._id, { state: "superseded", lastError: "Taşıma iptal edildi", updatedAt: Date.now() });
convex/employeeTermination.ts:273:        for (const op of ops) if ((op.operation === "deletePerson" || op.operation === "deleteCard") && operationPayload(op.payload).employeeId === source._id) await ctx.db.patch(op._id, { status: "done", completedAt: Date.now(), lastError: "Taşıma iptal edildi" });
convex/employeeTermination.ts:277:        for (const op of ops) if (op.opType === "deleteUser" && operationPayload(op.payload).employeeId === source._id) await ctx.db.patch(op._id, { status: "acked", ackedAt: Date.now(), lastError: "Taşıma iptal edildi" });
convex/employeeTermination.ts:280:    await ctx.db.patch(source._id, { employmentEndDate: undefined, terminationType: undefined, terminationReason: undefined, sgkExitCode: undefined, terminatedAt: undefined, terminatedBy: undefined, transferredToEmployeeId: undefined, isActive: true, updatedAt: new Date().toISOString() });
convex/employeeTermination.ts:288:    await writeAudit(ctx, { user: ctx.user, projectId: source.projectId, action: "update", targetTable: "accessTransfers", targetId: transferId, newValue: { status: "cancelled" }, note: "Başka projeye taşıma iptal edildi" });
convex/employeeTermination.ts:293:export const retryTransfer = authedMutation({
convex/employeeTermination.ts:302:    await ctx.db.patch(transferId, { status: "revoking", deadlineAt: Date.now() + TRANSFER_WINDOW_MS, stuckReason: undefined, lastError: undefined });
convex/employeeTermination.ts:307:      await ctx.db.patch(row._id, { state: "pending", lastError: undefined, updatedAt: Date.now() });
convex/employeeTermination.ts:311:    await writeAudit(ctx, { user: ctx.user, projectId: source.projectId, action: "update", targetTable: "accessTransfers", targetId: transferId, newValue: { status: "revoking" }, note: "Başka projeye taşıma yeniden denendi" });
convex/employeeTermination.ts:316:export const expireTransfers = internalMutation({
convex/employeeTermination.ts:320:    for (const transfer of batch.page) await ctx.db.patch(transfer._id, { status: "stuck", stuckReason: "24 saat içinde tüm cihazlardan silme onayı alınamadı. Yeniden deneyin veya taşımayı iptal edin." });
convex/employeeTermination.ts:326:export const transferPreflight = authedQuery({
convex/employeeTermination.ts:337:export const getEmployeeTransfer = authedQuery({
convex/employeeTermination.ts:353:      return { deviceId: target.deviceId, deviceName: device?.name ?? "Kaldırılan cihaz", brand: target.brand, state: target.state, lastSeen: device ? deviceLastSignal(device) ?? null : null, lastError: target.lastError ?? null, confirmedAt: target.confirmedAt ?? null };
convex/employeeTermination.ts:355:    return { transferId: transfer._id, status: transfer.status, counterpartProjectName: counterpart?.name ?? "Silinen proje",
convex/actions/sendScheduledReports.ts:11:export const sendMonthlyReports = internalAction({
convex/lib/employeeDepartmentHistory.ts:12:  if ((previous.departmentId || employee.departmentId) && !employee.hasDepartmentHistory) await ctx.db.patch(employee._id, { hasDepartmentHistory: true });
convex/lib/employeeDepartmentHistory.ts:14:  if (!existing) await ctx.db.insert("employeeDepartmentHistory", {
convex/lib/employeeDepartmentHistory.ts:25:  else if (employee.departmentId && !employee.hasDepartmentHistory) await ctx.db.patch(employee._id, { hasDepartmentHistory: true });
convex/lib/employeeDepartmentHistory.ts:29:  if (existing) await ctx.db.patch(existing._id, fields);
convex/lib/employeeDepartmentHistory.ts:30:  else await ctx.db.insert("employeeDepartmentHistory", { ...fields, projectId: employee.projectId, employeeId, validFrom, source: "change", createdAt: new Date().toISOString() });
convex/leaves.ts:84:      calendarDays: days, status: leave.status, notes: notesHidden ? undefined : leave.notes, notesHidden,
convex/leaves.ts:93:  status: v.optional(statusValidator),
convex/leaves.ts:120:export const listPage = authedQuery({
convex/leaves.ts:132:export const summary = authedQuery({
convex/leaves.ts:143:export const conflictFor = authedQuery({
convex/leaves.ts:155:export const employeeOptions = authedQuery({
convex/leaves.ts:180:export const create = authedMutation({
convex/leaves.ts:195:    return await ctx.db.insert("leaves", {
convex/leaves.ts:205:export const update = authedMutation({
convex/leaves.ts:233:    await ctx.db.patch(leave._id, {
convex/leaves.ts:241:export const listForRange = authedQuery({
convex/leaves.ts:245:    leaveType: leaveTypeValidator, status: statusValidator,
convex/leaves.ts:260:          leaveType: leave.leaveType, status: leave.status,
convex/lib/pdksDetail.ts:115:  days: ReadonlyArray<OvertimeDay & { status: string }>,
convex/employeeFaces.ts:13:export const getStorageRef = internalQuery({
convex/lib/overtimeCalc.ts:13:export const WEEKLY_NORMAL_MINUTES = 45 * 60; // 2700
convex/lib/overtimeCalc.ts:14:export const DAILY_MAX_MINUTES = 11 * 60; // 660
convex/lib/overtimeCalc.ts:15:export const ANNUAL_OVERTIME_LIMIT_MINUTES = 270 * 60; // 16200
convex/holidays.ts:32:export const list = authedQuery({
convex/holidays.ts:52:export const listForRange = authedQuery({
convex/holidays.ts:63:export const create = authedMutation({
convex/holidays.ts:81:    const id = await ctx.db.insert("holidays", {
convex/holidays.ts:101:export const remove = authedMutation({
convex/holidays.ts:107:    await ctx.db.delete(args.id);
convex/holidays.ts:120:export const seedTurkishHolidays = authedMutation({
convex/holidays.ts:146:        await ctx.db.insert("holidays", {
convex/holidays.ts:174:export const getOvertimeRates = authedQuery({
convex/employeeBiometrics.ts:15:export const summary = authedQuery({
convex/lib/hikSyncEmployee.ts:145:  // (Valid.enable cihazda true olarak yazılıydı). isActive: false olunca delete tetiklenir.
convex/lib/hikSyncEmployee.ts:382:      state: result.grantRemoved ? "removed" as const : result.ok && !result.grantError ? "effective" as const : "failed" as const,
convex/lib/sgkCodes.ts:3:export const APHB_DRAFT_WARNING = "Taslak — resmi SGK formatı değildir, kontrol edin";
convex/lib/sgkCodes.ts:9:export const SGK_EKSIK_GUN_KODU = {
convex/employeeCheckIn.ts:9:export const createMyCheckInToken = mutation({
convex/employeeCheckIn.ts:26:    await ctx.db.insert("checkInTokens", {
convex/employeeCheckIn.ts:34:export const getMyCheckInTokenStatus = employeeAuthedQuery({
convex/employeeCheckIn.ts:55:export const checkInWithToken = mutation({
convex/employeeCheckIn.ts:62:      success: true as const, status: "used" as const,
convex/lib/employeeCardChange.ts:43:      if (options.fingerNo === undefined || template.fingerPrintID === options.fingerNo) await ctx.db.delete(template._id);
convex/lib/employeeCardChange.ts:51:    await ctx.db.patch(row._id, { deletionEmployeeNo: oldEmployeeNo, deletionRequestedAt: row.deletionRequestedAt ?? Date.now(), cancelRequested: true });
convex/lib/pdksManualWrite.ts:36:    await ctx.db.patch(existing._id, values);
convex/lib/pdksManualWrite.ts:40:        oldValue: { date: existing.date, entryTime: existing.entryTime, exitTime: existing.exitTime, status: existing.status, manualNote: existing.manualNote },
convex/lib/pdksManualWrite.ts:46:  const id = await ctx.db.insert("pdksRecords", {
convex/lib/processCardReadingCore.ts:84:  const state: ReadingState = { accessTime, projectForRow, hikFields, findDeviceCardEmployee };
convex/lib/processCardReadingCore.ts:166:  state: ReadingState,
convex/lib/processCardReadingCore.ts:234:    await ctx.db.patch(device._id, { hikLastSerialNo: args.hikSerialNo });
convex/lib/processCardReadingCore.ts:237:  await ctx.db.insert("cardReadings", {
convex/lib/processCardReadingCore.ts:261:  state: ReadingState,
convex/lib/processCardReadingCore.ts:297:  await ctx.db.insert("cardReadings", {
convex/lib/processCardReadingCore.ts:353:  await ctx.db.patch(tokenRow._id, { usedAt: consumedAt, employeeName, locationRecorded: false });
convex/lib/processCardReadingCore.ts:356:  await ctx.db.insert("cardReadings", {
convex/lib/processCardReadingCore.ts:369:  state: ReadingState,
convex/lib/processCardReadingCore.ts:377:    await ctx.db.insert("cardReadings", {
convex/lib/processCardReadingCore.ts:396:    await ctx.db.insert("cardReadings", {
convex/lib/processCardReadingCore.ts:426:    await ctx.db.insert("cardReadings", {
convex/lib/processCardReadingCore.ts:453:  const readingId = await ctx.db.insert("cardReadings", {
convex/lib/transferGuard.ts:8:export const TRANSFER_WINDOW_MS = 24 * 60 * 60 * 1000;
convex/lib/transferGuard.ts:9:export const TRANSFER_LIMIT = 500;
convex/lib/transferGuard.ts:10:export const activeTransferStatuses = ["requested", "revoking", "revoked", "provisioning", "stuck"] as const;
convex/lib/transferGuard.ts:37:  // Point lookups per status: a prefix scan would be crowded out by old cancelled runs.
convex/lib/transferGuard.ts:57:export const TRANSFER_INVALID_OPERATION = "Taşıma başladı: geçersiz";
convex/lib/transferGuard.ts:114:  await ctx.db.patch(transferId, { status: "revoked", stuckReason: undefined, lastError: undefined });
convex/lib/transferGuard.ts:118:export async function updateTransferTarget(ctx: MutationCtx, employeeId: Id<"employees">, deviceId: Id<"devices">, state: "confirmed" | "failed" | "superseded", lastError?: string): Promise<void> {
convex/lib/transferGuard.ts:125:    await ctx.db.patch(row._id, { state, lastError: state === "confirmed" ? undefined : lastError?.slice(0, 2000), confirmedAt: state === "confirmed" ? Date.now() : undefined, updatedAt: Date.now() });
convex/lib/transferGuard.ts:126:    if (state === "superseded") await ctx.db.patch(transfer._id, { status: "stuck", stuckReason: "Silme işi başka bir işlem tarafından geçersiz kılındı. Taşımayı iptal edin veya cihazı kaynak projeden kaldırın.", lastError });
convex/lib/transferGuard.ts:130:export async function transferOperationFailed(ctx: MutationCtx, op: { payload: unknown; deviceId: Id<"devices"> }, reason: string, state: "failed" | "superseded" = "failed"): Promise<void> {
convex/lib/transferGuard.ts:149:      await ctx.db.patch(row._id, { state: "deviceRemoved", updatedAt: Date.now(), lastError: undefined });
convex/lib/transferGuard.ts:150:      await writeAudit(ctx, { user: ctx.user ?? null, projectId, action: "update", targetTable: "accessTransfers", targetId: transfer._id, newValue: { deviceId, state: "deviceRemoved" }, note: "Taşıma hedefi kapandı: cihaz kaynak projeden kaldırıldı" });
convex/lib/employeeUx.ts:4:export const TC_NO_INVALID_MESSAGE = "Geçerli bir TC Kimlik No girin (11 hane, doğrulama haneleri tutmalı)";
convex/lib/employeeUx.ts:26:export const employeeDependentTables = ["employeeAuth", "employeeSessions", "shiftAssignments"] as const;
convex/lib/employeeUx.ts:28:export const EMPLOYEE_BULK_DELETE_LIMIT = 50;
convex/lib/privacySettings.ts:15:export const DEFAULT_PRIVACY: PrivacySettings = {
convex/lib/privacySettings.ts:25:export const MIN_CARD_READING_RETENTION_DAYS = 1825;
convex/lib/privacySettings.ts:26:export const MAX_CARD_READING_RETENTION_DAYS = 3650;
convex/lib/privacySettings.ts:87:    await ctx.db.patch(row._id, { ...defined, updatedAt });
convex/lib/privacySettings.ts:90:  await ctx.db.insert("projectPrivacySettings", { projectId, ...defined, updatedAt });
convex/lib/employeeAuth.ts:47:  await ctx.db.patch(auth._id, {
convex/lib/employeeAuth.ts:50:    passwordVersion: (auth.passwordVersion ?? 0) + 1,
convex/lib/shiftSchedule.ts:5:export const scheduleModeValidator = v.union(v.literal("daily"), v.literal("weekly"), v.literal("cycle"));
convex/lib/shiftSchedule.ts:11:export const SCHEDULE_WEEKDAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"] as const;
convex/lib/shiftSchedule.ts:12:export const SCHEDULE_DAY_LABELS = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"] as const;
convex/lib/shiftSchedule.ts:13:export const DEFAULT_WEEKLY_PLAN = [true, true, true, true, true, false, false];
convex/lib/shiftSchedule.ts:14:export const DEFAULT_CYCLE_PLAN = [true, true, false, false];
convex/lib/pdksRules.ts:19:export const LEGACY_PDKS_POLICY: PdksDayPolicy = { punchMode: "legacy", checkpointMode: "all", targets: [] };
convex/lib/pdksRules.ts:21:export function createPdksRulePolicy(versions: readonly (PdksDayPolicy & { effectiveFrom: string })[]): PdksPolicyResolver {
convex/shiftPlans.ts:91:export const listDepartmentAssignments = authedQuery({
convex/shiftPlans.ts:98:export const previewDepartmentAssign = authedQuery({
convex/shiftPlans.ts:102:export const assignDepartment = authedMutation({
convex/shiftPlans.ts:110:    const departmentAssignmentId = await ctx.db.insert("departmentShiftAssignments", { ...row, createdAt: now, updatedAt: now });
convex/shiftPlans.ts:117:export const updateDepartmentAssignment = authedMutation({
convex/shiftPlans.ts:137:    await ctx.db.patch(existing._id, { ...row, plan: row.plan, updatedAt: new Date().toISOString() });
convex/shiftPlans.ts:143:export const removeDepartmentAssignment = authedMutation({
convex/shiftPlans.ts:151:    await ctx.db.delete(row._id);
convex/shiftPlans.ts:156:export const planCells = authedQuery({
convex/lib/pdksHelpers.ts:16:export const DEFAULT_WORK_SETTINGS: EffectiveWorkSettings = {
convex/lib/pdksHelpers.ts:41:export const DEFAULT_OVERTIME_RATES: EffectiveOvertimeRates = {
convex/lib/pdksHelpers.ts:53:export const DEFAULT_WEEKEND_DAYS = ["Cumartesi", "Pazar"];
convex/lib/pdksHelpers.ts:56:export const HALF_DAY_HOLIDAY_START_MINUTES = 13 * 60;
convex/lib/accessTransfer.ts:73:      await ctx.db.patch(op._id, { status: "done", completedAt: Date.now(), lastError: TRANSFER_INVALID_OPERATION });
convex/lib/accessTransfer.ts:76:      await ctx.db.patch(op._id, { status: "acked", ackedAt: Date.now(), lastError: TRANSFER_INVALID_OPERATION });
convex/reports.ts:17:export const getSgkMonthlyReport = authedQuery({
convex/reports.ts:140:export const getOvertimeSummaryReport = authedQuery({
convex/reports.ts:197:export const getAttendanceSummaryReport = authedQuery({
convex/reports.ts:212:export const getDepartmentCostReport = authedQuery({
convex/reports.ts:271:export const getReportSchedule = authedQuery({
convex/reports.ts:280:export const saveReportSchedule = authedMutation({
convex/reports.ts:296:    if (existing) await ctx.db.patch(existing._id, values);
convex/reports.ts:297:    else await ctx.db.insert("reportScheduleSettings", { ...values, userId: ctx.user._id, createdAt: now });
convex/reports.ts:301:export const getEnabledSchedules = internalQuery({
convex/reports.ts:312:export const getReportSummaryForEmail = internalQuery({
convex/reports.ts:336:export const markReportSent = internalMutation({
convex/reports.ts:341:    await ctx.db.patch(schedule._id, { lastSentAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
convex/reports.ts:345:export const triggerScheduledReports = internalMutation({
convex/lib/leaveValidation.ts:4:export const MAX_LEAVE_DAYS = 366;
convex/lib/leaveValidation.ts:7:export const LEAVE_ERRORS = {
convex/lib/leaveRules.ts:11:  return { status: "approved" as const, approvedBy: user._id };
convex/lib/leaveRules.ts:19:  status: "approved" | "rejected",
convex/lib/shiftVersions.ts:17:export const shiftRuleFields = {
convex/lib/shiftVersions.ts:40:export const shiftRulesValidator = v.object(shiftRuleFields);
convex/lib/shiftVersions.ts:42:export const SHIFT_RULE_KEYS = Object.keys(shiftRuleFields) as (keyof ShiftRules)[];
convex/lib/shiftVersions.ts:59:export const MAX_VERSIONS_PER_SHIFT = 200;
convex/lib/shiftVersions.ts:63:  const byShift = new Map<string, { validUntil: string; shift: Doc<"shifts"> }[]>();
convex/lib/shiftVersions.ts:68:    list.push({ validUntil: version.validUntil, shift: applyShiftRules(shift, version.rules) });
convex/privacyRetention.ts:21:export const getRetentionAndAssistant = authedQuery({
convex/privacyRetention.ts:30:export const setCardReadingRetention = authedMutation({
convex/privacyRetention.ts:42:export const setAssistantMasking = authedMutation({
convex/privacyRetention.ts:54:export const getAssistantPrivacy = internalQuery({
convex/privacyRetention.ts:63:export const getAssistantContext = internalQuery({
convex/privacyRetention.ts:72:    const sample = maskChatNames(readings.slice(0, 5).map(row => ({ employeeId: row.employeeId, employeeName: row.employeeName, time: row.accessTime, status: row.accessStatus })), aiMaskNames)
convex/privacyRetention.ts:79:export const purgeExpiredCardReadings = internalMutation({
convex/privacyRetention.ts:94:export const purgeProjectBatch = internalMutation({
convex/privacyRetention.ts:103:    for (const row of rows) await ctx.db.delete(row._id);
convex/privacyRetention.ts:114:export const getVisitorNotice = authedQuery({
convex/privacyRetention.ts:123:export const getVisitorRetention = authedQuery({
convex/privacyRetention.ts:131:export const setVisitorRetention = authedMutation({
convex/privacyRetention.ts:144:export const previewVisitorRetention = authedQuery({
convex/privacyRetention.ts:158:export const setVisitorNotice = authedMutation({
convex/privacyRetention.ts:174:    if (row) await ctx.db.patch(row._id, patch);
convex/privacyRetention.ts:175:    else await ctx.db.insert("projectPrivacySettings", { projectId, ...patch });
convex/privacyRetention.ts:184:export const DAY_MS = 86_400_000;
convex/privacyRetention.ts:185:export const OPERATION_RETENTION_DAYS = 30;
convex/privacyRetention.ts:186:export const SYNC_RUN_RETENTION_DAYS = 90;
convex/privacyRetention.ts:187:export const DEVICE_EVENT_RETENTION_DAYS = 365;
convex/privacyRetention.ts:188:export const CHECK_IN_RETENTION_DAYS = 7;
convex/privacyRetention.ts:189:export const SESSION_RETENTION_DAYS = 30;
convex/privacyRetention.ts:190:export const MOBILE_OPERATION_RETENTION_DAYS = 30;
convex/privacyRetention.ts:191:export const PURGE_BATCH_SIZE = 200;
convex/privacyRetention.ts:192:export const MAX_CHAIN_LENGTH = 20;
convex/privacyRetention.ts:239:export const startDailyPurge = internalMutation({
convex/privacyRetention.ts:248:export const purgeHik = internalMutation({
convex/privacyRetention.ts:259:      if (lastUpdate < before && !unresolvedRevocation) await ctx.db.delete(row._id);
convex/privacyRetention.ts:265:export const purgeIde = internalMutation({
convex/privacyRetention.ts:275:      if (lastUpdate < before && !unresolvedRevocation) await ctx.db.delete(row._id);
convex/privacyRetention.ts:281:export const purgeSyncRuns = internalMutation({
convex/privacyRetention.ts:294:      for (const target of targets) await ctx.db.delete(target._id);
convex/privacyRetention.ts:296:      if (targets.length < capacity) { await ctx.db.delete(run._id); deleted++; }
convex/privacyRetention.ts:302:export const purgeDeviceEvents = internalMutation({
convex/privacyRetention.ts:307:    for (const row of page.page) await ctx.db.delete(row._id);
convex/privacyRetention.ts:312:export const purgeCheckInTokens = internalMutation({
convex/privacyRetention.ts:322:      if (!row.usedAt || row.usedAt < before) await ctx.db.delete(row._id);
convex/privacyRetention.ts:328:export const purgeEmployeeSessions = internalMutation({
convex/privacyRetention.ts:333:    for (const row of page.page) await ctx.db.delete(row._id);
convex/privacyRetention.ts:338:export const purgeMobileOperations = internalMutation({
convex/privacyRetention.ts:345:    for (const row of page.page) await ctx.db.delete(row._id);
convex/privacyRetention.ts:352:export const purgeVisitors = internalMutation({
convex/privacyRetention.ts:392:export const removeRetainedVisitor = internalMutation({
convex/privacyRetention.ts:407:export const removeRetainedVisitorRecord = internalMutation({
convex/lib/requestRules.ts:3:export const requestMessages = {
convex/lib/pdksFlexible.ts:6:export const DEFAULT_FLEXIBLE: FlexibleSchedule = {
convex/lib/shiftPlan.ts:5:export const MAX_SHIFTS_PER_DAY = 8;
convex/lib/shiftPlan.ts:6:export const MIN_SPLIT_GAP_MINUTES = 30;
convex/lib/shiftPlan.ts:7:export const MAX_DAY_CYCLE = 31;
convex/lib/shiftPlan.ts:8:export const MAX_WEEK_CYCLE = 52;
convex/lib/shiftPlan.ts:11:export const daySlotValidator = v.array(v.id("shifts"));
convex/lib/shiftPlan.ts:12:export const shiftPlanValidator = v.union(
convex/lib/shiftPlan.ts:18:export const shiftPlanFields = {
convex/sgkExport.ts:12:export const buildAphbForMonth = authedQuery({
convex/lib/pdksFixedRules.ts:10:export const FIXED_RULE_KEYS = ["validWindow", "absentAfterLateMinutes", "minWorkMinutes", "missingCheckInLateMinutes", "holidayWorkRequired"] as const;
convex/shifts.ts:37:function consumeRows<T>(rows: T[], state: AssignmentReadState): T[] {
convex/shifts.ts:42:async function readShift(ctx: ReadCtx, id: Id<"shifts">, state: AssignmentReadState): Promise<Doc<"shifts"> | null> {
convex/shifts.ts:50:  state: AssignmentReadState, forceConfirm = false, calendarConfirmed = false, excludeId?: string): Promise<AssignmentDecision> {
convex/shifts.ts:72:    if (!item.projectId) return { status: "skipped", reason: "Eski kayıt proje bilgisi içermiyor", occurrenceCount: 0, conflict: null, leave: null, holiday: null };
convex/shifts.ts:93:    throw new ConvexError({ code: "SHIFT_CALENDAR_CONFLICT", message: `CALENDAR: ${decision.reason}. İzin/tatil günlerinde atama için açık onay verin.`, status: decision.status });
convex/shifts.ts:99:export const listAssignments = authedQuery({
convex/shifts.ts:161:export const updateAssignment = authedMutation({
convex/shifts.ts:196:    await ctx.db.patch(assignment._id, { ...range, updatedAt: new Date().toISOString() });
convex/shifts.ts:237:      results.push({ employeeId, employeeName, status: "skipped", reason: reason ?? "Çalışan bulunamadı", occurrenceCount: 0, conflict: null, leave: null, holiday: null });
convex/shifts.ts:246:export const previewBulkAssign = authedQuery({
convex/shifts.ts:261:  status: "assigned" | "skipped_conflict" | "skipped_leave" | "failed";
convex/shifts.ts:265:export const bulkAssignShift = authedMutation({
convex/shifts.ts:285:      let status: BulkApplyResult["status"] = "failed";
convex/shifts.ts:287:        assignmentId = await ctx.db.insert("shiftAssignments", {
convex/shifts.ts:308:export const removeAssignment = authedMutation({
convex/shifts.ts:320:    await ctx.db.delete(args.assignmentId);
convex/shifts.ts:350:async function affectedEmployeeCount(ctx: ReadCtx, rows: Doc<"shiftAssignments">[], departments: Doc<"departmentShiftAssignments">[], projectId: Id<"projects"> | undefined, state: DefinitionEmployeeState = {}) {
convex/shifts.ts:385:export const definitionImpacts = authedQuery({
convex/shifts.ts:423:export const assignmentDeleteImpact = authedQuery({
convex/shifts.ts:437:export const definitionUsage = authedQuery({
convex/shifts.ts:470:export const list = authedQuery({
convex/shifts.ts:502:export const create = authedMutation({
convex/shifts.ts:516:    isActive: v.optional(v.boolean()),
convex/shifts.ts:533:    return await ctx.db.insert("shifts", {
convex/shifts.ts:535:      isActive: args.isActive ?? true,
convex/shifts.ts:543:export const update = authedMutation({
convex/shifts.ts:557:    isActive: v.optional(v.boolean()),
convex/shifts.ts:559:    effectiveFrom: v.optional(v.string()),
convex/shifts.ts:582:      const cosmetic = { ...(patch.scheduleMode !== undefined ? { scheduleMode: patch.scheduleMode } : {}), ...(patch.dayPlan !== undefined ? { dayPlan: patch.dayPlan } : {}), ...(patch.name !== undefined ? { name: patch.name } : {}), ...(patch.isActive !== undefined ? { isActive: patch.isActive } : {}) };
convex/shifts.ts:583:      await ctx.db.patch(shiftId, { ...cosmetic, updatedAt: now });
convex/shifts.ts:590:    await ctx.db.patch(shiftId, { ...patch, ...versionPatch, updatedAt: now });
convex/shifts.ts:614:  await ctx.db.insert("shiftVersions", { shiftId: shift._id, validUntil, rules: ruleSnapshot(shift), createdAt: now, createdBy: user._id });
convex/shifts.ts:633:    if (doc) shifts.set(id, { ...doc, isActive: true });
convex/shifts.ts:652:export const remove = authedMutation({
convex/shifts.ts:673:      await ctx.db.delete(ref._id);
convex/shifts.ts:682:    await Promise.all(eligible.map((a) => ctx.db.delete(a._id)));
convex/shifts.ts:684:    await Promise.all(versions.map(version => ctx.db.delete(version._id)));
convex/shifts.ts:685:    await ctx.db.delete(args.shiftId);
convex/shifts.ts:690:export const clearAllAssignments = authedMutation({
convex/shifts.ts:711:      for (const reference of references) await ctx.db.delete(reference._id);
convex/shifts.ts:712:      await ctx.db.delete(owner.id);
convex/shifts.ts:765:export const previewClearAssignments = authedQuery({
convex/shifts.ts:769:export const clearAssignments = authedMutation({
convex/shifts.ts:776:        await ctx.db.patch(row._id, { endDate: shiftDateOffset(args.startDate, -1), updatedAt });
convex/shifts.ts:777:        const assignmentId = await ctx.db.insert("shiftAssignments", {
convex/shifts.ts:784:        await ctx.db.patch(row._id, { endDate: shiftDateOffset(args.startDate, -1), updatedAt });
convex/shifts.ts:786:        await ctx.db.patch(row._id, { startDate: shiftDateOffset(args.endDate, 1), updatedAt });
convex/shifts.ts:789:        await ctx.db.delete(row._id);
convex/lib/pdksTable.ts:144:  status: PdksDayStatus;
convex/lib/pdksTable.ts:182:  status: PdksDayStatus;
convex/lib/shiftRange.ts:2:export const OPEN_SHIFT_END = "9999-12-31";
convex/settings.ts:30:export const getGeneral = authedQuery({
convex/settings.ts:45:export const upsertGeneral = authedMutation({
convex/settings.ts:80:      await ctx.db.patch(existing._id, { ...toPatch(args), projectId, updatedAt: now });
convex/settings.ts:83:    return await ctx.db.insert("generalSettings", {
convex/settings.ts:94:export const getNotification = authedQuery({
convex/settings.ts:107:export const upsertNotification = authedMutation({
convex/settings.ts:127:      await ctx.db.patch(existing._id, { ...toPatch(args), projectId, updatedAt: now });
convex/settings.ts:130:    return await ctx.db.insert("notificationSettings", {
convex/settings.ts:140:export const getWork = authedQuery({
convex/settings.ts:154:export const getDarkMode = optionalAuthQuery({
convex/settings.ts:173:export const saveOvertime = authedMutation({
convex/settings.ts:196:    if (existingWork) await ctx.db.patch(existingWork._id, work);
convex/settings.ts:197:    else await ctx.db.insert("workSettings", work);
convex/settings.ts:198:    const rateId = existingRates?._id ?? await ctx.db.insert("overtimeRates", {
convex/settings.ts:202:    if (existingRates) await ctx.db.patch(existingRates._id, rate);
convex/pdksRecords.ts:11:export const upsertManual = authedMutation({
convex/pdksRecords.ts:31:export const bulkUpsertManual = authedMutation({
convex/pdksRecords.ts:139:export const previewManualShifts = authedQuery({
convex/lib/shiftAssign.ts:10:export const BULK_ASSIGN_LIMIT = 100;
convex/lib/shiftAssign.ts:11:export const ASSIGNMENT_SCAN_LIMIT = 5000;
convex/lib/shiftAssign.ts:43:  status: "will_assign" | "conflict" | "on_leave" | "holiday" | "skipped";
convex/lib/shiftAssign.ts:66:    status: "will_assign", reason: "Atanacak", occurrenceCount,
convex/lib/shiftAssign.ts:69:  if (input.shift.isActive === false) return { ...base, status: "skipped", reason: "Pasif vardiya atanamaz" };
convex/lib/shiftAssign.ts:72:  if (!occurrenceCount && (!input.range.plan || input.range.plan.kind === "weekly")) return { ...base, status: "skipped", reason: "Seçilen günlere denk gelen tarih yok" };
convex/lib/shiftAssign.ts:103:  if (!input.calendarConfirmed && base.leave) return { ...base, status: "on_leave", reason: `İzin: ${base.leave.date}` };
convex/lib/shiftAssign.ts:104:  if (!input.calendarConfirmed && base.holiday) return { ...base, status: "holiday", reason: `${base.holiday.date}: ${base.holiday.name}` };
convex/lib/shiftAssign.ts:105:  if (!input.forceConfirm && base.conflict) return { ...base, status: "conflict", reason: `OVERLAP:1 Mevcut planın üstünü örter: ${base.conflict.shiftName} ${shiftTimeLabel(base.conflict)} (${base.conflict.startDate}–${shiftEndLabel(base.conflict.endDate)})` };
convex/lib/shiftAssign.ts:153:  for (const ref of existing) await ctx.db.delete(ref._id);
convex/lib/shiftAssign.ts:156:  for (const shiftId of planShiftIds(plan)) await ctx.db.insert("shiftPlanRefs", { ...owner, projectId, shiftId });
convex/pdksRules.ts:33:export const getRules = authedQuery({
convex/pdksRules.ts:48:export const listCheckpointTargets = authedQuery({
convex/pdksRules.ts:82:export const getCheckpointWarnings = authedQuery({
convex/pdksRules.ts:95:      (await selections(ctx, version._id)).map(target => ({ target, effectiveFrom: version.effectiveFrom }))))).flat()
convex/pdksRules.ts:148:export const publishRuleVersion = authedMutation({
convex/pdksRules.ts:149:  args: { projectId: v.id("projects"), effectiveFrom: v.string(), calculationMode: v.optional(v.union(v.literal("firstLast"), v.literal("eachPunch"))), minPunchIntervalMinutes: v.optional(v.number()), punchMode: v.union(v.literal("legacy"), v.literal("requirements")), requireCheckIn: v.optional(v.boolean()), requireCheckOut: v.optional(v.boolean()), missingRequiredPunch: v.optional(choice), noPunch: v.optional(choice), checkpointMode: v.union(v.literal("all"), v.literal("selected")), targets: v.optional(v.array(target)) },
convex/pdksRules.ts:201:      for (const row of await selections(ctx, id)) await ctx.db.delete(row._id);
convex/pdksRules.ts:202:      await ctx.db.replace(id, data);
convex/pdksRules.ts:203:    } else id = await ctx.db.insert("pdksRuleVersions", data);
convex/pdksRules.ts:204:    for (const snapshot of snapshots) await ctx.db.insert("pdksCheckpointSelections", { ...snapshot, projectId: args.projectId, ruleVersionId: id });
convex/pdksRules.ts:209:export const deleteFutureRuleVersion = authedMutation({
convex/pdksRules.ts:217:    for (const row of await selections(ctx, ruleVersionId)) await ctx.db.delete(row._id);
convex/pdksRules.ts:218:    await ctx.db.delete(ruleVersionId);
convex/lib/shiftColors.ts:3:export const SHIFT_COLOR_KEYS = ["slate", "blue", "teal", "green", "amber", "orange", "rose", "violet"] as const;
convex/lib/shiftColors.ts:6:export const shiftColorValidator = v.union(
convex/actions/pdksImport.ts:87:export const previewPdksCsv = action({
convex/actions/pdksImport.ts:159:export const importPdksCsv = action({
convex/employees.ts:70:export const DUPLICATE_MESSAGES: Record<DuplicateField, string> = {
convex/employees.ts:96:    if (existing.source === "department") await ctx.db.patch(existing._id, { source: "manual" });
convex/employees.ts:99:  await ctx.db.insert("groupMembers", {
convex/employees.ts:108:export const list = authedQuery({
convex/employees.ts:163:export const listLightForImport = authedQuery({
convex/employees.ts:180:export const getById = authedQuery({
convex/employees.ts:214:export const create = authedMutation({
convex/employees.ts:231:    isActive: v.optional(v.boolean()),
convex/employees.ts:262:    const id = await ctx.db.insert("employees", {
convex/employees.ts:268:      isActive: args.isActive ?? true,
convex/employees.ts:293:export const update = authedMutation({
convex/employees.ts:311:    isActive: v.optional(v.boolean()),
convex/employees.ts:388:    await ctx.db.patch(employeeId, { ...toPatch(updates), ...photo, updatedAt: new Date().toISOString() });
convex/employees.ts:397:      if (auth) await ctx.db.patch(auth._id, {
convex/employees.ts:472:    await Promise.all(groupMembers.map((gm) => ctx.db.delete(gm._id)));
convex/employees.ts:478:        await ctx.db.delete(record._id);
convex/employees.ts:485:    await ctx.db.delete(emp._id);
convex/employees.ts:488:export const remove = authedMutation({
convex/employees.ts:507:export const bulkDelete = authedMutation({
convex/employees.ts:529:export const bulkUpdateDepartment = authedMutation({
convex/employees.ts:545:        await ctx.db.patch(emp._id, { departmentId: dept._id, updatedAt: new Date().toISOString() });
convex/employees.ts:555:export const getByEmailInternal = internalQuery({
convex/employees.ts:567:export const getAuthByEmployeeInternal = internalQuery({
convex/employees.ts:578:export const createAuthInternal = internalMutation({
convex/employees.ts:587:    return await ctx.db.insert("employeeAuth", {
convex/employees.ts:592:      passwordVersion: 1,
convex/employees.ts:600:export const updateAuthPasswordInternal = internalMutation({
convex/employees.ts:613:export const setProjectId = internalMutation({
convex/employees.ts:620:    await ctx.db.patch(args.employeeId, {
convex/employees.ts:629:export const adminInspectByEmail = internalQuery({
convex/employees.ts:639:        isActive: v.optional(v.boolean()),
convex/employees.ts:671:        isActive: employee.isActive,
convex/lib/shiftResolver.ts:44:export const DEPARTMENT_READ_LIMIT = 2000;
convex/lib/shiftResolver.ts:45:export const DEPARTMENT_CHAIN_LIMIT = 32;
convex/lib/pdksCalc.ts:161:  let status: DayStatus = "absent";
convex/mailSettings.ts:21:    passwordEnc: row.smtpPassword, fromEmail: row.fromEmail, fromName: row.fromName ?? "", isActive: row.isActive ?? false,
convex/mailSettings.ts:32:export const get = authedQuery({
convex/mailSettings.ts:40:      fromEmail: row.fromEmail ?? "", fromName: row.fromName ?? "", isActive: row.isActive ?? false,
convex/mailSettings.ts:46:export const remove = authedMutation({
convex/mailSettings.ts:52:    await ctx.db.delete(row._id);
convex/mailSettings.ts:62:export const upsertForCaller = internalMutation({
convex/mailSettings.ts:72:    isActive: v.boolean(),
convex/mailSettings.ts:84:      fromEmail: args.fromEmail, fromName: args.fromName, isActive: args.isActive, updatedAt: now,
convex/mailSettings.ts:87:    const audit = { smtpHost: args.host, smtpPort: args.port, smtpUsername: args.username, fromEmail: args.fromEmail, isActive: args.isActive, passwordChanged: Boolean(args.passwordEnc) };
convex/mailSettings.ts:89:      await ctx.db.patch(existing._id, values);
convex/mailSettings.ts:92:        oldValue: { smtpHost: existing.smtpHost, smtpPort: existing.smtpPort, smtpUsername: existing.smtpUsername, fromEmail: existing.fromEmail, isActive: existing.isActive },
convex/mailSettings.ts:97:    const id = await ctx.db.insert("mailSettings", { ...values, projectId: args.projectId, createdAt: now });
convex/mailSettings.ts:104:export const getForCaller = internalQuery({
convex/mailSettings.ts:113:export const getForDelivery = internalQuery({
convex/lib/mobileAttendance.ts:6:export const ATTENDANCE_TIME_ZONE = "Europe/Istanbul" as const;
convex/lib/mobileAttendance.ts:7:export const SUMMARY_MAX_DAYS = 93;
convex/lib/mobileAttendance.ts:8:export const SUMMARY_MAX_READINGS = 10_000;
convex/mobileAttendance.ts:58:export const listPage = employeeAuthedQuery({
convex/mobileAttendance.ts:107:export const summary = employeeAuthedQuery({
convex/employeeFingerprints.ts:6:export const getOne = internalQuery({
convex/employeeFingerprints.ts:10:export const listInternal = internalQuery({
convex/employeeFingerprints.ts:17:export const upsertEncrypted = internalMutation({
convex/employeeFingerprints.ts:29:      if (delivery.fingerNo === args.fingerNo && delivery.deviceId !== args.sourceDeviceId && delivery.enrolledAt) await ctx.db.patch(delivery._id, { enrolledAt: "" });
convex/employeeFingerprints.ts:31:    if (existing) await ctx.db.replace(existing._id, value);
convex/employeeFingerprints.ts:32:    else await ctx.db.insert("employeeFingerprints", value);
convex/lib/employeeCascade.ts:18:    await ctx.db.patch(row._id, { ...values, note: "Kişi kaydı silindi; geçmiş kişisel veri kopyası kaldırıldı",
convex/lib/employeeCascade.ts:25:export const maskEmployeeAudit = internalMutation({
convex/lib/employeeCascade.ts:42:    await ctx.db.patch(reading._id, { employeeName: "[silindi]", cardNo: hashCardNo(reading.cardNo) });
convex/lib/employeeCascade.ts:50:export const anonymizeReadings = internalMutation({
convex/lib/employeeCascade.ts:62:  for (const token of tokens) await ctx.db.delete(token._id);
convex/lib/employeeCascade.ts:66:export const deleteCheckInTokens = internalMutation({
convex/lib/employeeCascade.ts:81:    await ctx.db.patch(visitor._id, {
convex/lib/employeeCascade.ts:91:export const clearHostedVisitors = internalMutation({
convex/lib/employeeCascade.ts:122:  for (const period of departmentHistory) await ctx.db.delete(period._id);
convex/lib/employeeCascade.ts:135:    if (correction.status === "pending") await ctx.db.patch(correction._id, {
convex/lib/employeeCascade.ts:136:      status: "withdrawn", decisionNote: "Kişi kaydı silindi", decidedAt,
convex/lib/employeeCascade.ts:141:    if (leave.source === "employee" && leave.status === "pending") await ctx.db.delete(leave._id);
convex/lib/employeeCascade.ts:151:    await ctx.db.delete(f._id);
convex/lib/employeeCascade.ts:174:      await ctx.db.patch(c._id, { revokedAt: now });
```

## Ek C — Kapsama ve doğrulama notları

Keşif tüm beş kökte yapıldı. infra/bridge eşleşmeleri personel/okuma protokolleridir; doğrudan B tablo mutation yazarı saptanmadı. HTTP yolları okuma/ACK işlemlerine bağlanır; QR tüketimi processCardReadingCore üzerinden aynı transaction içindedir. Mobil request_repository izin/düzeltme submit/withdraw ve listMine çağrılarını kullanır; mobil kendi statusunu servera karar olarak göndermez. request_provider belirsiz komut sonucunda refresh yapar, oturum nesli değiştiğinde geç gelen sonuçları atar.

Web ve mobil label taramasında mevcut pending/approved/rejected/withdrawn değerleri için ayrışma doğrulanmadı. İzin source yoksa admin varsayımı backend açıklaması ve Dart isAdmin ile uyumlu. PDKS web gün enumu ile mobil ham hareket inside/out/none enumu aynı anlama sahip olmadığından bunları eksik etiket bulgusu saymadım. Tarih/saatle türetilen future/geçmiş/expired durumları belgede kalıcı status güncellemesi gerektirmez.

Sınırlama: bu rapor kod kanıtı ve statik senaryolar sunar; üretim veri dağılımı, eski kayıtların geçerli olup olmadığı, posta servisinin fiilî teslimi ve gerçek cihaz ACK sırası çalıştırılmadı. Alan A cihaz işleme/queue ayrıntıları ve Alan C erişim/ziyaretçi kararları burada tekrar audit edilmedi. Şüpheli bir ürün sözleşmesi (ör. eski oturumların yeniden açılmasının bilerek istenmesi) ilgili bulgunun altında açıkça belirtilmiştir.

Çalışma ağacı son kontrolü: `git diff --stat | tail -1` başlangıçla aynıdır: `211 files changed, 4049 insertions(+), 2058 deletions(-)`. `git status --short docs/audits/2026-11-14-implicit-state-machines/people-pdks.md` sonucu yalnız bu yeni rapor için `??` gösterdi. Bu oturumun tek yazdığı dosya bu rapordur; mevcut 211 dosyalık değişikliklere dokunulmadı. Diff özeti untracked dosyaları içermez; bu yüzden raporun yeni oluşması özeti değiştirmez.

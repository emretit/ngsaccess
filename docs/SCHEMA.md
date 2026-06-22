# NGS Access — Convex Şema Haritası

Tek otorite [`convex/schema.ts`](../convex/schema.ts) (44 tablo + `authTables`).
Bu doküman yalnız yüksek-seviye gezinti haritasıdır; alan detayları için şema
dosyasındaki tablo-içi yorumlara bakın. Tablolar şemada 13 numaralı bölüm
başlığıyla gruplanmıştır (`// ═══════ N · ... ═══════`).

> Çok-kiracılı (multi-tenant): neredeyse her tablo `projectId` ile proje-scope'lu.
> `super_admin` tüm projeleri, `project_admin`/`project_user` `userProjects` üzerinden
> erişilen projeleri görür. Tüm zaman damgaları ISO-UTC string ya da epoch ms.

## 1 · Kimlik · Proje · Yetkilendirme
| Tablo | Amaç |
|---|---|
| `users` | Convex Auth users override'ı — `role` (super_admin/project_admin/project_user), e-posta doğrulama, setup token. |
| `userProjects` | Kullanıcı ↔ proje üyeliği (proje-scope yetkinin kaynağı). |
| `projects` | Kiracı (tenant) kök kaydı. |

## 2 · Çalışanlar · Kimlik Doğrulama · Organizasyon
| Tablo | Amaç |
|---|---|
| `employees` | Personel + ziyaretçi (isVisitor); kart no, departman/şirket/pozisyon/vardiya/erişim-kuralı bağları, ücret. |
| `checkInTokens` | Mobil/QR self check-in tek-kullanımlık token. |
| `employeeAuth` | Çalışan mobil giriş kimliği (passwordHash, setup token). |
| `employeeSessions` | Çalışan oturum token'ları. |
| `departments` | Hiyerarşik departman ağacı (parentId/level). |

## 3 · Erişim Topolojisi · Bölge / Kapı / Okuyucu / Cihaz
| Tablo | Amaç |
|---|---|
| `zones` | Mantıksal alan (panel↔bölge 1:1 kaldırıldı; `ideDeviceId` deprecated). |
| `doors` | Fiziksel kapı; `deviceId` kontrol eden panel, `ioId`/`hikDoorNo`, Hik durum/doğrulama planları. |
| `readers` | Okuyucu (kart/yüz yüzü), kapıyla N:1; `direction`, `hikReaderNo`/`ioId`. |
| `devices` | Cihaz/panel (Hikvision/IDE Smart/other); **sır alanları** devicePassword/idePassword/ehomeKey/apiToken (rol-gated), gateway/localBridge/MQTT meta. |
| `hikBridges` | LAN bridge kurulumu kimliği (tek token → projenin tüm localBridge cihazları). |

## 4 · Erişim Kuralları · Grup Bağları
| Tablo | Amaç |
|---|---|
| `accessRules` | Erişim grubu/kuralı (zaman planı, Hik weekPlan / IDE permission no, isActive). |
| `groupMembers` | Kural ↔ çalışan. |
| `groupDevices` | Kural ↔ cihaz (panel-düzeyi yetki). |
| `groupDoors` | Kural ↔ kapı (kapı granülaritesi; yoksa panelin tüm kapıları). |

## 5 · Kart Okuma · Cihaz İş Kuyrukları
| Tablo | Amaç |
|---|---|
| `cardReadings` | Tüm erişim olayları (izin/red, yön, IDE ioId, Hik event detayları). |
| `hikPendingOperations` | Convex→cihaz komut kuyruğu (gateway worker retry + localBridge claim). |
| `idePendingOperations` | IDE Smart MQTT komut kuyruğu (Hetzner bridge poll/ack, msx-id correlation). |
| `idePanelUsers` | IDE panelinde **gerçekte bulunan** kullanıcı yansıması (reconcile farkı için, ideUuid bazlı). |

## 6 · Biyometri
| Tablo | Amaç |
|---|---|
| `employeeFaces` | Çalışan başına yüz (Convex storage), tek kişi → tek yüz. |
| `employeeFingerprints` | Parmak izi şablonu, `fingerPrintID` 1-10 slot bazlı (base64). |

## 7 · PDKS · Şirket / Pozisyon / Vardiya
| Tablo | Amaç |
|---|---|
| `pdksRecords` | Günlük PDKS kaydı + manuel override (entry/exit, editedBy). |
| `companies` | Şirket bilgisi (İK). |
| `positions` | Pozisyon/unvan. |
| `shifts` | Vardiya tanımı (başlangıç/bitiş, mola, tolerans, mesai). |
| `shiftAssignments` | Çalışan ↔ vardiya tarih aralığı + hafta deseni. |

## 8 · Ayarlar (Genel / Mail / Bildirim)
| Tablo | Amaç |
|---|---|
| `generalSettings` | Proje geneli ayarlar (firma, çalışma günleri/saatleri, dil, tema). |
| `mailSettings` | SMTP yapılandırması (smtpPassword sır). |
| `notificationSettings` | Bildirim anahtarları (e-posta/sistem/geç-kalma/rapor). |

## 9 · Cihaz Havuzu · IDE Varsayılanları · Chat
| Tablo | Amaç |
|---|---|
| `adminDevices` | Atanmamış cihaz havuzu (super_admin UUID/seri ile kaydeder; claim → devices, release → geri). |
| `ideDefaults` | IDE Smart sistem-geneli varsayılan kimlik (singleton, `.first()`). |
| `chatConversations` | PDKS asistan sohbet geçmişi. |

## 10 · İzin · Mesai · Çalışma Ayarları
| Tablo | Amaç |
|---|---|
| `leaves` | İzin talebi (tür/tarih/onay durumu). |
| `leaveBalances` | Yıllık izin bakiyesi (tür × yıl). |
| `workSettings` | PDKS çalışma/mesai parametreleri (başlangıç-bitiş, tolerans, mesai çarpanı, aylık saat tabanı). |

## 11 · KVKK Onayları · Kullanıcı Tercihleri
| Tablo | Amaç |
|---|---|
| `employeeConsents` | KVKK açık rıza (biyometri/kart/foto/ziyaretçi), granted/revoked + belge. |
| `userPreferences` | Kullanıcı UI tercihleri (key/value). |

## 12 · Tatil · Mesai Oranları
| Tablo | Amaç |
|---|---|
| `holidays` | Resmî/dini/şirket tatilleri (yarım gün desteği). |
| `overtimeRates` | Mesai çarpanları (haftaiçi/sonu/tatil/gece). |

## 13 · Sistem · Audit / Rapor / Davet
| Tablo | Amaç |
|---|---|
| `auditLog` | Değişiklik denetim günlüğü (create/update/delete, old/new value). |
| `reportScheduleSettings` | Zamanlanmış rapor e-postası ayarları. |
| `invites` | Kullanıcı davet + şifre sıfırlama token'ları. |

---
*Convex kısıtı: şema tek dosyada kalmalı (`defineSchema` tek modül). Registered
fonksiyon dosyaları (cardReadings/devices/…) file-path = `api.*` yolu olduğundan
bölünemez; ağır mantık `convex/lib/*`'e taşınır, wrapper'lar yerinde kalır.*

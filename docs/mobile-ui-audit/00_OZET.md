# Mobil UI audit — sentez (2026-11-04)

## Durum
- [x] F1 Mevcut görünüm: 74 PNG `current/` (Codex W1, harness `mobile/screenshot_test/`)
- [x] F2 İki bağımsız audit: [AUDIT_CODEX.md](AUDIT_CODEX.md) (30: 3Y/24O/3D) · [AUDIT_CLAUDE.md](AUDIT_CLAUDE.md) (16: 7Y/7O/2D)
- [ ] F3 Tasarım yönü seçimi: `directions/index.html` (A Sakin · B Marka bandı · C Canlı pano)
- [ ] F4 Uygulama dalgaları
- [ ] F5 Önce/sonra + simülatör + cihaz kabulü

## İki auditin ortak kararı (yönden bağımsız, her durumda yapılır)
1. **Tek bordo, nötr zemin.** `fromSeed` soluk birincil + #800020 + #9E1B3B → tek `primary #7a1f1f`; pembe
   primaryContainer zeminleri (selam bandı, metrik kutuları, segment, FAB, avatar) nötr `subtle`a. (CL-01, CL-09, CX §4)
2. **Alt gezinme yeniden.** Yüzen hap + gölgeli 64dp QR dairesi → 5 eşit `NavigationDestination`, kısa "QR" etiketi;
   gövde nav yüksekliğini ayırır (QR "Yenile" ve form Kaydet artık örtülmez). (CL-02, CX-nav-01, CX-qr-01)
3. **Ana Sayfa hiyerarşisi.** Selam bandı → tek başlık; "Bugün" durumu önde; "QR kod tara" doğrudan **tarama**
   moduna (bugün "QR Kodum" sekmesine düşüyor — işlev hatası); hızlı işlemler kısa satırlar; Günün Sözü kalkar. (CL-03..05, CX-home-01..04)
4. **Ortak bileşenler.** `AppStatusBadge`, `AppListRow`, `AppEmptyState`, `AppDataNotice`, `AppSkeleton`,
   `AppPrimaryButton`+`AppFormActionBar` (yapışkan, klavye/safe-area uyumlu), `AppSheet`, `AppSegmentControl`,
   `AppTextField`/`AppDateTimeField`, `AppBottomNavigation`. Token'lar `ThemeExtension<AppUiTokens>`. (CX §5)
5. **Formlar.** İzin/düzeltme/ziyaretçi tek alan dili (3:1+ kontur), yerel tarih biçimi, alan altı hata, ilk hataya
   odak, sonuç görünür alanda. (CL-06, CX-leave/correction/forms/visitorform)
6. **Listeler.** Geçmiş gün başlıklı gruplu satırlar (kart değil), özet kartsız metrik satırı. (CL-10, CL-14, CX-history-01/02)
7. **Dil.** Tek tarih biçimi ("9–11 Kas", "Bugün 10:30"); geliştirici metinleri (QR süre, takvim lejantı, filtre kapsamı,
   UTC+3) kullanıcı diline. (CL-08, CL-11, CX-qr-02, CX-filter-01)
8. **Durumlar.** İlk yükleme iskelet (sarı uyarı değil); boş durumda yakın eylem; hata metni gerçek duruma göre
   (ziyaretçi "önceki kayıtlar" ama liste boş). (CX-home-03, CX-requests-02, CX-visitor-02/03, CX-device-01)

## Yalnız Codex'in bulduğu, önemli
- CX-home-02 QR CTA yanlış sekme (Y) · CX-visitorform-01 ziyaretçi form sonucu görünmüyor (Y) ·
  CX-door-01 kapı kurtarma diyaloğu "kontrol edin" diyor ama eylem yok · CX-login-03 erişim kapatıldı hatasında sonraki adım yok.

## Uygulama planı (yön seçildikten sonra)
| Dalga | İş | Sahip (dosya) |
|---|---|---|
| D1 | Token + tema + `widgets/ui/**` bileşen kiti + alt gezinme/kabuk | DS: `theme/**`, `core/spacing.dart`, `widgets/ui/**`, `app_bottom_navigation.dart`, `main_navigation_shell.dart` |
| D2a | Ana Sayfa + QR (+ CTA tarama fix) + kapı seçimi + kapı kurtarma | `screens/home/**`, `screens/qr_scan/**`, `screens/settings/**`, `widgets/cards/**`, `door_operation_recovery_dialog.dart` |
| D2b | Giriş + şifre yardımı + açılış + profil | `screens/auth/**`, `splash_screen.dart`, `screens/profile/**` |
| D3a | Geçmiş + talepler (liste + formlar) | `screens/history/**`, `widgets/history/**`, `screens/requests/**` |
| D3b | Ziyaretçi (liste, form, detay) | `screens/visitor/**`, `widgets/visitor/**` |
| Her dalga | l10n TR/EN tek sahip | `lib/l10n/**` (koordinatör toplar) |
| D4 | Golden/semantics kabul + screenshot önce/sonra + simülatör | `screenshot_test/**`, `test/ui_redesign/**` |

D2a/D2b ve D3a/D3b paralel koşabilir (dosya çakışması yok). Her dalga: Codex yazar → Claude denetler →
`flutter analyze` 0 + `flutter test` tam + screenshot yeniden üretim. Davranış (komut kurtarma, oturum sınırı,
Türkiye saati, yerel hata) değişmez.

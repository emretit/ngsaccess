import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:intl/intl.dart' as intl;

import 'app_localizations_en.dart';
import 'app_localizations_tr.dart';

// ignore_for_file: type=lint

/// Callers can lookup localized strings with an instance of AppLocalizations
/// returned by `AppLocalizations.of(context)`.
///
/// Applications need to include `AppLocalizations.delegate()` in their app's
/// `localizationDelegates` list, and the locales they support in the app's
/// `supportedLocales` list. For example:
///
/// ```dart
/// import 'l10n/app_localizations.dart';
///
/// return MaterialApp(
///   localizationsDelegates: AppLocalizations.localizationsDelegates,
///   supportedLocales: AppLocalizations.supportedLocales,
///   home: MyApplicationHome(),
/// );
/// ```
///
/// ## Update pubspec.yaml
///
/// Please make sure to update your pubspec.yaml to include the following
/// packages:
///
/// ```yaml
/// dependencies:
///   # Internationalization support.
///   flutter_localizations:
///     sdk: flutter
///   intl: any # Use the pinned version from flutter_localizations
///
///   # Rest of dependencies
/// ```
///
/// ## iOS Applications
///
/// iOS applications define key application metadata, including supported
/// locales, in an Info.plist file that is built into the application bundle.
/// To configure the locales supported by your app, you’ll need to edit this
/// file.
///
/// First, open your project’s ios/Runner.xcworkspace Xcode workspace file.
/// Then, in the Project Navigator, open the Info.plist file under the Runner
/// project’s Runner folder.
///
/// Next, select the Information Property List item, select Add Item from the
/// Editor menu, then select Localizations from the pop-up menu.
///
/// Select and expand the newly-created Localizations item then, for each
/// locale your application supports, add a new item and select the locale
/// you wish to add from the pop-up menu in the Value field. This list should
/// be consistent with the languages listed in the AppLocalizations.supportedLocales
/// property.
abstract class AppLocalizations {
  AppLocalizations(String locale)
    : localeName = intl.Intl.canonicalizedLocale(locale.toString());

  final String localeName;

  static AppLocalizations of(BuildContext context) {
    return Localizations.of<AppLocalizations>(context, AppLocalizations)!;
  }

  static const LocalizationsDelegate<AppLocalizations> delegate =
      _AppLocalizationsDelegate();

  /// A list of this localizations delegate along with the default localizations
  /// delegates.
  ///
  /// Returns a list of localizations delegates containing this delegate along with
  /// GlobalMaterialLocalizations.delegate, GlobalCupertinoLocalizations.delegate,
  /// and GlobalWidgetsLocalizations.delegate.
  ///
  /// Additional delegates can be added by appending to this list in
  /// MaterialApp. This list does not have to be used at all if a custom list
  /// of delegates is preferred or required.
  static const List<LocalizationsDelegate<dynamic>> localizationsDelegates =
      <LocalizationsDelegate<dynamic>>[
        delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
      ];

  /// A list of this localizations delegate's supported locales.
  static const List<Locale> supportedLocales = <Locale>[
    Locale('en'),
    Locale('tr'),
  ];

  /// No description provided for @appName.
  ///
  /// In tr, this message translates to:
  /// **'NGS Plus'**
  String get appName;

  /// No description provided for @commonOk.
  ///
  /// In tr, this message translates to:
  /// **'Tamam'**
  String get commonOk;

  /// No description provided for @commonCancel.
  ///
  /// In tr, this message translates to:
  /// **'İptal'**
  String get commonCancel;

  /// No description provided for @commonClose.
  ///
  /// In tr, this message translates to:
  /// **'Kapat'**
  String get commonClose;

  /// No description provided for @commonRetry.
  ///
  /// In tr, this message translates to:
  /// **'Yeniden dene'**
  String get commonRetry;

  /// No description provided for @navHome.
  ///
  /// In tr, this message translates to:
  /// **'Ana Sayfa'**
  String get navHome;

  /// No description provided for @navHistory.
  ///
  /// In tr, this message translates to:
  /// **'Geçmiş'**
  String get navHistory;

  /// No description provided for @navVisitor.
  ///
  /// In tr, this message translates to:
  /// **'Ziyaretçi'**
  String get navVisitor;

  /// No description provided for @navProfile.
  ///
  /// In tr, this message translates to:
  /// **'Profil'**
  String get navProfile;

  /// No description provided for @loginWelcomeTitle.
  ///
  /// In tr, this message translates to:
  /// **'Hoş geldiniz!'**
  String get loginWelcomeTitle;

  /// No description provided for @pdksSubtitle.
  ///
  /// In tr, this message translates to:
  /// **'Personel Devam Kontrol Sistemi'**
  String get pdksSubtitle;

  /// No description provided for @loginPrompt.
  ///
  /// In tr, this message translates to:
  /// **'PDKS sistemine giriş yapmak için bilgilerinizi giriniz'**
  String get loginPrompt;

  /// No description provided for @loginTitle.
  ///
  /// In tr, this message translates to:
  /// **'Giriş yap'**
  String get loginTitle;

  /// No description provided for @loginEmailLabel.
  ///
  /// In tr, this message translates to:
  /// **'E-posta'**
  String get loginEmailLabel;

  /// No description provided for @loginPasswordLabel.
  ///
  /// In tr, this message translates to:
  /// **'Şifre'**
  String get loginPasswordLabel;

  /// No description provided for @loginEmailRequired.
  ///
  /// In tr, this message translates to:
  /// **'E-posta adresinizi girin'**
  String get loginEmailRequired;

  /// No description provided for @loginEmailInvalid.
  ///
  /// In tr, this message translates to:
  /// **'Geçerli bir e-posta adresi girin'**
  String get loginEmailInvalid;

  /// No description provided for @loginPasswordRequired.
  ///
  /// In tr, this message translates to:
  /// **'Şifrenizi girin'**
  String get loginPasswordRequired;

  /// No description provided for @loginPasswordTooShort.
  ///
  /// In tr, this message translates to:
  /// **'Şifre en az 6 karakter olmalı'**
  String get loginPasswordTooShort;

  /// No description provided for @loginForgotPassword.
  ///
  /// In tr, this message translates to:
  /// **'Şifre yardımı'**
  String get loginForgotPassword;

  /// No description provided for @homeGreetingMorning.
  ///
  /// In tr, this message translates to:
  /// **'Günaydın'**
  String get homeGreetingMorning;

  /// No description provided for @homeGreetingDay.
  ///
  /// In tr, this message translates to:
  /// **'İyi günler'**
  String get homeGreetingDay;

  /// No description provided for @homeGreetingEvening.
  ///
  /// In tr, this message translates to:
  /// **'İyi akşamlar'**
  String get homeGreetingEvening;

  /// No description provided for @homeGreetingFallback.
  ///
  /// In tr, this message translates to:
  /// **'Kullanıcı'**
  String get homeGreetingFallback;

  /// No description provided for @homeGreetingLine.
  ///
  /// In tr, this message translates to:
  /// **'{greeting}, {name}'**
  String homeGreetingLine(String greeting, String name);

  /// No description provided for @homeStatusInside.
  ///
  /// In tr, this message translates to:
  /// **'İçeride'**
  String get homeStatusInside;

  /// No description provided for @homeStatusOut.
  ///
  /// In tr, this message translates to:
  /// **'Dışarıda'**
  String get homeStatusOut;

  /// No description provided for @homeStatusNone.
  ///
  /// In tr, this message translates to:
  /// **'Bugün kayıt yok'**
  String get homeStatusNone;

  /// No description provided for @homeAttendanceEntryRow.
  ///
  /// In tr, this message translates to:
  /// **'Son giriş'**
  String get homeAttendanceEntryRow;

  /// No description provided for @homeAttendanceExitRow.
  ///
  /// In tr, this message translates to:
  /// **'Son çıkış'**
  String get homeAttendanceExitRow;

  /// Additional entries today beyond the last entry shown.
  ///
  /// In tr, this message translates to:
  /// **'+{count} giriş daha'**
  String homeExtraEntries(int count);

  /// Additional exits today beyond the last exit shown.
  ///
  /// In tr, this message translates to:
  /// **'+{count} çıkış daha'**
  String homeExtraExits(int count);

  /// No description provided for @homeAttendanceTimeEmpty.
  ///
  /// In tr, this message translates to:
  /// **'—'**
  String get homeAttendanceTimeEmpty;

  /// No description provided for @profileTitle.
  ///
  /// In tr, this message translates to:
  /// **'Profil'**
  String get profileTitle;

  /// No description provided for @profileAccountSection.
  ///
  /// In tr, this message translates to:
  /// **'Hesap'**
  String get profileAccountSection;

  /// No description provided for @profilePreferencesSection.
  ///
  /// In tr, this message translates to:
  /// **'Tercihler'**
  String get profilePreferencesSection;

  /// No description provided for @profileSupportSection.
  ///
  /// In tr, this message translates to:
  /// **'Destek'**
  String get profileSupportSection;

  /// No description provided for @profileEditButton.
  ///
  /// In tr, this message translates to:
  /// **'Kişisel bilgiler'**
  String get profileEditButton;

  /// No description provided for @profileEditDialogBody.
  ///
  /// In tr, this message translates to:
  /// **'Adınız, soyadınız ve e-posta adresiniz kuruluşunuz tarafından yönetilir. Düzeltme için kurumunuzun personel veya sistem yöneticisine başvurun. Bu uygulama bu alanları değiştirmez.'**
  String get profileEditDialogBody;

  /// No description provided for @profileNotifications.
  ///
  /// In tr, this message translates to:
  /// **'Bildirimler'**
  String get profileNotifications;

  /// No description provided for @profileNotificationsSubtitle.
  ///
  /// In tr, this message translates to:
  /// **'Güncellemeler ve kullanım bilgisi'**
  String get profileNotificationsSubtitle;

  /// No description provided for @profileTheme.
  ///
  /// In tr, this message translates to:
  /// **'Tema'**
  String get profileTheme;

  /// No description provided for @profileThemeModeLight.
  ///
  /// In tr, this message translates to:
  /// **'Açık tema'**
  String get profileThemeModeLight;

  /// No description provided for @profileThemeModeDark.
  ///
  /// In tr, this message translates to:
  /// **'Koyu tema'**
  String get profileThemeModeDark;

  /// No description provided for @profileThemeModeSystem.
  ///
  /// In tr, this message translates to:
  /// **'Sistem ayarına göre'**
  String get profileThemeModeSystem;

  /// No description provided for @profileLanguage.
  ///
  /// In tr, this message translates to:
  /// **'Dil'**
  String get profileLanguage;

  /// No description provided for @profileLanguageValueTr.
  ///
  /// In tr, this message translates to:
  /// **'Türkçe'**
  String get profileLanguageValueTr;

  /// No description provided for @profileLanguageValueEn.
  ///
  /// In tr, this message translates to:
  /// **'İngilizce'**
  String get profileLanguageValueEn;

  /// No description provided for @profilePreferredDoor.
  ///
  /// In tr, this message translates to:
  /// **'Hızlı erişim kapısı'**
  String get profilePreferredDoor;

  /// No description provided for @profilePreferredDoorEmpty.
  ///
  /// In tr, this message translates to:
  /// **'Seçilmedi'**
  String get profilePreferredDoorEmpty;

  /// No description provided for @quickActionUnlock.
  ///
  /// In tr, this message translates to:
  /// **'Kapıyı aç'**
  String get quickActionUnlock;

  /// No description provided for @quickActionProfile.
  ///
  /// In tr, this message translates to:
  /// **'Profil'**
  String get quickActionProfile;

  /// No description provided for @unlockNoDeviceSelected.
  ///
  /// In tr, this message translates to:
  /// **'Önce Profil\'den hızlı erişim kapısını seç'**
  String get unlockNoDeviceSelected;

  /// No description provided for @unlockDenied.
  ///
  /// In tr, this message translates to:
  /// **'Erişim Reddedildi'**
  String get unlockDenied;

  /// No description provided for @selectDeviceTitle.
  ///
  /// In tr, this message translates to:
  /// **'Kapı seç'**
  String get selectDeviceTitle;

  /// No description provided for @selectDeviceSearch.
  ///
  /// In tr, this message translates to:
  /// **'Kapılarda ara'**
  String get selectDeviceSearch;

  /// No description provided for @selectDeviceEmpty.
  ///
  /// In tr, this message translates to:
  /// **'Henüz erişiminiz olan kapı yok'**
  String get selectDeviceEmpty;

  /// No description provided for @selectDeviceNoMatch.
  ///
  /// In tr, this message translates to:
  /// **'Eşleşen kapı bulunamadı'**
  String get selectDeviceNoMatch;

  /// No description provided for @profileHelp.
  ///
  /// In tr, this message translates to:
  /// **'Yardım & Destek'**
  String get profileHelp;

  /// No description provided for @profileHelpSubtitle.
  ///
  /// In tr, this message translates to:
  /// **'SSS ve destek'**
  String get profileHelpSubtitle;

  /// No description provided for @profileAboutApp.
  ///
  /// In tr, this message translates to:
  /// **'Uygulama Hakkında'**
  String get profileAboutApp;

  /// No description provided for @profilePrivacy.
  ///
  /// In tr, this message translates to:
  /// **'Gizlilik bilgileri'**
  String get profilePrivacy;

  /// No description provided for @profilePrivacySubtitle.
  ///
  /// In tr, this message translates to:
  /// **'Uygulamadaki veriler ve başvuru yolu'**
  String get profilePrivacySubtitle;

  /// No description provided for @profileLogout.
  ///
  /// In tr, this message translates to:
  /// **'Çıkış Yap'**
  String get profileLogout;

  /// No description provided for @profileLogoutConfirmTitle.
  ///
  /// In tr, this message translates to:
  /// **'Çıkış Yap'**
  String get profileLogoutConfirmTitle;

  /// No description provided for @profileLogoutConfirmBody.
  ///
  /// In tr, this message translates to:
  /// **'Hesabınızdan çıkış yapmak istediğinizden emin misiniz?'**
  String get profileLogoutConfirmBody;

  /// No description provided for @profileNotificationsDialogBody.
  ///
  /// In tr, this message translates to:
  /// **'Bu sürümde anlık bildirim teslimi ve bildirim tercihi yönetimi bulunmuyor. Güncel erişim ve hareket bilgilerinizi uygulamayı açarak yenileyebilirsiniz. Eksik veya hatalı kayıtlar için kurumunuzun yöneticisine başvurun.'**
  String get profileNotificationsDialogBody;

  /// No description provided for @profileSecurityDialogBody.
  ///
  /// In tr, this message translates to:
  /// **'Mevcut şifrenizi biliyorsanız aşağıdaki formdan yeni bir şifre belirleyebilirsiniz. Şifre değişikliği tüm mobil oturumları sonlandırır. Şifrenizi unuttuysanız kurum yöneticinizden yeni kurulum bağlantısı isteyin. Ortak bir cihazdan ayrılmadan önce Çıkış Yap seçeneğini kullanın.'**
  String get profileSecurityDialogBody;

  /// No description provided for @profileHelpDialogTitle.
  ///
  /// In tr, this message translates to:
  /// **'Yardım & Destek'**
  String get profileHelpDialogTitle;

  /// No description provided for @profileHelpDialogBody.
  ///
  /// In tr, this message translates to:
  /// **'Kapı seçimi\nProfil > Hızlı Erişim Kapısı bölümünden erişebildiğiniz bir hedef seçin. Seçimi kaldırabilir veya listeyi yenileyebilirsiniz. Liste boşsa erişim yetkilerinizi kurum yöneticinize kontrol ettirin.\n\nQR kullanımı\nKamera izni yalnız kod taramak için gerekir. İzin verilmediyse cihaz ayarlarından kamera erişimini kontrol edin. Kişisel QR kodunu desteklenen okuyucuya gösterin; kodun süresi dolduğunda yenileyin. Kimlik etiketi taramak tek başına geçiş kaydı oluşturmaz.\n\nKayıt ve erişim sorunları\nAğ bağlantısını kontrol edip ilgili ekranı yenileyin. Kapı komutu ile fiziksel geçiş ve resmi PDKS sonucu farklı durumlardır. Eksik veya hatalı kayıt için personel/sistem yöneticinize başvurun.\n\nDestek bilgisi\nYöneticinize uygulama sürümünü (Uygulama Hakkında), sorunun zamanını ve görünen hata açıklamasını iletin. Parola, oturum bilgisi veya kişisel QR kodunu paylaşmayın.'**
  String get profileHelpDialogBody;

  /// No description provided for @profilePrivacyDialogTitle.
  ///
  /// In tr, this message translates to:
  /// **'Gizlilik bilgileri'**
  String get profilePrivacyDialogTitle;

  /// No description provided for @profilePrivacyDialogBody.
  ///
  /// In tr, this message translates to:
  /// **'Uygulama veri bilgisi — 19 Ekim 2026\n\nNGS Plus, oturum açtığınız kuruluşun çalışan bilgilerini, erişilebilir cihazları ve size ait erişim hareketlerini hizmetten alıp gösterir. Kişisel QR kodu hizmetten alınır; kamera kod taramak için kullanılır. Kapı isteğinde seçilen hedef hizmete iletilir. Tema, dil ve kapsamlı hedef tercihi bu cihazda saklanır.\n\nÇalışan kaydını, erişim yetkilerini ve hareket kayıtlarını kuruluşunuz yönetir. Verilerin işlenme amacı, saklama süresi, hukuki dayanağı ve kişisel veri talepleriniz için kurumunuzun personel/veri sorumlusuna başvurun.\n\nBu açıklama uygulamanın veri kullanımını anlatır; kuruluşunuzun onaylı gizlilik politikasının yerine geçmez. Kuruluşunuza ait yayımlanmış politika bağlantısı bu sürümde yapılandırılmamıştır.'**
  String get profilePrivacyDialogBody;

  /// No description provided for @profileAboutDialogTitle.
  ///
  /// In tr, this message translates to:
  /// **'NGS Plus Hakkında'**
  String get profileAboutDialogTitle;

  /// No description provided for @profileAboutLine1.
  ///
  /// In tr, this message translates to:
  /// **'NGS Plus Yoklama Takip Sistemi'**
  String get profileAboutLine1;

  /// No description provided for @profileAboutLine4.
  ///
  /// In tr, this message translates to:
  /// **'Çalışan erişim ve hareket bilgilerini görüntüleme uygulaması.'**
  String get profileAboutLine4;

  /// No description provided for @profileFallbackEmail.
  ///
  /// In tr, this message translates to:
  /// **'E-posta bilgisi yok'**
  String get profileFallbackEmail;

  /// No description provided for @historyTitle.
  ///
  /// In tr, this message translates to:
  /// **'Geçmiş'**
  String get historyTitle;

  /// No description provided for @historyTabAll.
  ///
  /// In tr, this message translates to:
  /// **'Kayıtlar'**
  String get historyTabAll;

  /// No description provided for @historyTabThisMonth.
  ///
  /// In tr, this message translates to:
  /// **'Takvim'**
  String get historyTabThisMonth;

  /// No description provided for @historyTabStats.
  ///
  /// In tr, this message translates to:
  /// **'Özet'**
  String get historyTabStats;

  /// No description provided for @historyLoading.
  ///
  /// In tr, this message translates to:
  /// **'Kayıtlar yükleniyor'**
  String get historyLoading;

  /// No description provided for @historyErrorTitle.
  ///
  /// In tr, this message translates to:
  /// **'Kayıtlar alınamadı'**
  String get historyErrorTitle;

  /// No description provided for @historyEmpty.
  ///
  /// In tr, this message translates to:
  /// **'Kayıt bulunamadı'**
  String get historyEmpty;

  /// No description provided for @historyEmptyHint.
  ///
  /// In tr, this message translates to:
  /// **'Yeni geçişleriniz burada görünecek.'**
  String get historyEmptyHint;

  /// No description provided for @historyMonthSummary.
  ///
  /// In tr, this message translates to:
  /// **'Bu ayın özeti'**
  String get historyMonthSummary;

  /// No description provided for @historyActiveDays.
  ///
  /// In tr, this message translates to:
  /// **'Giriş günü'**
  String get historyActiveDays;

  /// No description provided for @historyThisWeek.
  ///
  /// In tr, this message translates to:
  /// **'Bu hafta'**
  String get historyThisWeek;

  /// No description provided for @historyWeeklySummary.
  ///
  /// In tr, this message translates to:
  /// **'Haftalık özet'**
  String get historyWeeklySummary;

  /// No description provided for @historyUnknownDevice.
  ///
  /// In tr, this message translates to:
  /// **'Kapı bilgisi yok'**
  String get historyUnknownDevice;

  /// No description provided for @historyRecordDetailTitle.
  ///
  /// In tr, this message translates to:
  /// **'Kayıt ayrıntısı'**
  String get historyRecordDetailTitle;

  /// No description provided for @historyDetailDate.
  ///
  /// In tr, this message translates to:
  /// **'Tarih'**
  String get historyDetailDate;

  /// No description provided for @historyDetailTime.
  ///
  /// In tr, this message translates to:
  /// **'Saat'**
  String get historyDetailTime;

  /// No description provided for @historyDetailLocation.
  ///
  /// In tr, this message translates to:
  /// **'Konum'**
  String get historyDetailLocation;

  /// No description provided for @historyFilterTitle.
  ///
  /// In tr, this message translates to:
  /// **'Filtrele'**
  String get historyFilterTitle;

  /// No description provided for @historyFilterDate.
  ///
  /// In tr, this message translates to:
  /// **'Tarih'**
  String get historyFilterDate;

  /// No description provided for @historyFilterDevice.
  ///
  /// In tr, this message translates to:
  /// **'Kapı'**
  String get historyFilterDevice;

  /// No description provided for @historyFilterClear.
  ///
  /// In tr, this message translates to:
  /// **'Filtreleri temizle'**
  String get historyFilterClear;

  /// Localized record count; English singular/plural, Turkish number followed by noun.
  ///
  /// In tr, this message translates to:
  /// **'{count} kayıt'**
  String historyDayRecordCount(int count);

  /// No description provided for @historyEntryShort.
  ///
  /// In tr, this message translates to:
  /// **'Giriş'**
  String get historyEntryShort;

  /// No description provided for @historyExitShort.
  ///
  /// In tr, this message translates to:
  /// **'Çıkış'**
  String get historyExitShort;

  /// No description provided for @qrTabTitle.
  ///
  /// In tr, this message translates to:
  /// **'QR İşlemleri'**
  String get qrTabTitle;

  /// No description provided for @qrTabMyQr.
  ///
  /// In tr, this message translates to:
  /// **'QR Kodum'**
  String get qrTabMyQr;

  /// No description provided for @qrTabScan.
  ///
  /// In tr, this message translates to:
  /// **'Tara'**
  String get qrTabScan;

  /// No description provided for @qrRefresh.
  ///
  /// In tr, this message translates to:
  /// **'Yenile'**
  String get qrRefresh;

  /// No description provided for @qrTryAgain.
  ///
  /// In tr, this message translates to:
  /// **'Tekrar dene'**
  String get qrTryAgain;

  /// No description provided for @qrFrameHint.
  ///
  /// In tr, this message translates to:
  /// **'QR kodu çerçeveye alın'**
  String get qrFrameHint;

  /// No description provided for @qrInvalidCode.
  ///
  /// In tr, this message translates to:
  /// **'Geçersiz QR kod'**
  String get qrInvalidCode;

  /// No description provided for @visitorTitle.
  ///
  /// In tr, this message translates to:
  /// **'Ziyaretçiler'**
  String get visitorTitle;

  /// No description provided for @visitorStatTotal.
  ///
  /// In tr, this message translates to:
  /// **'Toplam'**
  String get visitorStatTotal;

  /// No description provided for @visitorEmpty.
  ///
  /// In tr, this message translates to:
  /// **'Henüz davet yok'**
  String get visitorEmpty;

  /// No description provided for @visitorEmptyHint.
  ///
  /// In tr, this message translates to:
  /// **'Ziyaretçi davet et düğmesiyle yeni bir davet oluşturun.'**
  String get visitorEmptyHint;

  /// No description provided for @visitorFilterTitle.
  ///
  /// In tr, this message translates to:
  /// **'Filtrele'**
  String get visitorFilterTitle;

  /// No description provided for @visitorAddTitle.
  ///
  /// In tr, this message translates to:
  /// **'Ziyaretçi davet et'**
  String get visitorAddTitle;

  /// No description provided for @visitorFieldPurpose.
  ///
  /// In tr, this message translates to:
  /// **'Ziyaret Amacı'**
  String get visitorFieldPurpose;

  /// No description provided for @visitorAddButton.
  ///
  /// In tr, this message translates to:
  /// **'Ziyaretçi davet et'**
  String get visitorAddButton;

  /// No description provided for @errorNetwork.
  ///
  /// In tr, this message translates to:
  /// **'İnternet bağlantısı kurulamadı. Lütfen bağlantınızı kontrol edin.'**
  String get errorNetwork;

  /// No description provided for @errorTimeout.
  ///
  /// In tr, this message translates to:
  /// **'İşlem zamanında tamamlanamadı. Yeniden deneyin.'**
  String get errorTimeout;

  /// No description provided for @errorServer.
  ///
  /// In tr, this message translates to:
  /// **'İşlem tamamlanamadı. Biraz sonra yeniden deneyin.'**
  String get errorServer;

  /// No description provided for @errorEmploymentEnded.
  ///
  /// In tr, this message translates to:
  /// **'Mobil erişiminiz kapatıldı. Kurum yöneticinize başvurun.'**
  String get errorEmploymentEnded;

  /// No description provided for @errorAuthExpired.
  ///
  /// In tr, this message translates to:
  /// **'Oturumunuz sona erdi. Lütfen tekrar giriş yapın.'**
  String get errorAuthExpired;

  /// No description provided for @errorUnknown.
  ///
  /// In tr, this message translates to:
  /// **'Beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.'**
  String get errorUnknown;

  /// No description provided for @errorBusinessInvalidCredentials.
  ///
  /// In tr, this message translates to:
  /// **'E-posta veya şifre hatalı'**
  String get errorBusinessInvalidCredentials;

  /// No description provided for @errorBusinessNoMobilePassword.
  ///
  /// In tr, this message translates to:
  /// **'Mobil şifreniz henüz kurulmamış. Yöneticinizden kurulum bağlantısı isteyin.'**
  String get errorBusinessNoMobilePassword;

  /// No description provided for @errorBusinessEmployeeInactive.
  ///
  /// In tr, this message translates to:
  /// **'Çalışan kaydınız aktif değil'**
  String get errorBusinessEmployeeInactive;

  /// No description provided for @passwordResetAdminInfo.
  ///
  /// In tr, this message translates to:
  /// **'Mobil şifre kurulumunu yöneticiniz yapar. Lütfen yöneticinizle iletişime geçin.'**
  String get passwordResetAdminInfo;

  /// No description provided for @qrInvalidDevice.
  ///
  /// In tr, this message translates to:
  /// **'QR kodda cihaz bilgisi yok'**
  String get qrInvalidDevice;

  /// No description provided for @accessDenied.
  ///
  /// In tr, this message translates to:
  /// **'Erişim reddedildi'**
  String get accessDenied;

  /// No description provided for @profileFirstName.
  ///
  /// In tr, this message translates to:
  /// **'Ad'**
  String get profileFirstName;

  /// No description provided for @profileLastName.
  ///
  /// In tr, this message translates to:
  /// **'Soyad'**
  String get profileLastName;

  /// No description provided for @profileLanguageSystem.
  ///
  /// In tr, this message translates to:
  /// **'Sistem dili'**
  String get profileLanguageSystem;

  /// No description provided for @profileLanguageScope.
  ///
  /// In tr, this message translates to:
  /// **'Bu cihazda saklanır; çıkıştan sonra korunur.'**
  String get profileLanguageScope;

  /// No description provided for @profileVersionUnavailable.
  ///
  /// In tr, this message translates to:
  /// **'Sürüm bilgisi alınamadı'**
  String get profileVersionUnavailable;

  /// Version and build from installed package metadata, never translated.
  ///
  /// In tr, this message translates to:
  /// **'Sürüm {version} (derleme {build})'**
  String profileVersionBuild(String version, String build);

  /// No description provided for @preferenceSaveFailed.
  ///
  /// In tr, this message translates to:
  /// **'Tercih kaydedilemedi. Lütfen yeniden deneyin.'**
  String get preferenceSaveFailed;

  /// No description provided for @preferenceIdentityUnavailable.
  ///
  /// In tr, this message translates to:
  /// **'Hesap veya proje bilgisi doğrulanamadı. Yeniden giriş yapın.'**
  String get preferenceIdentityUnavailable;

  /// No description provided for @selectDeviceClear.
  ///
  /// In tr, this message translates to:
  /// **'Seçimi kaldır'**
  String get selectDeviceClear;

  /// No description provided for @selectDeviceInvalidated.
  ///
  /// In tr, this message translates to:
  /// **'Önceki hedef artık erişilebilir değil. Lütfen yeni bir hedef seçin.'**
  String get selectDeviceInvalidated;

  /// No description provided for @historyLoadMore.
  ///
  /// In tr, this message translates to:
  /// **'Daha fazla yükle'**
  String get historyLoadMore;

  /// No description provided for @historyUnknownDirection.
  ///
  /// In tr, this message translates to:
  /// **'Bilinmeyen yön'**
  String get historyUnknownDirection;

  /// No description provided for @historyUnknownAccess.
  ///
  /// In tr, this message translates to:
  /// **'Erişim sonucu bilinmiyor'**
  String get historyUnknownAccess;

  /// No description provided for @historyStaleData.
  ///
  /// In tr, this message translates to:
  /// **'Son veriler gösteriliyor; yenileme başarısız.'**
  String get historyStaleData;

  /// No description provided for @historySummaryUnavailable.
  ///
  /// In tr, this message translates to:
  /// **'Dönem özeti alınamadı.'**
  String get historySummaryUnavailable;

  /// No description provided for @historyRawEvents.
  ///
  /// In tr, this message translates to:
  /// **'Geçiş kayıtları gösterilir. Resmi devam ve çalışma süresi sonuçları farklı olabilir.'**
  String get historyRawEvents;

  /// No description provided for @homeDataLoading.
  ///
  /// In tr, this message translates to:
  /// **'Veriler yükleniyor'**
  String get homeDataLoading;

  /// No description provided for @homeDataUnavailable.
  ///
  /// In tr, this message translates to:
  /// **'Bugünkü durum alınamadı'**
  String get homeDataUnavailable;

  /// No description provided for @homeDataStale.
  ///
  /// In tr, this message translates to:
  /// **'Önceki veriler gösteriliyor'**
  String get homeDataStale;

  /// No description provided for @homeDataRefreshing.
  ///
  /// In tr, this message translates to:
  /// **'Veriler yenileniyor'**
  String get homeDataRefreshing;

  /// No description provided for @homeRetry.
  ///
  /// In tr, this message translates to:
  /// **'Yeniden dene'**
  String get homeRetry;

  /// No description provided for @homeStatusUnknown.
  ///
  /// In tr, this message translates to:
  /// **'Durum bilinmiyor'**
  String get homeStatusUnknown;

  /// No description provided for @homeCommandPending.
  ///
  /// In tr, this message translates to:
  /// **'Komut gönderildi; fiziksel geçiş doğrulanmadı.'**
  String get homeCommandPending;

  /// No description provided for @qrCameraUnavailableRetry.
  ///
  /// In tr, this message translates to:
  /// **'Kamera başlatılamadı. Tekrar deneyin.'**
  String get qrCameraUnavailableRetry;

  /// No description provided for @qrCameraInUseRetry.
  ///
  /// In tr, this message translates to:
  /// **'Kamera kullanılamıyor. Diğer kamera uygulamalarını kapatıp tekrar deneyin.'**
  String get qrCameraInUseRetry;

  /// No description provided for @qrSettingsUnavailable.
  ///
  /// In tr, this message translates to:
  /// **'Ayarlar açılamadı. Sistem ayarlarından kamera iznini etkinleştirin.'**
  String get qrSettingsUnavailable;

  /// No description provided for @qrServiceUnavailable.
  ///
  /// In tr, this message translates to:
  /// **'QR hizmeti kullanılamıyor.'**
  String get qrServiceUnavailable;

  /// No description provided for @qrPersonalCode.
  ///
  /// In tr, this message translates to:
  /// **'Kişisel QR kodunuz'**
  String get qrPersonalCode;

  /// No description provided for @qrConsumedHint.
  ///
  /// In tr, this message translates to:
  /// **'Kod kullanıldı. Yeni işlem için yenileyin.'**
  String get qrConsumedHint;

  /// No description provided for @qrExpiredHint.
  ///
  /// In tr, this message translates to:
  /// **'Kodun süresi doldu.'**
  String get qrExpiredHint;

  /// No description provided for @qrRefreshFailed.
  ///
  /// In tr, this message translates to:
  /// **'QR yenilenemedi.'**
  String get qrRefreshFailed;

  /// No description provided for @qrStatusUnavailable.
  ///
  /// In tr, this message translates to:
  /// **'Kodun durumu doğrulanamadı. Tekrar kontrol edin.'**
  String get qrStatusUnavailable;

  /// No description provided for @qrReaderHint.
  ///
  /// In tr, this message translates to:
  /// **'Kodu okuyucuya gösterin'**
  String get qrReaderHint;

  /// No description provided for @qrSwitchCamera.
  ///
  /// In tr, this message translates to:
  /// **'Kamerayı değiştir'**
  String get qrSwitchCamera;

  /// No description provided for @qrFlashlight.
  ///
  /// In tr, this message translates to:
  /// **'Flaş'**
  String get qrFlashlight;

  /// No description provided for @qrCameraPermissionRequired.
  ///
  /// In tr, this message translates to:
  /// **'QR taramak için kamera izni gerekiyor.'**
  String get qrCameraPermissionRequired;

  /// No description provided for @qrOpenSettings.
  ///
  /// In tr, this message translates to:
  /// **'Ayarları aç'**
  String get qrOpenSettings;

  /// No description provided for @qrGrantCameraPermission.
  ///
  /// In tr, this message translates to:
  /// **'Kamera izni ver'**
  String get qrGrantCameraPermission;

  /// No description provided for @qrCameraControlUnavailable.
  ///
  /// In tr, this message translates to:
  /// **'Kamera kontrolü kullanılamıyor.'**
  String get qrCameraControlUnavailable;

  /// No description provided for @qrDeviceIdentityOnly.
  ///
  /// In tr, this message translates to:
  /// **'Bu kod cihazı tanıtır; kapıyı açmaz veya geçiş kaydı oluşturmaz. QR Kodum sekmesindeki kodu uygun okuyucuya gösterin.'**
  String get qrDeviceIdentityOnly;

  /// No description provided for @qrEmployeeIdentityOnly.
  ///
  /// In tr, this message translates to:
  /// **'Bu bir çalışan kimlik kodudur. Kimlik doğrulaması veya geçiş kaydı oluşturmaz.'**
  String get qrEmployeeIdentityOnly;

  /// No description provided for @qrChallengeUnsupported.
  ///
  /// In tr, this message translates to:
  /// **'Bu okuyucuyla tarama yapılamıyor. QR Kodum sekmesindeki kodu uygun okuyucuya gösterin.'**
  String get qrChallengeUnsupported;

  /// No description provided for @qrScanExpired.
  ///
  /// In tr, this message translates to:
  /// **'QR kodun süresi doldu.'**
  String get qrScanExpired;

  /// No description provided for @qrInvalidDate.
  ///
  /// In tr, this message translates to:
  /// **'QR kodun tarihi geçersiz.'**
  String get qrInvalidDate;

  /// No description provided for @qrUnsupportedVersion.
  ///
  /// In tr, this message translates to:
  /// **'Bu QR sürümü desteklenmiyor.'**
  String get qrUnsupportedVersion;

  /// No description provided for @qrRemainingSeconds.
  ///
  /// In tr, this message translates to:
  /// **'Kalan süre: {seconds} sn'**
  String qrRemainingSeconds(int seconds);

  /// No description provided for @loginRememberEmail.
  ///
  /// In tr, this message translates to:
  /// **'E-postamı hatırla'**
  String get loginRememberEmail;

  /// No description provided for @passwordHelpTitle.
  ///
  /// In tr, this message translates to:
  /// **'Şifre yardımı'**
  String get passwordHelpTitle;

  /// No description provided for @passwordHelpAdminTitle.
  ///
  /// In tr, this message translates to:
  /// **'Yöneticinizle iletişime geçin'**
  String get passwordHelpAdminTitle;

  /// No description provided for @passwordHelpAdminBody.
  ///
  /// In tr, this message translates to:
  /// **'Kurum yöneticinizden kayıtlı e-postanıza şifre kurulum bağlantısı göndermesini isteyin. Şifrenizi belirledikten sonra giriş yapın.'**
  String get passwordHelpAdminBody;

  /// No description provided for @passwordHelpNoEmail.
  ///
  /// In tr, this message translates to:
  /// **'Bu ekran e-posta göndermez veya şifrenizi değiştirmez.'**
  String get passwordHelpNoEmail;

  /// No description provided for @passwordHelpRequest.
  ///
  /// In tr, this message translates to:
  /// **'Merhaba, NGS Plus mobil şifremi oluşturmak veya yenilemek istiyorum. Çalışan kaydımdaki e-posta adresime yeni bir şifre kurulum bağlantısı gönderebilir misiniz?'**
  String get passwordHelpRequest;

  /// No description provided for @passwordHelpCopy.
  ///
  /// In tr, this message translates to:
  /// **'Talebi kopyala'**
  String get passwordHelpCopy;

  /// No description provided for @passwordHelpCopied.
  ///
  /// In tr, this message translates to:
  /// **'Talep kopyalandı. Yöneticinizle paylaşabilirsiniz.'**
  String get passwordHelpCopied;

  /// No description provided for @passwordHelpCopyFailed.
  ///
  /// In tr, this message translates to:
  /// **'Kopyalanamadı. Aşağıdaki talep metnini seçebilirsiniz.'**
  String get passwordHelpCopyFailed;

  /// No description provided for @loginShowPassword.
  ///
  /// In tr, this message translates to:
  /// **'Şifreyi göster'**
  String get loginShowPassword;

  /// No description provided for @loginHidePassword.
  ///
  /// In tr, this message translates to:
  /// **'Şifreyi gizle'**
  String get loginHidePassword;

  /// No description provided for @startupTitle.
  ///
  /// In tr, this message translates to:
  /// **'NGS Plus başlatılıyor'**
  String get startupTitle;

  /// No description provided for @startupBandTitle.
  ///
  /// In tr, this message translates to:
  /// **'Başlatılıyor'**
  String get startupBandTitle;

  /// No description provided for @startupFailureTitle.
  ///
  /// In tr, this message translates to:
  /// **'Başlatılamadı'**
  String get startupFailureTitle;

  /// No description provided for @startupUnavailable.
  ///
  /// In tr, this message translates to:
  /// **'Oturum doğrulanamadı. Bağlantınızı kontrol edip yeniden deneyin.'**
  String get startupUnavailable;

  /// No description provided for @startupRetry.
  ///
  /// In tr, this message translates to:
  /// **'Yeniden dene'**
  String get startupRetry;

  /// No description provided for @startupUseLogin.
  ///
  /// In tr, this message translates to:
  /// **'Giriş ekranına dön'**
  String get startupUseLogin;

  /// No description provided for @homeUpdatedAt.
  ///
  /// In tr, this message translates to:
  /// **'Son güncelleme {time}'**
  String homeUpdatedAt(String time);

  /// No description provided for @homeScanQr.
  ///
  /// In tr, this message translates to:
  /// **'QR kod tara'**
  String get homeScanQr;

  /// No description provided for @homeCommandConfirmed.
  ///
  /// In tr, this message translates to:
  /// **'Cihaz komutu onayladı; fiziksel geçiş doğrulanmadı.'**
  String get homeCommandConfirmed;

  /// No description provided for @homeCommandFailed.
  ///
  /// In tr, this message translates to:
  /// **'Kapı komutu başarısız oldu.'**
  String get homeCommandFailed;

  /// No description provided for @homeCommandUnknown.
  ///
  /// In tr, this message translates to:
  /// **'Sonuç belirsiz; yeniden komut göndermeden durumu kontrol edin.'**
  String get homeCommandUnknown;

  /// No description provided for @homeCommandCheckStatus.
  ///
  /// In tr, this message translates to:
  /// **'Durumu kontrol et'**
  String get homeCommandCheckStatus;

  /// No description provided for @visitorFirstName.
  ///
  /// In tr, this message translates to:
  /// **'Ad'**
  String get visitorFirstName;

  /// No description provided for @visitorLastName.
  ///
  /// In tr, this message translates to:
  /// **'Soyad'**
  String get visitorLastName;

  /// No description provided for @visitorPhone.
  ///
  /// In tr, this message translates to:
  /// **'Telefon'**
  String get visitorPhone;

  /// No description provided for @visitorStart.
  ///
  /// In tr, this message translates to:
  /// **'Ziyaret başlangıcı'**
  String get visitorStart;

  /// No description provided for @visitorEnd.
  ///
  /// In tr, this message translates to:
  /// **'Ziyaret bitişi'**
  String get visitorEnd;

  /// No description provided for @visitorSave.
  ///
  /// In tr, this message translates to:
  /// **'Daveti kaydet'**
  String get visitorSave;

  /// No description provided for @visitorEdit.
  ///
  /// In tr, this message translates to:
  /// **'Düzenle'**
  String get visitorEdit;

  /// No description provided for @visitorEditTitle.
  ///
  /// In tr, this message translates to:
  /// **'Daveti düzenle'**
  String get visitorEditTitle;

  /// No description provided for @visitorStartDate.
  ///
  /// In tr, this message translates to:
  /// **'Başlangıç tarihi'**
  String get visitorStartDate;

  /// No description provided for @visitorEndDate.
  ///
  /// In tr, this message translates to:
  /// **'Bitiş tarihi'**
  String get visitorEndDate;

  /// No description provided for @visitorStartTime.
  ///
  /// In tr, this message translates to:
  /// **'Başlangıç saati'**
  String get visitorStartTime;

  /// No description provided for @visitorEndTime.
  ///
  /// In tr, this message translates to:
  /// **'Bitiş saati'**
  String get visitorEndTime;

  /// No description provided for @visitorNotFound.
  ///
  /// In tr, this message translates to:
  /// **'Davet bulunamadı'**
  String get visitorNotFound;

  /// No description provided for @visitorErrorEndBeforeStart.
  ///
  /// In tr, this message translates to:
  /// **'Bitiş, başlangıçtan sonra olmalı.'**
  String get visitorErrorEndBeforeStart;

  /// No description provided for @visitorErrorMaxDuration.
  ///
  /// In tr, this message translates to:
  /// **'Ziyaret en fazla 31 gün sürebilir.'**
  String get visitorErrorMaxDuration;

  /// No description provided for @visitorErrorEndInPast.
  ///
  /// In tr, this message translates to:
  /// **'Bitiş geçmişte olamaz.'**
  String get visitorErrorEndInPast;

  /// No description provided for @visitorErrorNoticeRequired.
  ///
  /// In tr, this message translates to:
  /// **'Devam etmek için aydınlatma metnini onaylayın.'**
  String get visitorErrorNoticeRequired;

  /// No description provided for @visitorCancelInvitation.
  ///
  /// In tr, this message translates to:
  /// **'Daveti iptal et'**
  String get visitorCancelInvitation;

  /// No description provided for @visitorCancelConfirm.
  ///
  /// In tr, this message translates to:
  /// **'Bu davet iptal edilsin mi?'**
  String get visitorCancelConfirm;

  /// No description provided for @visitorAccessActive.
  ///
  /// In tr, this message translates to:
  /// **'Erişim aktif'**
  String get visitorAccessActive;

  /// No description provided for @visitorAccessEnded.
  ///
  /// In tr, this message translates to:
  /// **'Erişim sonlandırıldı'**
  String get visitorAccessEnded;

  /// No description provided for @visitorExpired.
  ///
  /// In tr, this message translates to:
  /// **'Süresi doldu'**
  String get visitorExpired;

  /// No description provided for @visitorPresenceUnknown.
  ///
  /// In tr, this message translates to:
  /// **'Fiziksel konum bilinmiyor'**
  String get visitorPresenceUnknown;

  /// No description provided for @visitorPresenceInside.
  ///
  /// In tr, this message translates to:
  /// **'Son kayda göre içeride'**
  String get visitorPresenceInside;

  /// No description provided for @visitorPresenceOutside.
  ///
  /// In tr, this message translates to:
  /// **'Son kayda göre dışarıda'**
  String get visitorPresenceOutside;

  /// No description provided for @visitorOperatorRequired.
  ///
  /// In tr, this message translates to:
  /// **'Aktif erişimi iptal etmek için yetkili operatörle iletişime geçin.'**
  String get visitorOperatorRequired;

  /// No description provided for @visitorSaved.
  ///
  /// In tr, this message translates to:
  /// **'Davet kaydedildi. Yetkili onayı bekleniyor.'**
  String get visitorSaved;

  /// No description provided for @visitorCancelled.
  ///
  /// In tr, this message translates to:
  /// **'Davet iptal edildi.'**
  String get visitorCancelled;

  /// No description provided for @visitorLoadMore.
  ///
  /// In tr, this message translates to:
  /// **'Daha fazla'**
  String get visitorLoadMore;

  /// No description provided for @visitorNotice.
  ///
  /// In tr, this message translates to:
  /// **'Proje ziyaretçi aydınlatma metni'**
  String get visitorNotice;

  /// No description provided for @visitorNoticeReviewed.
  ///
  /// In tr, this message translates to:
  /// **'Güncel aydınlatma metnini inceledim.'**
  String get visitorNoticeReviewed;

  /// No description provided for @fieldRequired.
  ///
  /// In tr, this message translates to:
  /// **'Bu alan zorunlu.'**
  String get fieldRequired;

  /// No description provided for @visitorStale.
  ///
  /// In tr, this message translates to:
  /// **'Davetler yenilenemedi. Önceki davetler gösteriliyor.'**
  String get visitorStale;

  /// No description provided for @visitorRefresh.
  ///
  /// In tr, this message translates to:
  /// **'Yenile'**
  String get visitorRefresh;

  /// No description provided for @profileChangePassword.
  ///
  /// In tr, this message translates to:
  /// **'Şifreyi değiştir'**
  String get profileChangePassword;

  /// No description provided for @profileCurrentPassword.
  ///
  /// In tr, this message translates to:
  /// **'Mevcut şifre'**
  String get profileCurrentPassword;

  /// No description provided for @profileNewPassword.
  ///
  /// In tr, this message translates to:
  /// **'Yeni şifre'**
  String get profileNewPassword;

  /// No description provided for @profileRepeatPassword.
  ///
  /// In tr, this message translates to:
  /// **'Yeni şifreyi tekrar girin'**
  String get profileRepeatPassword;

  /// No description provided for @profilePasswordRules.
  ///
  /// In tr, this message translates to:
  /// **'Yeni şifre en az 8 karakter olmalı; büyük harf, küçük harf ve rakam içermeli, en fazla 72 UTF-8 bayt olmalı ve mevcut şifrenizden farklı olmalıdır. Şifre değişince tüm oturumlar kapanır; yeniden giriş yapmanız gerekir.'**
  String get profilePasswordRules;

  /// No description provided for @profilePasswordInvalid.
  ///
  /// In tr, this message translates to:
  /// **'Şifre kurallarını ve iki yeni şifrenin eşleştiğini kontrol edin.'**
  String get profilePasswordInvalid;

  /// No description provided for @profilePasswordRequired.
  ///
  /// In tr, this message translates to:
  /// **'Mevcut şifrenizi girin.'**
  String get profilePasswordRequired;

  /// No description provided for @profilePasswordChanged.
  ///
  /// In tr, this message translates to:
  /// **'Şifreniz değiştirildi. Yeni şifrenizle giriş yapın.'**
  String get profilePasswordChanged;

  /// No description provided for @errorRateLimited.
  ///
  /// In tr, this message translates to:
  /// **'Çok fazla deneme yapıldı. Bir süre bekleyip yeniden deneyin.'**
  String get errorRateLimited;

  /// No description provided for @errorSessionStorageFailed.
  ///
  /// In tr, this message translates to:
  /// **'Oturum güvenli biçimde saklanamadı. Lütfen yeniden giriş yapın.'**
  String get errorSessionStorageFailed;

  /// No description provided for @errorProtocol.
  ///
  /// In tr, this message translates to:
  /// **'İşlem tamamlanamadı. Yeniden deneyin.'**
  String get errorProtocol;

  /// No description provided for @errorPasswordPolicy.
  ///
  /// In tr, this message translates to:
  /// **'Yeni şifre en az 8 karakter olmalı; büyük harf, küçük harf ve rakam içermeli, en fazla 72 UTF-8 bayt olmalı ve mevcut şifreden farklı olmalıdır.'**
  String get errorPasswordPolicy;

  /// No description provided for @homeChooseDoor.
  ///
  /// In tr, this message translates to:
  /// **'Kapı seçin'**
  String get homeChooseDoor;

  /// No description provided for @homeDoorUnavailable.
  ///
  /// In tr, this message translates to:
  /// **'Seçilen kapı kullanılamıyor. Yeni bir kapı seçin.'**
  String get homeDoorUnavailable;

  /// No description provided for @homeNoOpenableDoor.
  ///
  /// In tr, this message translates to:
  /// **'Bu cihazda açılabilir bir kapı yok.'**
  String get homeNoOpenableDoor;

  /// No description provided for @startupContactAdministrator.
  ///
  /// In tr, this message translates to:
  /// **'Sorun devam ederse kurumunuzun sistem yöneticisine başvurun.'**
  String get startupContactAdministrator;

  /// No description provided for @selectDeviceInactive.
  ///
  /// In tr, this message translates to:
  /// **'Hedef devre dışı'**
  String get selectDeviceInactive;

  /// No description provided for @selectDeviceOutsideSchedule.
  ///
  /// In tr, this message translates to:
  /// **'Şu anda erişim saatleri dışında'**
  String get selectDeviceOutsideSchedule;

  /// No description provided for @selectDeviceUnsupported.
  ///
  /// In tr, this message translates to:
  /// **'Bu hedefte mobil açma desteklenmiyor'**
  String get selectDeviceUnsupported;

  /// No description provided for @selectDeviceUnavailable.
  ///
  /// In tr, this message translates to:
  /// **'Bu hedef şu anda kullanılamıyor'**
  String get selectDeviceUnavailable;

  /// No description provided for @visitorOutcomeUnknown.
  ///
  /// In tr, this message translates to:
  /// **'Sonuç bilinmiyor. Başka bir kayıt oluşturmadan aynı daveti yeniden deneyin; yinelenen kayıtları önlemek için bilgiler kilitlendi.'**
  String get visitorOutcomeUnknown;

  /// No description provided for @homeCommandRetrySameRequest.
  ///
  /// In tr, this message translates to:
  /// **'Aynı isteği yeniden gönder'**
  String get homeCommandRetrySameRequest;

  /// No description provided for @homeCommandSending.
  ///
  /// In tr, this message translates to:
  /// **'Komut gönderiliyor; sonuç bekleniyor.'**
  String get homeCommandSending;

  /// No description provided for @startupConfigurationUnavailable.
  ///
  /// In tr, this message translates to:
  /// **'Uygulama başlatılamadı. Yeniden deneyin veya kurumunuzun sistem yöneticisine başvurun.'**
  String get startupConfigurationUnavailable;

  /// No description provided for @visitorSearch.
  ///
  /// In tr, this message translates to:
  /// **'Davetlerde ara'**
  String get visitorSearch;

  /// No description provided for @visitorAllStatuses.
  ///
  /// In tr, this message translates to:
  /// **'Tüm erişim durumları'**
  String get visitorAllStatuses;

  /// No description provided for @visitorSummaryTitle.
  ///
  /// In tr, this message translates to:
  /// **'Tüm davetlerin özeti'**
  String get visitorSummaryTitle;

  /// No description provided for @visitorSummaryLimited.
  ///
  /// In tr, this message translates to:
  /// **'Bazı davetler özete dahil edilemedi; gerçek toplam daha yüksek olabilir.'**
  String get visitorSummaryLimited;

  /// No description provided for @visitorSummaryError.
  ///
  /// In tr, this message translates to:
  /// **'Özet yenilenemedi.'**
  String get visitorSummaryError;

  /// No description provided for @visitorSyncTitle.
  ///
  /// In tr, this message translates to:
  /// **'Cihaz durumu'**
  String get visitorSyncTitle;

  /// No description provided for @visitorSyncPending.
  ///
  /// In tr, this message translates to:
  /// **'Cihaz güncellemesi bekliyor'**
  String get visitorSyncPending;

  /// No description provided for @visitorSyncApplied.
  ///
  /// In tr, this message translates to:
  /// **'Cihaz güncellemeyi onayladı'**
  String get visitorSyncApplied;

  /// No description provided for @visitorSyncFailed.
  ///
  /// In tr, this message translates to:
  /// **'Cihaz güncellemesi başarısız; operatörle iletişime geçin.'**
  String get visitorSyncFailed;

  /// No description provided for @visitorSyncUnknown.
  ///
  /// In tr, this message translates to:
  /// **'Cihaz sonucu doğrulanamadı'**
  String get visitorSyncUnknown;

  /// No description provided for @profileDiagnosticsTitle.
  ///
  /// In tr, this message translates to:
  /// **'Teknik destek raporu'**
  String get profileDiagnosticsTitle;

  /// No description provided for @profileDiagnosticsBody.
  ///
  /// In tr, this message translates to:
  /// **'Uygulama sürümü, derleme ve son teknik hataları kuruluşunuzun destek ekibi için kopyalayın. Hesap bilgileri, parolalar, QR kodları ve yanıt gövdeleri dahil edilmez. Sınırlı kayıt uygulama kapanana kadar bellekte kalır; otomatik gönderim yapılmaz. Kopyalama raporu diğer uygulamaların erişebileceği sistem panosuna koyar. Yerel kaydı temizlemek önceden kopyalanan raporu silmez.'**
  String get profileDiagnosticsBody;

  /// No description provided for @profileDiagnosticsEmpty.
  ///
  /// In tr, this message translates to:
  /// **'Yakın zamanda kaydedilen teknik hata yok. Rapor yine de uygulama ve derleme bilgisini içerir.'**
  String get profileDiagnosticsEmpty;

  /// No description provided for @profileDiagnosticsCopy.
  ///
  /// In tr, this message translates to:
  /// **'Destek raporunu kopyala'**
  String get profileDiagnosticsCopy;

  /// No description provided for @profileDiagnosticsClear.
  ///
  /// In tr, this message translates to:
  /// **'Yerel kaydı temizle'**
  String get profileDiagnosticsClear;

  /// No description provided for @profileDiagnosticsCopied.
  ///
  /// In tr, this message translates to:
  /// **'Destek raporu kopyalandı. Yalnız kuruluşunuzun destek ekibiyle paylaşın.'**
  String get profileDiagnosticsCopied;

  /// No description provided for @profileDiagnosticsCopyFailed.
  ///
  /// In tr, this message translates to:
  /// **'Rapor kopyalanamadı. Lütfen tekrar deneyin.'**
  String get profileDiagnosticsCopyFailed;

  /// No description provided for @profileDiagnosticsCleared.
  ///
  /// In tr, this message translates to:
  /// **'Yerel kayıt temizlendi. Önceden kopyalanan raporlar panoda kalır.'**
  String get profileDiagnosticsCleared;

  /// No description provided for @visitorNotes.
  ///
  /// In tr, this message translates to:
  /// **'Notlar'**
  String get visitorNotes;

  /// No description provided for @visitorOptionalHint.
  ///
  /// In tr, this message translates to:
  /// **'İsteğe bağlı'**
  String get visitorOptionalHint;

  /// No description provided for @historyInfoTitle.
  ///
  /// In tr, this message translates to:
  /// **'Kayıtlar hakkında'**
  String get historyInfoTitle;

  /// No description provided for @historyTimeZone.
  ///
  /// In tr, this message translates to:
  /// **'Türkiye saati · UTC+3'**
  String get historyTimeZone;

  /// No description provided for @historyAllDates.
  ///
  /// In tr, this message translates to:
  /// **'Tüm tarihler'**
  String get historyAllDates;

  /// No description provided for @historyAllDevices.
  ///
  /// In tr, this message translates to:
  /// **'Tüm kapılar'**
  String get historyAllDevices;

  /// No description provided for @historyApplyFilters.
  ///
  /// In tr, this message translates to:
  /// **'Filtreleri uygula'**
  String get historyApplyFilters;

  /// No description provided for @historyShowAllRecords.
  ///
  /// In tr, this message translates to:
  /// **'Tüm kayıtları göster'**
  String get historyShowAllRecords;

  /// No description provided for @historyFilteredEmptyHint.
  ///
  /// In tr, this message translates to:
  /// **'Seçtiğiniz tarih veya cihaz için kayıt bulunmuyor.'**
  String get historyFilteredEmptyHint;

  /// No description provided for @historyCalendarLegend.
  ///
  /// In tr, this message translates to:
  /// **'Noktalı günlerde kayıt var.'**
  String get historyCalendarLegend;

  /// No description provided for @historySelectDayHint.
  ///
  /// In tr, this message translates to:
  /// **'Kayıtlarını görmek için bir gün seçin.'**
  String get historySelectDayHint;

  /// No description provided for @historyNoActivity.
  ///
  /// In tr, this message translates to:
  /// **'Bu dönemde erişim hareketi yok'**
  String get historyNoActivity;

  /// No description provided for @historyNoActivityHint.
  ///
  /// In tr, this message translates to:
  /// **'Yeni kayıtlar burada görünecek. Kayıt olmaması devamsızlık anlamına gelmez.'**
  String get historyNoActivityHint;

  /// No description provided for @historyDeniedCount.
  ///
  /// In tr, this message translates to:
  /// **'Reddedilen'**
  String get historyDeniedCount;

  /// No description provided for @historyUnknownCount.
  ///
  /// In tr, this message translates to:
  /// **'Belirsiz'**
  String get historyUnknownCount;

  /// No description provided for @historyLoadedDevices.
  ///
  /// In tr, this message translates to:
  /// **'Bu listedeki kayıtlarda yer alan kapılar gösterilir.'**
  String get historyLoadedDevices;

  /// No description provided for @historyNoDeviceOptions.
  ///
  /// In tr, this message translates to:
  /// **'Bu kayıtlar için kapı seçeneği yok.'**
  String get historyNoDeviceOptions;

  /// No description provided for @historyTabThisMonthPeriod.
  ///
  /// In tr, this message translates to:
  /// **'Bu ay'**
  String get historyTabThisMonthPeriod;

  /// No description provided for @visitorPeopleSection.
  ///
  /// In tr, this message translates to:
  /// **'Kişi bilgileri'**
  String get visitorPeopleSection;

  /// No description provided for @visitorVisitSection.
  ///
  /// In tr, this message translates to:
  /// **'Ziyaret bilgileri'**
  String get visitorVisitSection;

  /// No description provided for @visitorActivationHint.
  ///
  /// In tr, this message translates to:
  /// **'Davet kaydı oluşturulduktan sonra yetkili aktivasyonu gerekir.'**
  String get visitorActivationHint;

  /// No description provided for @visitorMetricPending.
  ///
  /// In tr, this message translates to:
  /// **'Onay bekliyor'**
  String get visitorMetricPending;

  /// No description provided for @visitorPendingShort.
  ///
  /// In tr, this message translates to:
  /// **'Aktivasyon bekliyor'**
  String get visitorPendingShort;

  /// No description provided for @visitorInvitationsTitle.
  ///
  /// In tr, this message translates to:
  /// **'Davetler'**
  String get visitorInvitationsTitle;

  /// No description provided for @visitorFilteredEmptyHint.
  ///
  /// In tr, this message translates to:
  /// **'Arama veya durum filtresiyle eşleşen davet bulunamadı.'**
  String get visitorFilteredEmptyHint;

  /// No description provided for @visitorClearFilters.
  ///
  /// In tr, this message translates to:
  /// **'Filtreleri temizle'**
  String get visitorClearFilters;

  /// No description provided for @visitorNoticeUnavailable.
  ///
  /// In tr, this message translates to:
  /// **'Aydınlatma bilgisi yüklenemedi. Kaydetmeden önce tekrar deneyin.'**
  String get visitorNoticeUnavailable;

  /// No description provided for @profileProject.
  ///
  /// In tr, this message translates to:
  /// **'Kurum ve proje'**
  String get profileProject;

  /// No description provided for @profileProjectUnavailable.
  ///
  /// In tr, this message translates to:
  /// **'Proje bilgisi şu anda kullanılamıyor'**
  String get profileProjectUnavailable;

  /// No description provided for @doorOperationRecoveryTitle.
  ///
  /// In tr, this message translates to:
  /// **'Kapı işlemini kontrol et'**
  String get doorOperationRecoveryTitle;

  /// No description provided for @doorOperationNothingToCheck.
  ///
  /// In tr, this message translates to:
  /// **'Kontrol edilecek kapı işlemi yok.'**
  String get doorOperationNothingToCheck;

  /// No description provided for @doorOperationRecoveryHint.
  ///
  /// In tr, this message translates to:
  /// **'Önce önceki isteğin durumu kontrol edilir. Tekrar denerseniz aynı istek ve aynı kapı kullanılır. Komut sonucu fiziksel geçişi doğrulamaz.'**
  String get doorOperationRecoveryHint;

  /// No description provided for @visitorRecoveryChecking.
  ///
  /// In tr, this message translates to:
  /// **'Önceki ziyaretçi isteği kontrol ediliyor…'**
  String get visitorRecoveryChecking;

  /// No description provided for @visitorRecoveryUnresolved.
  ///
  /// In tr, this message translates to:
  /// **'Önceki isteğin sonucu henüz doğrulanamadı. Aynı ziyaretçi bilgilerini girip aynı isteği tekrar deneyebilirsiniz. Yeni bir istek oluşturulmayacak.'**
  String get visitorRecoveryUnresolved;

  /// No description provided for @visitorRecoveryRetry.
  ///
  /// In tr, this message translates to:
  /// **'Aynı isteği tekrar dene'**
  String get visitorRecoveryRetry;

  /// No description provided for @visitorRecoveryFound.
  ///
  /// In tr, this message translates to:
  /// **'Önceki ziyaretçi kaydı bulundu.'**
  String get visitorRecoveryFound;

  /// No description provided for @visitorRecoveryStorageError.
  ///
  /// In tr, this message translates to:
  /// **'Ziyaretçi isteği güvenli biçimde saklanamadı veya okunamadı. Devam etmeden önce durumu tekrar kontrol edin.'**
  String get visitorRecoveryStorageError;

  /// No description provided for @errorRequestProjectMissing.
  ///
  /// In tr, this message translates to:
  /// **'Çalışanın proje bilgisi bulunamadı'**
  String get errorRequestProjectMissing;

  /// No description provided for @errorRequestNoteTooLong.
  ///
  /// In tr, this message translates to:
  /// **'Not en fazla 500 karakter olabilir'**
  String get errorRequestNoteTooLong;

  /// No description provided for @errorRequestDateInvalid.
  ///
  /// In tr, this message translates to:
  /// **'Geçerli bir tarih seçin.'**
  String get errorRequestDateInvalid;

  /// No description provided for @errorRequestRangeInvalid.
  ///
  /// In tr, this message translates to:
  /// **'Bitiş tarihi başlangıçtan önce olamaz'**
  String get errorRequestRangeInvalid;

  /// No description provided for @errorRequestStartTooOld.
  ///
  /// In tr, this message translates to:
  /// **'İzin başlangıcı en fazla 30 gün geçmiş olabilir'**
  String get errorRequestStartTooOld;

  /// No description provided for @errorRequestRangeTooLong.
  ///
  /// In tr, this message translates to:
  /// **'İzin aralığı en fazla 60 gün olabilir'**
  String get errorRequestRangeTooLong;

  /// No description provided for @errorRequestPendingLimit.
  ///
  /// In tr, this message translates to:
  /// **'En fazla 10 bekleyen izin talebiniz olabilir'**
  String get errorRequestPendingLimit;

  /// No description provided for @errorRequestOverlapPending.
  ///
  /// In tr, this message translates to:
  /// **'Seçilen tarihler bekleyen başka bir izin talebiyle çakışıyor'**
  String get errorRequestOverlapPending;

  /// No description provided for @errorRequestOverlapApproved.
  ///
  /// In tr, this message translates to:
  /// **'Seçilen tarihler onaylı başka bir izinle çakışıyor'**
  String get errorRequestOverlapApproved;

  /// No description provided for @errorRequestNotFound.
  ///
  /// In tr, this message translates to:
  /// **'Talep bulunamadı.'**
  String get errorRequestNotFound;

  /// No description provided for @errorRequestNotPending.
  ///
  /// In tr, this message translates to:
  /// **'Yalnız bekleyen kendi talebinizi geri çekebilirsiniz.'**
  String get errorRequestNotPending;

  /// No description provided for @errorCorrectionDateOutOfRange.
  ///
  /// In tr, this message translates to:
  /// **'Tarih bugün ile son 30 gün arasında olmalı'**
  String get errorCorrectionDateOutOfRange;

  /// No description provided for @errorCorrectionReasonLength.
  ///
  /// In tr, this message translates to:
  /// **'Gerekçe 5–300 karakter olmalı'**
  String get errorCorrectionReasonLength;

  /// No description provided for @errorCorrectionTimesMismatch.
  ///
  /// In tr, this message translates to:
  /// **'Düzeltme türüne uygun giriş ve çıkış saatlerini belirtin'**
  String get errorCorrectionTimesMismatch;

  /// No description provided for @errorCorrectionTimeInvalid.
  ///
  /// In tr, this message translates to:
  /// **'Geçerli bir saat seçin.'**
  String get errorCorrectionTimeInvalid;

  /// No description provided for @errorCorrectionPendingExists.
  ///
  /// In tr, this message translates to:
  /// **'Bu gün için bekleyen bir düzeltme talebiniz var'**
  String get errorCorrectionPendingExists;

  /// No description provided for @requestsTitle.
  ///
  /// In tr, this message translates to:
  /// **'Taleplerim'**
  String get requestsTitle;

  /// No description provided for @requestsLeave.
  ///
  /// In tr, this message translates to:
  /// **'İzin'**
  String get requestsLeave;

  /// No description provided for @requestsCorrection.
  ///
  /// In tr, this message translates to:
  /// **'Kayıt düzeltme'**
  String get requestsCorrection;

  /// No description provided for @requestsNew.
  ///
  /// In tr, this message translates to:
  /// **'Yeni talep'**
  String get requestsNew;

  /// No description provided for @requestsEmpty.
  ///
  /// In tr, this message translates to:
  /// **'Henüz talebiniz yok.'**
  String get requestsEmpty;

  /// No description provided for @requestsRetry.
  ///
  /// In tr, this message translates to:
  /// **'Yeniden dene'**
  String get requestsRetry;

  /// No description provided for @requestsWithdraw.
  ///
  /// In tr, this message translates to:
  /// **'Talebi geri çek'**
  String get requestsWithdraw;

  /// No description provided for @requestsWithdrawConfirm.
  ///
  /// In tr, this message translates to:
  /// **'Bu talebi geri çekmek istiyor musunuz?'**
  String get requestsWithdrawConfirm;

  /// No description provided for @requestsCancel.
  ///
  /// In tr, this message translates to:
  /// **'Vazgeç'**
  String get requestsCancel;

  /// No description provided for @requestsUncertain.
  ///
  /// In tr, this message translates to:
  /// **'Talep gönderilmiş olabilir; listeyi kontrol edin.'**
  String get requestsUncertain;

  /// No description provided for @requestsAdmin.
  ///
  /// In tr, this message translates to:
  /// **'Yönetici kaydı'**
  String get requestsAdmin;

  /// No description provided for @requestsPending.
  ///
  /// In tr, this message translates to:
  /// **'Bekliyor'**
  String get requestsPending;

  /// No description provided for @requestsApproved.
  ///
  /// In tr, this message translates to:
  /// **'Onaylandı'**
  String get requestsApproved;

  /// No description provided for @requestsRejected.
  ///
  /// In tr, this message translates to:
  /// **'Reddedildi'**
  String get requestsRejected;

  /// No description provided for @requestsWithdrawn.
  ///
  /// In tr, this message translates to:
  /// **'Geri çekildi'**
  String get requestsWithdrawn;

  /// No description provided for @requestsUnknown.
  ///
  /// In tr, this message translates to:
  /// **'Bilinmiyor'**
  String get requestsUnknown;

  /// No description provided for @requestsOther.
  ///
  /// In tr, this message translates to:
  /// **'Diğer'**
  String get requestsOther;

  /// No description provided for @requestsStart.
  ///
  /// In tr, this message translates to:
  /// **'Başlangıç tarihi'**
  String get requestsStart;

  /// No description provided for @requestsEnd.
  ///
  /// In tr, this message translates to:
  /// **'Bitiş tarihi'**
  String get requestsEnd;

  /// No description provided for @requestsDate.
  ///
  /// In tr, this message translates to:
  /// **'Tarih'**
  String get requestsDate;

  /// No description provided for @requestsNotes.
  ///
  /// In tr, this message translates to:
  /// **'Not'**
  String get requestsNotes;

  /// No description provided for @requestsReason.
  ///
  /// In tr, this message translates to:
  /// **'Gerekçe'**
  String get requestsReason;

  /// No description provided for @requestsType.
  ///
  /// In tr, this message translates to:
  /// **'Tür'**
  String get requestsType;

  /// No description provided for @requestsCheckIn.
  ///
  /// In tr, this message translates to:
  /// **'Giriş'**
  String get requestsCheckIn;

  /// No description provided for @requestsCheckOut.
  ///
  /// In tr, this message translates to:
  /// **'Çıkış'**
  String get requestsCheckOut;

  /// No description provided for @requestsBoth.
  ///
  /// In tr, this message translates to:
  /// **'İkisi'**
  String get requestsBoth;

  /// No description provided for @requestsDecision.
  ///
  /// In tr, this message translates to:
  /// **'Yönetici karar notu'**
  String get requestsDecision;

  /// No description provided for @requestsLeaveAnnual.
  ///
  /// In tr, this message translates to:
  /// **'Yıllık izin'**
  String get requestsLeaveAnnual;

  /// No description provided for @requestsLeaveSick.
  ///
  /// In tr, this message translates to:
  /// **'Hastalık izni'**
  String get requestsLeaveSick;

  /// No description provided for @requestsLeaveExcuse.
  ///
  /// In tr, this message translates to:
  /// **'Mazeret izni'**
  String get requestsLeaveExcuse;

  /// No description provided for @requestsLeaveUnpaid.
  ///
  /// In tr, this message translates to:
  /// **'Ücretsiz izin'**
  String get requestsLeaveUnpaid;

  /// No description provided for @requestsLeaveParental.
  ///
  /// In tr, this message translates to:
  /// **'Doğum izni'**
  String get requestsLeaveParental;

  /// No description provided for @requestsLeaveMarriage.
  ///
  /// In tr, this message translates to:
  /// **'Evlilik izni'**
  String get requestsLeaveMarriage;

  /// No description provided for @requestsLeaveBereavement.
  ///
  /// In tr, this message translates to:
  /// **'Vefat izni'**
  String get requestsLeaveBereavement;

  /// No description provided for @requestsLeavePaternity.
  ///
  /// In tr, this message translates to:
  /// **'Babalık izni'**
  String get requestsLeavePaternity;

  /// No description provided for @requestsLeaveLactation.
  ///
  /// In tr, this message translates to:
  /// **'Süt izni'**
  String get requestsLeaveLactation;

  /// No description provided for @requestsLeaveCompensatory.
  ///
  /// In tr, this message translates to:
  /// **'Telafi izni'**
  String get requestsLeaveCompensatory;

  /// No description provided for @requestsWithdrawUncertain.
  ///
  /// In tr, this message translates to:
  /// **'Talep geri çekilmiş olabilir; listeyi kontrol edin.'**
  String get requestsWithdrawUncertain;

  /// No description provided for @errorSummaryTooLarge.
  ///
  /// In tr, this message translates to:
  /// **'Bu dönem için özet oluşturulamıyor. Tarih aralığını küçültün.'**
  String get errorSummaryTooLarge;

  /// No description provided for @errorInvalidCursor.
  ///
  /// In tr, this message translates to:
  /// **'Geçmiş sayfası artık geçerli değil. Listeyi yenileyin.'**
  String get errorInvalidCursor;

  /// No description provided for @errorDeviceNotFound.
  ///
  /// In tr, this message translates to:
  /// **'Cihaz bu projede bulunamadı. Cihaz seçimini yenileyin veya yöneticinize başvurun.'**
  String get errorDeviceNotFound;

  /// No description provided for @errorSummaryInvalidData.
  ///
  /// In tr, this message translates to:
  /// **'Kayıt zamanları doğrulanamadı. Kayıtların kontrolü için yöneticinize başvurun.'**
  String get errorSummaryInvalidData;

  /// No description provided for @errorVisitorInvalid.
  ///
  /// In tr, this message translates to:
  /// **'Ziyaretçi bilgileri veya liste sayfası geçersiz. Bilgileri ve tarihleri kontrol edin; gerekirse listeyi yenileyin.'**
  String get errorVisitorInvalid;

  /// No description provided for @errorVisitorLocked.
  ///
  /// In tr, this message translates to:
  /// **'Bu davet artık düzenlenemiyor. Daveti yenileyin veya operatöre başvurun.'**
  String get errorVisitorLocked;

  /// No description provided for @errorVisitorNoticeChanged.
  ///
  /// In tr, this message translates to:
  /// **'Ziyaretçi aydınlatma metni değişti. Davet formunu yenileyip güncel metni okuyun ve tekrar onaylayın.'**
  String get errorVisitorNoticeChanged;

  /// No description provided for @errorRequestConflict.
  ///
  /// In tr, this message translates to:
  /// **'Bu işlem farklı ziyaretçi bilgileriyle daha önce kaydedilmiş. Ziyaretçi listesini yenileyip mevcut daveti kontrol edin.'**
  String get errorRequestConflict;

  /// No description provided for @navQr.
  ///
  /// In tr, this message translates to:
  /// **'QR'**
  String get navQr;

  /// No description provided for @homeToday.
  ///
  /// In tr, this message translates to:
  /// **'Bugün'**
  String get homeToday;

  /// No description provided for @homeFirstEntry.
  ///
  /// In tr, this message translates to:
  /// **'İlk giriş'**
  String get homeFirstEntry;

  /// No description provided for @loginSigningIn.
  ///
  /// In tr, this message translates to:
  /// **'Giriş yapılıyor'**
  String get loginSigningIn;

  /// No description provided for @fieldSelectDate.
  ///
  /// In tr, this message translates to:
  /// **'Tarih seçin'**
  String get fieldSelectDate;

  /// No description provided for @fieldSelectTime.
  ///
  /// In tr, this message translates to:
  /// **'Saat seçin'**
  String get fieldSelectTime;

  /// No description provided for @fieldSelectOption.
  ///
  /// In tr, this message translates to:
  /// **'Seçin'**
  String get fieldSelectOption;

  /// No description provided for @requestsLeaveFormTitle.
  ///
  /// In tr, this message translates to:
  /// **'İzin talebi'**
  String get requestsLeaveFormTitle;

  /// No description provided for @requestsCorrectionFormTitle.
  ///
  /// In tr, this message translates to:
  /// **'Kayıt düzeltme talebi'**
  String get requestsCorrectionFormTitle;

  /// No description provided for @requestsLeaveSubmit.
  ///
  /// In tr, this message translates to:
  /// **'İzin talebi gönder'**
  String get requestsLeaveSubmit;

  /// No description provided for @requestsLeaveSubmitting.
  ///
  /// In tr, this message translates to:
  /// **'İzin talebi gönderiliyor'**
  String get requestsLeaveSubmitting;

  /// No description provided for @requestsLeaveSubmitted.
  ///
  /// In tr, this message translates to:
  /// **'İzin talebi gönderildi'**
  String get requestsLeaveSubmitted;

  /// No description provided for @requestsCorrectionSubmit.
  ///
  /// In tr, this message translates to:
  /// **'Düzeltme talebi gönder'**
  String get requestsCorrectionSubmit;

  /// No description provided for @requestsCorrectionSubmitting.
  ///
  /// In tr, this message translates to:
  /// **'Düzeltme talebi gönderiliyor'**
  String get requestsCorrectionSubmitting;

  /// No description provided for @requestsCorrectionSubmitted.
  ///
  /// In tr, this message translates to:
  /// **'Düzeltme talebi gönderildi'**
  String get requestsCorrectionSubmitted;

  /// No description provided for @requestsWithdrawnToast.
  ///
  /// In tr, this message translates to:
  /// **'Talep geri çekildi'**
  String get requestsWithdrawnToast;

  /// No description provided for @requestsTimeZoneHint.
  ///
  /// In tr, this message translates to:
  /// **'Saatler Türkiye saatine göre girilir.'**
  String get requestsTimeZoneHint;

  /// No description provided for @visitorSaving.
  ///
  /// In tr, this message translates to:
  /// **'Davet kaydediliyor'**
  String get visitorSaving;

  /// No description provided for @visitorLoadFailed.
  ///
  /// In tr, this message translates to:
  /// **'Davetler alınamadı. Yeniden deneyin.'**
  String get visitorLoadFailed;

  /// No description provided for @visitorNoMatchTitle.
  ///
  /// In tr, this message translates to:
  /// **'Eşleşen davet yok'**
  String get visitorNoMatchTitle;

  /// No description provided for @commonLoading.
  ///
  /// In tr, this message translates to:
  /// **'Yükleniyor'**
  String get commonLoading;

  /// No description provided for @fieldNoOptions.
  ///
  /// In tr, this message translates to:
  /// **'Seçenek yok'**
  String get fieldNoOptions;

  /// No description provided for @metricNoRecord.
  ///
  /// In tr, this message translates to:
  /// **'Kayıt yok'**
  String get metricNoRecord;

  /// No description provided for @fieldClear.
  ///
  /// In tr, this message translates to:
  /// **'Temizle'**
  String get fieldClear;

  /// Localized record count; English singular/plural, Turkish number followed by noun.
  ///
  /// In tr, this message translates to:
  /// **'Bu hafta toplam {count} kayıt'**
  String historyWeeklyTotalRecords(int count);

  /// No description provided for @unlockGranted.
  ///
  /// In tr, this message translates to:
  /// **'Erişim Verildi'**
  String get unlockGranted;

  /// No description provided for @visitorPreRegistered.
  ///
  /// In tr, this message translates to:
  /// **'Yetkili aktivasyonu bekleniyor'**
  String get visitorPreRegistered;
}

class _AppLocalizationsDelegate
    extends LocalizationsDelegate<AppLocalizations> {
  const _AppLocalizationsDelegate();

  @override
  Future<AppLocalizations> load(Locale locale) {
    return SynchronousFuture<AppLocalizations>(lookupAppLocalizations(locale));
  }

  @override
  bool isSupported(Locale locale) =>
      <String>['en', 'tr'].contains(locale.languageCode);

  @override
  bool shouldReload(_AppLocalizationsDelegate old) => false;
}

AppLocalizations lookupAppLocalizations(Locale locale) {
  // Lookup logic when only language code is specified.
  switch (locale.languageCode) {
    case 'en':
      return AppLocalizationsEn();
    case 'tr':
      return AppLocalizationsTr();
  }

  throw FlutterError(
    'AppLocalizations.delegate failed to load unsupported locale "$locale". This is likely '
    'an issue with the localizations generation tool. Please file an issue '
    'on GitHub with a reproducible sample app and the gen-l10n configuration '
    'that was used.',
  );
}

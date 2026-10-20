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

  /// No description provided for @appTagline.
  ///
  /// In tr, this message translates to:
  /// **'Yoklama Takip Sistemi'**
  String get appTagline;

  /// No description provided for @pdksTitle.
  ///
  /// In tr, this message translates to:
  /// **'PDKS Sistemi'**
  String get pdksTitle;

  /// No description provided for @pdksSubtitle.
  ///
  /// In tr, this message translates to:
  /// **'Personel Devam Kontrol Sistemi'**
  String get pdksSubtitle;

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
  /// **'Tekrar Dene'**
  String get commonRetry;

  /// No description provided for @commonError.
  ///
  /// In tr, this message translates to:
  /// **'Hata'**
  String get commonError;

  /// No description provided for @commonSuccess.
  ///
  /// In tr, this message translates to:
  /// **'Başarılı'**
  String get commonSuccess;

  /// No description provided for @commonAdd.
  ///
  /// In tr, this message translates to:
  /// **'Ekle'**
  String get commonAdd;

  /// No description provided for @comingSoon.
  ///
  /// In tr, this message translates to:
  /// **'Yakında eklenecek.'**
  String get comingSoon;

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

  /// No description provided for @loginTitle.
  ///
  /// In tr, this message translates to:
  /// **'Giriş Yap'**
  String get loginTitle;

  /// No description provided for @loginPrompt.
  ///
  /// In tr, this message translates to:
  /// **'PDKS sistemine giriş yapmak için bilgilerinizi giriniz'**
  String get loginPrompt;

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

  /// No description provided for @loginRememberMe.
  ///
  /// In tr, this message translates to:
  /// **'Beni Hatırla'**
  String get loginRememberMe;

  /// No description provided for @loginForgotPassword.
  ///
  /// In tr, this message translates to:
  /// **'Şifremi unuttum'**
  String get loginForgotPassword;

  /// No description provided for @forgotPasswordTitle.
  ///
  /// In tr, this message translates to:
  /// **'Şifre Sıfırla'**
  String get forgotPasswordTitle;

  /// No description provided for @forgotPasswordHeadline.
  ///
  /// In tr, this message translates to:
  /// **'Şifrenizi mi unuttunuz?'**
  String get forgotPasswordHeadline;

  /// No description provided for @forgotPasswordPrompt.
  ///
  /// In tr, this message translates to:
  /// **'E-posta adresinizi girin, size şifre sıfırlama bağlantısı gönderelim.'**
  String get forgotPasswordPrompt;

  /// No description provided for @forgotPasswordSendButton.
  ///
  /// In tr, this message translates to:
  /// **'Sıfırlama Bağlantısı Gönder'**
  String get forgotPasswordSendButton;

  /// No description provided for @forgotPasswordBackToLogin.
  ///
  /// In tr, this message translates to:
  /// **'Giriş sayfasına dön'**
  String get forgotPasswordBackToLogin;

  /// No description provided for @forgotPasswordSuccessTitle.
  ///
  /// In tr, this message translates to:
  /// **'E-posta Gönderildi!'**
  String get forgotPasswordSuccessTitle;

  /// No description provided for @forgotPasswordSuccessBody.
  ///
  /// In tr, this message translates to:
  /// **'{email} adresine şifre sıfırlama bağlantısı gönderildi. E-postanızı kontrol edin.'**
  String forgotPasswordSuccessBody(String email);

  /// No description provided for @forgotPasswordSuccessButton.
  ///
  /// In tr, this message translates to:
  /// **'Giriş Sayfasına Dön'**
  String get forgotPasswordSuccessButton;

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
  /// **'{greeting}, {name}!'**
  String homeGreetingLine(String greeting, String name);

  /// No description provided for @homeAttendanceStatus.
  ///
  /// In tr, this message translates to:
  /// **'Yoklama Durumu'**
  String get homeAttendanceStatus;

  /// No description provided for @homeScanCheckIn.
  ///
  /// In tr, this message translates to:
  /// **'QR Kod Tara - Giriş Yap'**
  String get homeScanCheckIn;

  /// No description provided for @homeScanCheckOut.
  ///
  /// In tr, this message translates to:
  /// **'QR Kod Tara - Çıkış Yap'**
  String get homeScanCheckOut;

  /// No description provided for @homeStatusInside.
  ///
  /// In tr, this message translates to:
  /// **'İçeride'**
  String get homeStatusInside;

  /// No description provided for @homeStatusOut.
  ///
  /// In tr, this message translates to:
  /// **'Çıktı'**
  String get homeStatusOut;

  /// No description provided for @homeStatusNone.
  ///
  /// In tr, this message translates to:
  /// **'Henüz Yok'**
  String get homeStatusNone;

  /// No description provided for @homeAttendanceEntryRow.
  ///
  /// In tr, this message translates to:
  /// **'Son Giriş'**
  String get homeAttendanceEntryRow;

  /// No description provided for @homeAttendanceExitRow.
  ///
  /// In tr, this message translates to:
  /// **'Son Çıkış'**
  String get homeAttendanceExitRow;

  /// Localized record count; English singular/plural, Turkish number followed by noun.
  ///
  /// In tr, this message translates to:
  /// **'+{count} hareket'**
  String homeExtraMovements(int count);

  /// No description provided for @homeScanCheckInAgain.
  ///
  /// In tr, this message translates to:
  /// **'QR Kod Tara - Tekrar Giriş'**
  String get homeScanCheckInAgain;

  /// No description provided for @homeAttendanceTimeEmpty.
  ///
  /// In tr, this message translates to:
  /// **'—'**
  String get homeAttendanceTimeEmpty;

  /// No description provided for @homeMonthSummary.
  ///
  /// In tr, this message translates to:
  /// **'Bu Ayki Özet'**
  String get homeMonthSummary;

  /// No description provided for @homeStatTotalDays.
  ///
  /// In tr, this message translates to:
  /// **'Toplam Gün'**
  String get homeStatTotalDays;

  /// No description provided for @homeStatDaysPresent.
  ///
  /// In tr, this message translates to:
  /// **'Mevcut Günler'**
  String get homeStatDaysPresent;

  /// No description provided for @homeStatTimesLate.
  ///
  /// In tr, this message translates to:
  /// **'Geç Kalma'**
  String get homeStatTimesLate;

  /// No description provided for @homeProgressLabel.
  ///
  /// In tr, this message translates to:
  /// **'{present} / {total} gün katıldın'**
  String homeProgressLabel(int present, int total);

  /// No description provided for @homeQuoteOfTheDay.
  ///
  /// In tr, this message translates to:
  /// **'💫 Günün Sözü'**
  String get homeQuoteOfTheDay;

  /// No description provided for @homeQuote1.
  ///
  /// In tr, this message translates to:
  /// **'Başarı, hazırlık ile fırsatın buluştuğu andır.'**
  String get homeQuote1;

  /// No description provided for @homeQuote2.
  ///
  /// In tr, this message translates to:
  /// **'Her yeni gün, yeni bir başlangıçtır.'**
  String get homeQuote2;

  /// No description provided for @homeQuote3.
  ///
  /// In tr, this message translates to:
  /// **'Disiplin, özgürlüğün köprüsüdür.'**
  String get homeQuote3;

  /// No description provided for @homeQuote4.
  ///
  /// In tr, this message translates to:
  /// **'Küçük adımlar büyük değişimler yaratır.'**
  String get homeQuote4;

  /// No description provided for @homeQuote5.
  ///
  /// In tr, this message translates to:
  /// **'Bugün dün düşündüğünüz yarındır.'**
  String get homeQuote5;

  /// No description provided for @homeQuote6.
  ///
  /// In tr, this message translates to:
  /// **'Zaman en değerli hazinedir, onu akıllıca kullan.'**
  String get homeQuote6;

  /// No description provided for @homeQuote7.
  ///
  /// In tr, this message translates to:
  /// **'İyi alışkanlıklar, başarının anahtarıdır.'**
  String get homeQuote7;

  /// No description provided for @homeQuote8.
  ///
  /// In tr, this message translates to:
  /// **'Her gün kendini geliştirme fırsatıdır.'**
  String get homeQuote8;

  /// No description provided for @profileTitle.
  ///
  /// In tr, this message translates to:
  /// **'Profil'**
  String get profileTitle;

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

  /// No description provided for @profileSecurity.
  ///
  /// In tr, this message translates to:
  /// **'Güvenlik'**
  String get profileSecurity;

  /// No description provided for @profileSecuritySubtitle.
  ///
  /// In tr, this message translates to:
  /// **'Şifre değiştirme ve kurtarma'**
  String get profileSecuritySubtitle;

  /// No description provided for @profileTheme.
  ///
  /// In tr, this message translates to:
  /// **'Tema'**
  String get profileTheme;

  /// No description provided for @profileThemeDark.
  ///
  /// In tr, this message translates to:
  /// **'Koyu tema aktif'**
  String get profileThemeDark;

  /// No description provided for @profileThemeLight.
  ///
  /// In tr, this message translates to:
  /// **'Açık tema aktif'**
  String get profileThemeLight;

  /// No description provided for @profileThemeSystem.
  ///
  /// In tr, this message translates to:
  /// **'Sistem ayarına göre'**
  String get profileThemeSystem;

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
  /// **'Hızlı Erişim Kapısı'**
  String get profilePreferredDoor;

  /// No description provided for @profilePreferredDoorEmpty.
  ///
  /// In tr, this message translates to:
  /// **'Seçilmedi'**
  String get profilePreferredDoorEmpty;

  /// No description provided for @homeQuickActions.
  ///
  /// In tr, this message translates to:
  /// **'Hızlı İşlemler'**
  String get homeQuickActions;

  /// No description provided for @quickActionUnlock.
  ///
  /// In tr, this message translates to:
  /// **'Kapıyı Aç'**
  String get quickActionUnlock;

  /// No description provided for @quickActionVisitor.
  ///
  /// In tr, this message translates to:
  /// **'Ziyaretçi'**
  String get quickActionVisitor;

  /// No description provided for @quickActionHistory.
  ///
  /// In tr, this message translates to:
  /// **'Geçmiş'**
  String get quickActionHistory;

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

  /// No description provided for @unlockGranted.
  ///
  /// In tr, this message translates to:
  /// **'Erişim Verildi'**
  String get unlockGranted;

  /// No description provided for @unlockDenied.
  ///
  /// In tr, this message translates to:
  /// **'Erişim Reddedildi'**
  String get unlockDenied;

  /// No description provided for @selectDeviceTitle.
  ///
  /// In tr, this message translates to:
  /// **'Kapı Seç'**
  String get selectDeviceTitle;

  /// No description provided for @selectDeviceSearch.
  ///
  /// In tr, this message translates to:
  /// **'Ara...'**
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

  /// No description provided for @profileAppVersion.
  ///
  /// In tr, this message translates to:
  /// **'Sürüm'**
  String get profileAppVersion;

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

  /// No description provided for @profileLogoutSubtitle.
  ///
  /// In tr, this message translates to:
  /// **'Hesabınızdan çıkış yapın'**
  String get profileLogoutSubtitle;

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

  /// No description provided for @profileSettings.
  ///
  /// In tr, this message translates to:
  /// **'Ayarlar'**
  String get profileSettings;

  /// No description provided for @profileSettingsBody.
  ///
  /// In tr, this message translates to:
  /// **'Tema, dil ve hızlı erişim hedefinizi Profil ekranından ayarlayabilirsiniz.'**
  String get profileSettingsBody;

  /// No description provided for @profileNotificationsDialogTitle.
  ///
  /// In tr, this message translates to:
  /// **'Bildirim Ayarları'**
  String get profileNotificationsDialogTitle;

  /// No description provided for @profileNotificationsDialogBody.
  ///
  /// In tr, this message translates to:
  /// **'Bu sürümde anlık bildirim teslimi ve bildirim tercihi yönetimi bulunmuyor. Güncel erişim ve hareket bilgilerinizi uygulamayı açarak yenileyebilirsiniz. Eksik veya hatalı kayıtlar için kurumunuzun yöneticisine başvurun.'**
  String get profileNotificationsDialogBody;

  /// No description provided for @profileSecurityDialogTitle.
  ///
  /// In tr, this message translates to:
  /// **'Güvenlik Ayarları'**
  String get profileSecurityDialogTitle;

  /// No description provided for @profileSecurityDialogBody.
  ///
  /// In tr, this message translates to:
  /// **'Mevcut şifrenizi biliyorsanız aşağıdaki formdan yeni bir şifre belirleyebilirsiniz. Şifre değişikliği tüm mobil oturumları sonlandırır. Şifrenizi unuttuysanız kurum yöneticinizden yeni kurulum bağlantısı isteyin. Ortak bir cihazdan ayrılmadan önce Çıkış Yap seçeneğini kullanın.'**
  String get profileSecurityDialogBody;

  /// No description provided for @profileThemeDialogTitle.
  ///
  /// In tr, this message translates to:
  /// **'Tema Ayarları'**
  String get profileThemeDialogTitle;

  /// No description provided for @profileThemeDialogBody.
  ///
  /// In tr, this message translates to:
  /// **'Açık, koyu veya sistem temasını seçin.'**
  String get profileThemeDialogBody;

  /// No description provided for @profileLanguageDialogTitle.
  ///
  /// In tr, this message translates to:
  /// **'Dil Ayarları'**
  String get profileLanguageDialogTitle;

  /// No description provided for @profileLanguageDialogBody.
  ///
  /// In tr, this message translates to:
  /// **'Dil tercihi bu cihazda saklanır ve çıkıştan sonra korunur.'**
  String get profileLanguageDialogBody;

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

  /// No description provided for @profileAboutLine2.
  ///
  /// In tr, this message translates to:
  /// **'Kurulu uygulama sürümü'**
  String get profileAboutLine2;

  /// No description provided for @profileAboutLine3.
  ///
  /// In tr, this message translates to:
  /// **'Destek için kurum yöneticinize başvurun.'**
  String get profileAboutLine3;

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
  /// **'Tümü'**
  String get historyTabAll;

  /// No description provided for @historyTabThisMonth.
  ///
  /// In tr, this message translates to:
  /// **'Bu Ay'**
  String get historyTabThisMonth;

  /// No description provided for @historyTabStats.
  ///
  /// In tr, this message translates to:
  /// **'İstatistik'**
  String get historyTabStats;

  /// No description provided for @historyLoading.
  ///
  /// In tr, this message translates to:
  /// **'Veriler yükleniyor...'**
  String get historyLoading;

  /// No description provided for @historyErrorTitle.
  ///
  /// In tr, this message translates to:
  /// **'Bir Hata Oluştu'**
  String get historyErrorTitle;

  /// No description provided for @historyErrorBody.
  ///
  /// In tr, this message translates to:
  /// **'Veriler yüklenirken hata oluştu: {error}'**
  String historyErrorBody(String error);

  /// No description provided for @historyEmpty.
  ///
  /// In tr, this message translates to:
  /// **'Kayıt bulunamadı'**
  String get historyEmpty;

  /// No description provided for @historyEmptyHint.
  ///
  /// In tr, this message translates to:
  /// **'Verileri yenilemek için aşağı çekin'**
  String get historyEmptyHint;

  /// No description provided for @historyColorLegend.
  ///
  /// In tr, this message translates to:
  /// **'Renk Açıklamaları'**
  String get historyColorLegend;

  /// No description provided for @historyLegendEarly.
  ///
  /// In tr, this message translates to:
  /// **'Erken Giriş'**
  String get historyLegendEarly;

  /// No description provided for @historyLegendEarlyDesc.
  ///
  /// In tr, this message translates to:
  /// **'Saat 09:00\'dan önce giriş yapılan günler'**
  String get historyLegendEarlyDesc;

  /// No description provided for @historyLegendNormal.
  ///
  /// In tr, this message translates to:
  /// **'Normal Giriş'**
  String get historyLegendNormal;

  /// No description provided for @historyLegendNormalDesc.
  ///
  /// In tr, this message translates to:
  /// **'Saat 09:00-09:30 arası giriş yapılan günler'**
  String get historyLegendNormalDesc;

  /// No description provided for @historyLegendLate.
  ///
  /// In tr, this message translates to:
  /// **'Geç Giriş'**
  String get historyLegendLate;

  /// No description provided for @historyLegendLateDesc.
  ///
  /// In tr, this message translates to:
  /// **'Saat 09:30\'dan sonra giriş yapılan günler'**
  String get historyLegendLateDesc;

  /// No description provided for @historyLegendNone.
  ///
  /// In tr, this message translates to:
  /// **'Katılım Yok'**
  String get historyLegendNone;

  /// No description provided for @historyLegendNoneDesc.
  ///
  /// In tr, this message translates to:
  /// **'Hiç giriş-çıkış kaydı bulunmayan günler'**
  String get historyLegendNoneDesc;

  /// No description provided for @historyCalendarHint.
  ///
  /// In tr, this message translates to:
  /// **'Günlere tıklayarak detayları görebilirsiniz. Yeşil noktalar ek katılım kayıtlarını gösterir.'**
  String get historyCalendarHint;

  /// No description provided for @historyMonthSummary.
  ///
  /// In tr, this message translates to:
  /// **'Bu Ay Özeti'**
  String get historyMonthSummary;

  /// No description provided for @historyTotalCheckIns.
  ///
  /// In tr, this message translates to:
  /// **'Toplam Giriş'**
  String get historyTotalCheckIns;

  /// No description provided for @historyTotalCheckOuts.
  ///
  /// In tr, this message translates to:
  /// **'Toplam Çıkış'**
  String get historyTotalCheckOuts;

  /// No description provided for @historyActiveDays.
  ///
  /// In tr, this message translates to:
  /// **'Aktif Gün'**
  String get historyActiveDays;

  /// No description provided for @historyGeneralStats.
  ///
  /// In tr, this message translates to:
  /// **'Genel İstatistikler'**
  String get historyGeneralStats;

  /// No description provided for @historyThisWeek.
  ///
  /// In tr, this message translates to:
  /// **'Bu Hafta'**
  String get historyThisWeek;

  /// No description provided for @historyWeeklySummary.
  ///
  /// In tr, this message translates to:
  /// **'Haftalık Özet'**
  String get historyWeeklySummary;

  /// Localized record count; English singular/plural, Turkish number followed by noun.
  ///
  /// In tr, this message translates to:
  /// **'Bu hafta toplam {count} kayıt'**
  String historyWeeklyTotalRecords(int count);

  /// No description provided for @historyWeeklyCheckIn.
  ///
  /// In tr, this message translates to:
  /// **'Giriş: {count}'**
  String historyWeeklyCheckIn(int count);

  /// No description provided for @historyWeeklyCheckOut.
  ///
  /// In tr, this message translates to:
  /// **'Çıkış: {count}'**
  String historyWeeklyCheckOut(int count);

  /// No description provided for @historyDeviceStats.
  ///
  /// In tr, this message translates to:
  /// **'Cihaz Bazlı İstatistikler'**
  String get historyDeviceStats;

  /// No description provided for @historyCheckInRecord.
  ///
  /// In tr, this message translates to:
  /// **'Giriş Yapıldı'**
  String get historyCheckInRecord;

  /// No description provided for @historyCheckOutRecord.
  ///
  /// In tr, this message translates to:
  /// **'Çıkış Yapıldı'**
  String get historyCheckOutRecord;

  /// No description provided for @historyBadgeIn.
  ///
  /// In tr, this message translates to:
  /// **'GİRİŞ'**
  String get historyBadgeIn;

  /// No description provided for @historyBadgeOut.
  ///
  /// In tr, this message translates to:
  /// **'ÇIKIŞ'**
  String get historyBadgeOut;

  /// No description provided for @historyUnknownDevice.
  ///
  /// In tr, this message translates to:
  /// **'Bilinmeyen Cihaz'**
  String get historyUnknownDevice;

  /// No description provided for @historyUnknownLocation.
  ///
  /// In tr, this message translates to:
  /// **'Bilinmeyen Konum'**
  String get historyUnknownLocation;

  /// No description provided for @historyDetailCheckIn.
  ///
  /// In tr, this message translates to:
  /// **'Giriş Detayları'**
  String get historyDetailCheckIn;

  /// No description provided for @historyDetailCheckOut.
  ///
  /// In tr, this message translates to:
  /// **'Çıkış Detayları'**
  String get historyDetailCheckOut;

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

  /// No description provided for @historyDetailQrCode.
  ///
  /// In tr, this message translates to:
  /// **'QR Kod'**
  String get historyDetailQrCode;

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

  /// No description provided for @historyFilterDateNone.
  ///
  /// In tr, this message translates to:
  /// **'Tarih seçilmedi'**
  String get historyFilterDateNone;

  /// No description provided for @historyFilterDevice.
  ///
  /// In tr, this message translates to:
  /// **'Cihaz'**
  String get historyFilterDevice;

  /// No description provided for @historyFilterDeviceNone.
  ///
  /// In tr, this message translates to:
  /// **'Cihaz seçilmedi'**
  String get historyFilterDeviceNone;

  /// No description provided for @historyFilterClear.
  ///
  /// In tr, this message translates to:
  /// **'Filtreleri Temizle'**
  String get historyFilterClear;

  /// No description provided for @historyFilterDeviceSelectTitle.
  ///
  /// In tr, this message translates to:
  /// **'Cihaz Seç'**
  String get historyFilterDeviceSelectTitle;

  /// Localized record count; English singular/plural, Turkish number followed by noun.
  ///
  /// In tr, this message translates to:
  /// **'{count} Kayıt'**
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

  /// No description provided for @qrInvalidResponse.
  ///
  /// In tr, this message translates to:
  /// **'Geçersiz yanıt'**
  String get qrInvalidResponse;

  /// No description provided for @qrTokenMissing.
  ///
  /// In tr, this message translates to:
  /// **'Token yok'**
  String get qrTokenMissing;

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
  /// **'QR kodu kare içine yerleştirin'**
  String get qrFrameHint;

  /// No description provided for @qrTokenHint.
  ///
  /// In tr, this message translates to:
  /// **'Bu QR kodu kapı cihazına okutun. Kod 10 saniye geçerlidir, süre dolunca yenile butonuna basın.'**
  String get qrTokenHint;

  /// No description provided for @qrProcessError.
  ///
  /// In tr, this message translates to:
  /// **'QR kod işlenirken bir hata oluştu: {error}'**
  String qrProcessError(String error);

  /// No description provided for @qrUserCodeTitle.
  ///
  /// In tr, this message translates to:
  /// **'Kullanıcı QR Kodu'**
  String get qrUserCodeTitle;

  /// No description provided for @qrUserCodeBody.
  ///
  /// In tr, this message translates to:
  /// **'Kullanıcı: {name}\nE-posta: {email}\nTarih: {date}'**
  String qrUserCodeBody(String name, String email, String date);

  /// No description provided for @qrInvalidCode.
  ///
  /// In tr, this message translates to:
  /// **'Geçersiz QR kod'**
  String get qrInvalidCode;

  /// No description provided for @qrAccessGranted.
  ///
  /// In tr, this message translates to:
  /// **'Geçiş Başarılı'**
  String get qrAccessGranted;

  /// No description provided for @qrUnknownError.
  ///
  /// In tr, this message translates to:
  /// **'Bir hata oluştu'**
  String get qrUnknownError;

  /// No description provided for @qrDeviceLine.
  ///
  /// In tr, this message translates to:
  /// **'Cihaz: {name}'**
  String qrDeviceLine(String name);

  /// No description provided for @qrLocationLine.
  ///
  /// In tr, this message translates to:
  /// **'Konum: {location}'**
  String qrLocationLine(String location);

  /// No description provided for @qrTimeLine.
  ///
  /// In tr, this message translates to:
  /// **'Zaman: {time}'**
  String qrTimeLine(String time);

  /// No description provided for @visitorTitle.
  ///
  /// In tr, this message translates to:
  /// **'Ziyaretçi Yönetimi'**
  String get visitorTitle;

  /// No description provided for @visitorStatTotal.
  ///
  /// In tr, this message translates to:
  /// **'Toplam'**
  String get visitorStatTotal;

  /// No description provided for @visitorStatInside.
  ///
  /// In tr, this message translates to:
  /// **'İçeride'**
  String get visitorStatInside;

  /// No description provided for @visitorStatExpected.
  ///
  /// In tr, this message translates to:
  /// **'Beklenen'**
  String get visitorStatExpected;

  /// No description provided for @visitorEmpty.
  ///
  /// In tr, this message translates to:
  /// **'Henüz ziyaretçi kaydı yok'**
  String get visitorEmpty;

  /// No description provided for @visitorEmptyHint.
  ///
  /// In tr, this message translates to:
  /// **'Yeni ziyaretçi eklemek için + butonuna tıklayın'**
  String get visitorEmptyHint;

  /// No description provided for @visitorStatusExpected.
  ///
  /// In tr, this message translates to:
  /// **'Bekleniyor'**
  String get visitorStatusExpected;

  /// No description provided for @visitorStatusInside.
  ///
  /// In tr, this message translates to:
  /// **'İçeride'**
  String get visitorStatusInside;

  /// No description provided for @visitorStatusOut.
  ///
  /// In tr, this message translates to:
  /// **'Çıktı'**
  String get visitorStatusOut;

  /// No description provided for @visitorContactPerson.
  ///
  /// In tr, this message translates to:
  /// **'İletişim: {name}'**
  String visitorContactPerson(String name);

  /// No description provided for @visitorCheckOut.
  ///
  /// In tr, this message translates to:
  /// **'Çıkış Yap'**
  String get visitorCheckOut;

  /// No description provided for @visitorCheckIn.
  ///
  /// In tr, this message translates to:
  /// **'Giriş Yap'**
  String get visitorCheckIn;

  /// No description provided for @visitorCheckedInToast.
  ///
  /// In tr, this message translates to:
  /// **'{name} giriş yaptı'**
  String visitorCheckedInToast(String name);

  /// No description provided for @visitorCheckedOutToast.
  ///
  /// In tr, this message translates to:
  /// **'{name} çıkış yaptı'**
  String visitorCheckedOutToast(String name);

  /// No description provided for @visitorFilterTitle.
  ///
  /// In tr, this message translates to:
  /// **'Filtrele'**
  String get visitorFilterTitle;

  /// No description provided for @visitorFilterBody.
  ///
  /// In tr, this message translates to:
  /// **'Filtreleme seçenekleri buraya gelecek.'**
  String get visitorFilterBody;

  /// No description provided for @visitorAddTitle.
  ///
  /// In tr, this message translates to:
  /// **'Yeni Ziyaretçi'**
  String get visitorAddTitle;

  /// No description provided for @visitorFieldName.
  ///
  /// In tr, this message translates to:
  /// **'Ad Soyad'**
  String get visitorFieldName;

  /// No description provided for @visitorFieldCompany.
  ///
  /// In tr, this message translates to:
  /// **'Şirket'**
  String get visitorFieldCompany;

  /// No description provided for @visitorFieldPurpose.
  ///
  /// In tr, this message translates to:
  /// **'Ziyaret Amacı'**
  String get visitorFieldPurpose;

  /// No description provided for @visitorFieldContact.
  ///
  /// In tr, this message translates to:
  /// **'İletişim Kişisi'**
  String get visitorFieldContact;

  /// No description provided for @visitorAddedToast.
  ///
  /// In tr, this message translates to:
  /// **'Ziyaretçi eklendi'**
  String get visitorAddedToast;

  /// No description provided for @visitorAddButton.
  ///
  /// In tr, this message translates to:
  /// **'Ziyaretçi Ekle'**
  String get visitorAddButton;

  /// No description provided for @errorNetwork.
  ///
  /// In tr, this message translates to:
  /// **'İnternet bağlantısı kurulamadı. Lütfen bağlantınızı kontrol edin.'**
  String get errorNetwork;

  /// No description provided for @errorTimeout.
  ///
  /// In tr, this message translates to:
  /// **'Sunucu yanıt vermedi. Lütfen daha sonra tekrar deneyin.'**
  String get errorTimeout;

  /// No description provided for @errorServer.
  ///
  /// In tr, this message translates to:
  /// **'Sunucu hatası ({code}). Lütfen biraz sonra tekrar deneyin.'**
  String errorServer(int code);

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

  /// No description provided for @historyAccessDenied.
  ///
  /// In tr, this message translates to:
  /// **'Erişim reddedildi'**
  String get historyAccessDenied;

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
  /// **'Ham erişim hareketleri; resmi PDKS sonucu değildir.'**
  String get historyRawEvents;

  /// No description provided for @homeDataLoading.
  ///
  /// In tr, this message translates to:
  /// **'Veriler yükleniyor'**
  String get homeDataLoading;

  /// No description provided for @homeDataUnavailable.
  ///
  /// In tr, this message translates to:
  /// **'Veriler alınamadı'**
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

  /// No description provided for @homeSelfCheckIn.
  ///
  /// In tr, this message translates to:
  /// **'Manuel kayıt'**
  String get homeSelfCheckIn;

  /// No description provided for @homeSelfCheckInRecorded.
  ///
  /// In tr, this message translates to:
  /// **'Manuel kayıt oluşturuldu'**
  String get homeSelfCheckInRecorded;

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
  /// **'Bu kodu desteklenen okuyucuya gösterin. Süre sunucunun bitiş zamanına göre gösterilir. İşlem kaydı kapının açıldığını veya fiziksel geçişi doğrulamaz.'**
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

  /// No description provided for @qrCameraControlUnavailable.
  ///
  /// In tr, this message translates to:
  /// **'Kamera kontrolü kullanılamıyor.'**
  String get qrCameraControlUnavailable;

  /// No description provided for @qrDeviceIdentityOnly.
  ///
  /// In tr, this message translates to:
  /// **'Bu bir cihaz kimlik etiketidir; geçiş yetkisi veya fiziksel bulunma kanıtı sağlamaz. Desteklenen okuyucuda QR’ım sekmesini kullanın.'**
  String get qrDeviceIdentityOnly;

  /// No description provided for @qrEmployeeIdentityOnly.
  ///
  /// In tr, this message translates to:
  /// **'Bu bir çalışan kimlik kodudur. Kimlik doğrulaması veya geçiş kaydı oluşturmaz.'**
  String get qrEmployeeIdentityOnly;

  /// No description provided for @qrChallengeUnsupported.
  ///
  /// In tr, this message translates to:
  /// **'Bu okuyucunun güvenli işlem akışı henüz desteklenmiyor. Desteklenen okuyucuda QR’ım sekmesini kullanın.'**
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
  /// **'Mobil şifre kurulumunu kurum yöneticiniz yönetir. Kayıtlı e-posta adresinize yeni bir kurulum bağlantısı göndermesini isteyin. Bağlantıyı açıp yeni şifrenizi belirledikten sonra giriş ekranına dönün.'**
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
  /// **'Yöneticiye iletilecek talebi kopyala'**
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
  /// **'Son güncelleme: {time}'**
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
  /// **'Kaydet'**
  String get visitorSave;

  /// No description provided for @visitorEdit.
  ///
  /// In tr, this message translates to:
  /// **'Düzenle'**
  String get visitorEdit;

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

  /// No description provided for @visitorPreRegistered.
  ///
  /// In tr, this message translates to:
  /// **'Yetkili aktivasyonu bekleniyor'**
  String get visitorPreRegistered;

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
  /// **'Davet kaydı kaydedildi; yetkili aktivasyonu gerekiyor.'**
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

  /// No description provided for @visitorInvalidForm.
  ///
  /// In tr, this message translates to:
  /// **'Zorunlu alanları ve ziyaret tarihlerini kontrol edin.'**
  String get visitorInvalidForm;

  /// No description provided for @visitorStale.
  ///
  /// In tr, this message translates to:
  /// **'Yenilenemedi; önceki kayıtlar gösteriliyor.'**
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
  /// **'Geçerli bir sunucu yanıtı alınamadı. Lütfen yeniden deneyin.'**
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
  /// **'Seçilen kapı artık kullanılamıyor. Profil üzerinden yeni bir kapı seçin.'**
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
  /// **'Davetleriniz, tüm sayfalar'**
  String get visitorSummaryTitle;

  /// No description provided for @visitorSummaryLimited.
  ///
  /// In tr, this message translates to:
  /// **'Bu toplamlar alt sınırdır; özet okuma sınırına ulaşıldı.'**
  String get visitorSummaryLimited;

  /// No description provided for @visitorSummaryError.
  ///
  /// In tr, this message translates to:
  /// **'Özet yenilenemedi.'**
  String get visitorSummaryError;

  /// No description provided for @visitorSyncTitle.
  ///
  /// In tr, this message translates to:
  /// **'Cihaz senkronizasyonu'**
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

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

  /// No description provided for @homeExtraMovements.
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
  /// **'Profili Düzenle'**
  String get profileEditButton;

  /// No description provided for @profileEditDialogBody.
  ///
  /// In tr, this message translates to:
  /// **'Profil düzenleme özelliği yakında eklenecek.'**
  String get profileEditDialogBody;

  /// No description provided for @profileNotifications.
  ///
  /// In tr, this message translates to:
  /// **'Bildirimler'**
  String get profileNotifications;

  /// No description provided for @profileNotificationsSubtitle.
  ///
  /// In tr, this message translates to:
  /// **'Bildirim ayarlarını yönet'**
  String get profileNotificationsSubtitle;

  /// No description provided for @profileSecurity.
  ///
  /// In tr, this message translates to:
  /// **'Güvenlik'**
  String get profileSecurity;

  /// No description provided for @profileSecuritySubtitle.
  ///
  /// In tr, this message translates to:
  /// **'Şifre ve güvenlik ayarları'**
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
  /// **'Versiyon 1.0.0'**
  String get profileAppVersion;

  /// No description provided for @profilePrivacy.
  ///
  /// In tr, this message translates to:
  /// **'Gizlilik Politikası'**
  String get profilePrivacy;

  /// No description provided for @profilePrivacySubtitle.
  ///
  /// In tr, this message translates to:
  /// **'Veri kullanım politikası'**
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
  /// **'Gelişmiş ayarlar yakında eklenecek.'**
  String get profileSettingsBody;

  /// No description provided for @profileNotificationsDialogTitle.
  ///
  /// In tr, this message translates to:
  /// **'Bildirim Ayarları'**
  String get profileNotificationsDialogTitle;

  /// No description provided for @profileNotificationsDialogBody.
  ///
  /// In tr, this message translates to:
  /// **'Bildirim ayarları yakında eklenecek.'**
  String get profileNotificationsDialogBody;

  /// No description provided for @profileSecurityDialogTitle.
  ///
  /// In tr, this message translates to:
  /// **'Güvenlik Ayarları'**
  String get profileSecurityDialogTitle;

  /// No description provided for @profileSecurityDialogBody.
  ///
  /// In tr, this message translates to:
  /// **'Güvenlik ayarları yakında eklenecek.'**
  String get profileSecurityDialogBody;

  /// No description provided for @profileThemeDialogTitle.
  ///
  /// In tr, this message translates to:
  /// **'Tema Ayarları'**
  String get profileThemeDialogTitle;

  /// No description provided for @profileThemeDialogBody.
  ///
  /// In tr, this message translates to:
  /// **'Tema ayarları yakında eklenecek.'**
  String get profileThemeDialogBody;

  /// No description provided for @profileLanguageDialogTitle.
  ///
  /// In tr, this message translates to:
  /// **'Dil Ayarları'**
  String get profileLanguageDialogTitle;

  /// No description provided for @profileLanguageDialogBody.
  ///
  /// In tr, this message translates to:
  /// **'Dil ayarları yakında eklenecek.'**
  String get profileLanguageDialogBody;

  /// No description provided for @profileHelpDialogTitle.
  ///
  /// In tr, this message translates to:
  /// **'Yardım & Destek'**
  String get profileHelpDialogTitle;

  /// No description provided for @profileHelpDialogBody.
  ///
  /// In tr, this message translates to:
  /// **'Yardım ve destek sayfası yakında eklenecek.'**
  String get profileHelpDialogBody;

  /// No description provided for @profilePrivacyDialogTitle.
  ///
  /// In tr, this message translates to:
  /// **'Gizlilik Politikası'**
  String get profilePrivacyDialogTitle;

  /// No description provided for @profilePrivacyDialogBody.
  ///
  /// In tr, this message translates to:
  /// **'Gizlilik politikası yakında eklenecek.'**
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
  /// **'Versiyon: 1.0.0'**
  String get profileAboutLine2;

  /// No description provided for @profileAboutLine3.
  ///
  /// In tr, this message translates to:
  /// **'Geliştirici: NGS Team'**
  String get profileAboutLine3;

  /// No description provided for @profileAboutLine4.
  ///
  /// In tr, this message translates to:
  /// **'QR kod tabanlı yoklama takip uygulaması.'**
  String get profileAboutLine4;

  /// No description provided for @profileFallbackEmail.
  ///
  /// In tr, this message translates to:
  /// **'email@example.com'**
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
  /// **'Veriler yenilemek için aşağı çekin'**
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

  /// No description provided for @historyWeeklyTotalRecords.
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

  /// No description provided for @historyDayRecordCount.
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

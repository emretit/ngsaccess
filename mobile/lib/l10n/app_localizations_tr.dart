// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for Turkish (`tr`).
class AppLocalizationsTr extends AppLocalizations {
  AppLocalizationsTr([String locale = 'tr']) : super(locale);

  @override
  String get appName => 'NGS Plus';

  @override
  String get appTagline => 'Yoklama Takip Sistemi';

  @override
  String get pdksTitle => 'PDKS Sistemi';

  @override
  String get pdksSubtitle => 'Personel Devam Kontrol Sistemi';

  @override
  String get commonOk => 'Tamam';

  @override
  String get commonCancel => 'İptal';

  @override
  String get commonClose => 'Kapat';

  @override
  String get commonRetry => 'Tekrar Dene';

  @override
  String get commonError => 'Hata';

  @override
  String get commonSuccess => 'Başarılı';

  @override
  String get commonAdd => 'Ekle';

  @override
  String get comingSoon => 'Yakında eklenecek.';

  @override
  String get navHome => 'Ana Sayfa';

  @override
  String get navHistory => 'Geçmiş';

  @override
  String get navVisitor => 'Ziyaretçi';

  @override
  String get navProfile => 'Profil';

  @override
  String get loginTitle => 'Giriş Yap';

  @override
  String get loginPrompt =>
      'PDKS sistemine giriş yapmak için bilgilerinizi giriniz';

  @override
  String get loginEmailLabel => 'E-posta';

  @override
  String get loginPasswordLabel => 'Şifre';

  @override
  String get loginEmailRequired => 'E-posta adresinizi girin';

  @override
  String get loginEmailInvalid => 'Geçerli bir e-posta adresi girin';

  @override
  String get loginPasswordRequired => 'Şifrenizi girin';

  @override
  String get loginPasswordTooShort => 'Şifre en az 6 karakter olmalı';

  @override
  String get loginRememberMe => 'Beni Hatırla';

  @override
  String get loginForgotPassword => 'Şifremi unuttum';

  @override
  String get forgotPasswordTitle => 'Şifre Sıfırla';

  @override
  String get forgotPasswordHeadline => 'Şifrenizi mi unuttunuz?';

  @override
  String get forgotPasswordPrompt =>
      'E-posta adresinizi girin, size şifre sıfırlama bağlantısı gönderelim.';

  @override
  String get forgotPasswordSendButton => 'Sıfırlama Bağlantısı Gönder';

  @override
  String get forgotPasswordBackToLogin => 'Giriş sayfasına dön';

  @override
  String get forgotPasswordSuccessTitle => 'E-posta Gönderildi!';

  @override
  String forgotPasswordSuccessBody(String email) {
    return '$email adresine şifre sıfırlama bağlantısı gönderildi. E-postanızı kontrol edin.';
  }

  @override
  String get forgotPasswordSuccessButton => 'Giriş Sayfasına Dön';

  @override
  String get homeGreetingMorning => 'Günaydın';

  @override
  String get homeGreetingDay => 'İyi günler';

  @override
  String get homeGreetingEvening => 'İyi akşamlar';

  @override
  String get homeGreetingFallback => 'Kullanıcı';

  @override
  String homeGreetingLine(String greeting, String name) {
    return '$greeting, $name!';
  }

  @override
  String get homeAttendanceStatus => 'Yoklama Durumu';

  @override
  String get homeScanCheckIn => 'QR Kod Tara - Giriş Yap';

  @override
  String get homeScanCheckOut => 'QR Kod Tara - Çıkış Yap';

  @override
  String get homeStatusInside => 'İçeride';

  @override
  String get homeStatusOut => 'Çıktı';

  @override
  String get homeStatusNone => 'Henüz Yok';

  @override
  String get homeAttendanceEntryRow => 'Son Giriş';

  @override
  String get homeAttendanceExitRow => 'Son Çıkış';

  @override
  String homeExtraMovements(int count) {
    return '+$count hareket';
  }

  @override
  String get homeScanCheckInAgain => 'QR Kod Tara - Tekrar Giriş';

  @override
  String get homeAttendanceTimeEmpty => '—';

  @override
  String get homeMonthSummary => 'Bu Ayki Özet';

  @override
  String get homeStatTotalDays => 'Toplam Gün';

  @override
  String get homeStatDaysPresent => 'Mevcut Günler';

  @override
  String get homeStatTimesLate => 'Geç Kalma';

  @override
  String homeProgressLabel(int present, int total) {
    return '$present / $total gün katıldın';
  }

  @override
  String get homeQuoteOfTheDay => '💫 Günün Sözü';

  @override
  String get homeQuote1 => 'Başarı, hazırlık ile fırsatın buluştuğu andır.';

  @override
  String get homeQuote2 => 'Her yeni gün, yeni bir başlangıçtır.';

  @override
  String get homeQuote3 => 'Disiplin, özgürlüğün köprüsüdür.';

  @override
  String get homeQuote4 => 'Küçük adımlar büyük değişimler yaratır.';

  @override
  String get homeQuote5 => 'Bugün dün düşündüğünüz yarındır.';

  @override
  String get homeQuote6 => 'Zaman en değerli hazinedir, onu akıllıca kullan.';

  @override
  String get homeQuote7 => 'İyi alışkanlıklar, başarının anahtarıdır.';

  @override
  String get homeQuote8 => 'Her gün kendini geliştirme fırsatıdır.';

  @override
  String get profileTitle => 'Profil';

  @override
  String get profileEditButton => 'Profili Düzenle';

  @override
  String get profileEditDialogBody =>
      'Profil düzenleme özelliği yakında eklenecek.';

  @override
  String get profileNotifications => 'Bildirimler';

  @override
  String get profileNotificationsSubtitle => 'Bildirim ayarlarını yönet';

  @override
  String get profileSecurity => 'Güvenlik';

  @override
  String get profileSecuritySubtitle => 'Şifre ve güvenlik ayarları';

  @override
  String get profileTheme => 'Tema';

  @override
  String get profileThemeDark => 'Koyu tema aktif';

  @override
  String get profileThemeLight => 'Açık tema aktif';

  @override
  String get profileThemeSystem => 'Sistem ayarına göre';

  @override
  String get profileThemeModeLight => 'Açık tema';

  @override
  String get profileThemeModeDark => 'Koyu tema';

  @override
  String get profileThemeModeSystem => 'Sistem ayarına göre';

  @override
  String get profileLanguage => 'Dil';

  @override
  String get profileLanguageValueTr => 'Türkçe';

  @override
  String get profileLanguageValueEn => 'İngilizce';

  @override
  String get profilePreferredDoor => 'Hızlı Erişim Kapısı';

  @override
  String get profilePreferredDoorEmpty => 'Seçilmedi';

  @override
  String get homeQuickActions => 'Hızlı İşlemler';

  @override
  String get quickActionUnlock => 'Kapıyı Aç';

  @override
  String get quickActionVisitor => 'Ziyaretçi';

  @override
  String get quickActionHistory => 'Geçmiş';

  @override
  String get quickActionProfile => 'Profil';

  @override
  String get unlockNoDeviceSelected =>
      'Önce Profil\'den hızlı erişim kapısını seç';

  @override
  String get unlockGranted => 'Erişim Verildi';

  @override
  String get unlockDenied => 'Erişim Reddedildi';

  @override
  String get selectDeviceTitle => 'Kapı Seç';

  @override
  String get selectDeviceSearch => 'Ara...';

  @override
  String get selectDeviceEmpty => 'Henüz erişiminiz olan kapı yok';

  @override
  String get selectDeviceNoMatch => 'Eşleşen kapı bulunamadı';

  @override
  String get profileHelp => 'Yardım & Destek';

  @override
  String get profileHelpSubtitle => 'SSS ve destek';

  @override
  String get profileAboutApp => 'Uygulama Hakkında';

  @override
  String get profileAppVersion => 'Versiyon 1.0.0';

  @override
  String get profilePrivacy => 'Gizlilik Politikası';

  @override
  String get profilePrivacySubtitle => 'Veri kullanım politikası';

  @override
  String get profileLogout => 'Çıkış Yap';

  @override
  String get profileLogoutSubtitle => 'Hesabınızdan çıkış yapın';

  @override
  String get profileLogoutConfirmTitle => 'Çıkış Yap';

  @override
  String get profileLogoutConfirmBody =>
      'Hesabınızdan çıkış yapmak istediğinizden emin misiniz?';

  @override
  String get profileSettings => 'Ayarlar';

  @override
  String get profileSettingsBody => 'Gelişmiş ayarlar yakında eklenecek.';

  @override
  String get profileNotificationsDialogTitle => 'Bildirim Ayarları';

  @override
  String get profileNotificationsDialogBody =>
      'Bildirim ayarları yakında eklenecek.';

  @override
  String get profileSecurityDialogTitle => 'Güvenlik Ayarları';

  @override
  String get profileSecurityDialogBody =>
      'Güvenlik ayarları yakında eklenecek.';

  @override
  String get profileThemeDialogTitle => 'Tema Ayarları';

  @override
  String get profileThemeDialogBody => 'Tema ayarları yakında eklenecek.';

  @override
  String get profileLanguageDialogTitle => 'Dil Ayarları';

  @override
  String get profileLanguageDialogBody => 'Dil ayarları yakında eklenecek.';

  @override
  String get profileHelpDialogTitle => 'Yardım & Destek';

  @override
  String get profileHelpDialogBody =>
      'Yardım ve destek sayfası yakında eklenecek.';

  @override
  String get profilePrivacyDialogTitle => 'Gizlilik Politikası';

  @override
  String get profilePrivacyDialogBody =>
      'Gizlilik politikası yakında eklenecek.';

  @override
  String get profileAboutDialogTitle => 'NGS Plus Hakkında';

  @override
  String get profileAboutLine1 => 'NGS Plus Yoklama Takip Sistemi';

  @override
  String get profileAboutLine2 => 'Versiyon: 1.0.0';

  @override
  String get profileAboutLine3 => 'Geliştirici: NGS Team';

  @override
  String get profileAboutLine4 => 'QR kod tabanlı yoklama takip uygulaması.';

  @override
  String get profileFallbackEmail => 'email@example.com';

  @override
  String get historyTitle => 'Geçmiş';

  @override
  String get historyTabAll => 'Tümü';

  @override
  String get historyTabThisMonth => 'Bu Ay';

  @override
  String get historyTabStats => 'İstatistik';

  @override
  String get historyLoading => 'Veriler yükleniyor...';

  @override
  String get historyErrorTitle => 'Bir Hata Oluştu';

  @override
  String historyErrorBody(String error) {
    return 'Veriler yüklenirken hata oluştu: $error';
  }

  @override
  String get historyEmpty => 'Kayıt bulunamadı';

  @override
  String get historyEmptyHint => 'Veriler yenilemek için aşağı çekin';

  @override
  String get historyColorLegend => 'Renk Açıklamaları';

  @override
  String get historyLegendEarly => 'Erken Giriş';

  @override
  String get historyLegendEarlyDesc =>
      'Saat 09:00\'dan önce giriş yapılan günler';

  @override
  String get historyLegendNormal => 'Normal Giriş';

  @override
  String get historyLegendNormalDesc =>
      'Saat 09:00-09:30 arası giriş yapılan günler';

  @override
  String get historyLegendLate => 'Geç Giriş';

  @override
  String get historyLegendLateDesc =>
      'Saat 09:30\'dan sonra giriş yapılan günler';

  @override
  String get historyLegendNone => 'Katılım Yok';

  @override
  String get historyLegendNoneDesc => 'Hiç giriş-çıkış kaydı bulunmayan günler';

  @override
  String get historyCalendarHint =>
      'Günlere tıklayarak detayları görebilirsiniz. Yeşil noktalar ek katılım kayıtlarını gösterir.';

  @override
  String get historyMonthSummary => 'Bu Ay Özeti';

  @override
  String get historyTotalCheckIns => 'Toplam Giriş';

  @override
  String get historyTotalCheckOuts => 'Toplam Çıkış';

  @override
  String get historyActiveDays => 'Aktif Gün';

  @override
  String get historyGeneralStats => 'Genel İstatistikler';

  @override
  String get historyThisWeek => 'Bu Hafta';

  @override
  String get historyWeeklySummary => 'Haftalık Özet';

  @override
  String historyWeeklyTotalRecords(int count) {
    return 'Bu hafta toplam $count kayıt';
  }

  @override
  String historyWeeklyCheckIn(int count) {
    return 'Giriş: $count';
  }

  @override
  String historyWeeklyCheckOut(int count) {
    return 'Çıkış: $count';
  }

  @override
  String get historyDeviceStats => 'Cihaz Bazlı İstatistikler';

  @override
  String get historyCheckInRecord => 'Giriş Yapıldı';

  @override
  String get historyCheckOutRecord => 'Çıkış Yapıldı';

  @override
  String get historyBadgeIn => 'GİRİŞ';

  @override
  String get historyBadgeOut => 'ÇIKIŞ';

  @override
  String get historyUnknownDevice => 'Bilinmeyen Cihaz';

  @override
  String get historyUnknownLocation => 'Bilinmeyen Konum';

  @override
  String get historyDetailCheckIn => 'Giriş Detayları';

  @override
  String get historyDetailCheckOut => 'Çıkış Detayları';

  @override
  String get historyDetailDate => 'Tarih';

  @override
  String get historyDetailTime => 'Saat';

  @override
  String get historyDetailLocation => 'Konum';

  @override
  String get historyDetailQrCode => 'QR Kod';

  @override
  String get historyFilterTitle => 'Filtrele';

  @override
  String get historyFilterDate => 'Tarih';

  @override
  String get historyFilterDateNone => 'Tarih seçilmedi';

  @override
  String get historyFilterDevice => 'Cihaz';

  @override
  String get historyFilterDeviceNone => 'Cihaz seçilmedi';

  @override
  String get historyFilterClear => 'Filtreleri Temizle';

  @override
  String get historyFilterDeviceSelectTitle => 'Cihaz Seç';

  @override
  String historyDayRecordCount(int count) {
    return '$count Kayıt';
  }

  @override
  String get historyEntryShort => 'Giriş';

  @override
  String get historyExitShort => 'Çıkış';

  @override
  String get qrTabTitle => 'QR İşlemleri';

  @override
  String get qrTabMyQr => 'QR Kodum';

  @override
  String get qrTabScan => 'Tara';

  @override
  String get qrInvalidResponse => 'Geçersiz yanıt';

  @override
  String get qrTokenMissing => 'Token yok';

  @override
  String get qrRefresh => 'Yenile';

  @override
  String get qrTryAgain => 'Tekrar dene';

  @override
  String get qrFrameHint => 'QR kodu kare içine yerleştirin';

  @override
  String get qrTokenHint =>
      'Bu QR kodu kapı cihazına okutun. Kod 10 saniye geçerlidir, süre dolunca yenile butonuna basın.';

  @override
  String qrProcessError(String error) {
    return 'QR kod işlenirken bir hata oluştu: $error';
  }

  @override
  String get qrUserCodeTitle => 'Kullanıcı QR Kodu';

  @override
  String qrUserCodeBody(String name, String email, String date) {
    return 'Kullanıcı: $name\nE-posta: $email\nTarih: $date';
  }

  @override
  String get qrInvalidCode => 'Geçersiz QR kod';

  @override
  String get qrAccessGranted => 'Geçiş Başarılı';

  @override
  String get qrUnknownError => 'Bir hata oluştu';

  @override
  String qrDeviceLine(String name) {
    return 'Cihaz: $name';
  }

  @override
  String qrLocationLine(String location) {
    return 'Konum: $location';
  }

  @override
  String qrTimeLine(String time) {
    return 'Zaman: $time';
  }

  @override
  String get visitorTitle => 'Ziyaretçi Yönetimi';

  @override
  String get visitorStatTotal => 'Toplam';

  @override
  String get visitorStatInside => 'İçeride';

  @override
  String get visitorStatExpected => 'Beklenen';

  @override
  String get visitorEmpty => 'Henüz ziyaretçi kaydı yok';

  @override
  String get visitorEmptyHint =>
      'Yeni ziyaretçi eklemek için + butonuna tıklayın';

  @override
  String get visitorStatusExpected => 'Bekleniyor';

  @override
  String get visitorStatusInside => 'İçeride';

  @override
  String get visitorStatusOut => 'Çıktı';

  @override
  String visitorContactPerson(String name) {
    return 'İletişim: $name';
  }

  @override
  String get visitorCheckOut => 'Çıkış Yap';

  @override
  String get visitorCheckIn => 'Giriş Yap';

  @override
  String visitorCheckedInToast(String name) {
    return '$name giriş yaptı';
  }

  @override
  String visitorCheckedOutToast(String name) {
    return '$name çıkış yaptı';
  }

  @override
  String get visitorFilterTitle => 'Filtrele';

  @override
  String get visitorFilterBody => 'Filtreleme seçenekleri buraya gelecek.';

  @override
  String get visitorAddTitle => 'Yeni Ziyaretçi';

  @override
  String get visitorFieldName => 'Ad Soyad';

  @override
  String get visitorFieldCompany => 'Şirket';

  @override
  String get visitorFieldPurpose => 'Ziyaret Amacı';

  @override
  String get visitorFieldContact => 'İletişim Kişisi';

  @override
  String get visitorAddedToast => 'Ziyaretçi eklendi';

  @override
  String get visitorAddButton => 'Ziyaretçi Ekle';

  @override
  String get errorNetwork =>
      'İnternet bağlantısı kurulamadı. Lütfen bağlantınızı kontrol edin.';

  @override
  String get errorTimeout =>
      'Sunucu yanıt vermedi. Lütfen daha sonra tekrar deneyin.';

  @override
  String errorServer(int code) {
    return 'Sunucu hatası ($code). Lütfen biraz sonra tekrar deneyin.';
  }

  @override
  String get errorAuthExpired =>
      'Oturumunuz sona erdi. Lütfen tekrar giriş yapın.';

  @override
  String get errorUnknown =>
      'Beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.';

  @override
  String get errorBusinessInvalidCredentials => 'E-posta veya şifre hatalı';

  @override
  String get errorBusinessNoMobilePassword =>
      'Mobil şifreniz henüz kurulmamış. Yöneticinizden kurulum bağlantısı isteyin.';

  @override
  String get errorBusinessEmployeeInactive => 'Çalışan kaydınız aktif değil';

  @override
  String get passwordResetAdminInfo =>
      'Mobil şifre kurulumunu yöneticiniz yapar. Lütfen yöneticinizle iletişime geçin.';

  @override
  String get qrInvalidDevice => 'QR kodda cihaz bilgisi yok';

  @override
  String get accessDenied => 'Erişim reddedildi';
}

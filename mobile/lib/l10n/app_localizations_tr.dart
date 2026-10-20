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
  String get loginWelcomeTitle => 'Hoş geldiniz!';

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
  String get profileEditButton => 'Kişisel bilgiler';

  @override
  String get profileEditDialogBody =>
      'Adınız, soyadınız ve e-posta adresiniz kuruluşunuz tarafından yönetilir. Düzeltme için kurumunuzun personel veya sistem yöneticisine başvurun. Bu uygulama bu alanları değiştirmez.';

  @override
  String get profileNotifications => 'Bildirimler';

  @override
  String get profileNotificationsSubtitle =>
      'Güncellemeler ve kullanım bilgisi';

  @override
  String get profileSecurity => 'Güvenlik';

  @override
  String get profileSecuritySubtitle => 'Şifre değiştirme ve kurtarma';

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
  String get profileAppVersion => 'Sürüm';

  @override
  String get profilePrivacy => 'Gizlilik bilgileri';

  @override
  String get profilePrivacySubtitle => 'Uygulamadaki veriler ve başvuru yolu';

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
  String get profileSettingsBody =>
      'Tema, dil ve hızlı erişim hedefinizi Profil ekranından ayarlayabilirsiniz.';

  @override
  String get profileNotificationsDialogTitle => 'Bildirim Ayarları';

  @override
  String get profileNotificationsDialogBody =>
      'Bu sürümde anlık bildirim teslimi ve bildirim tercihi yönetimi bulunmuyor. Güncel erişim ve hareket bilgilerinizi uygulamayı açarak yenileyebilirsiniz. Eksik veya hatalı kayıtlar için kurumunuzun yöneticisine başvurun.';

  @override
  String get profileSecurityDialogTitle => 'Güvenlik Ayarları';

  @override
  String get profileSecurityDialogBody =>
      'Mevcut şifrenizi biliyorsanız aşağıdaki formdan yeni bir şifre belirleyebilirsiniz. Şifre değişikliği tüm mobil oturumları sonlandırır. Şifrenizi unuttuysanız kurum yöneticinizden yeni kurulum bağlantısı isteyin. Ortak bir cihazdan ayrılmadan önce Çıkış Yap seçeneğini kullanın.';

  @override
  String get profileThemeDialogTitle => 'Tema Ayarları';

  @override
  String get profileThemeDialogBody => 'Açık, koyu veya sistem temasını seçin.';

  @override
  String get profileLanguageDialogTitle => 'Dil Ayarları';

  @override
  String get profileLanguageDialogBody =>
      'Dil tercihi bu cihazda saklanır ve çıkıştan sonra korunur.';

  @override
  String get profileHelpDialogTitle => 'Yardım & Destek';

  @override
  String get profileHelpDialogBody =>
      'Kapı seçimi\nProfil > Hızlı Erişim Kapısı bölümünden erişebildiğiniz bir hedef seçin. Seçimi kaldırabilir veya listeyi yenileyebilirsiniz. Liste boşsa erişim yetkilerinizi kurum yöneticinize kontrol ettirin.\n\nQR kullanımı\nKamera izni yalnız kod taramak için gerekir. İzin verilmediyse cihaz ayarlarından kamera erişimini kontrol edin. Kişisel QR kodunu desteklenen okuyucuya gösterin; kodun süresi dolduğunda yenileyin. Kimlik etiketi taramak tek başına geçiş kaydı oluşturmaz.\n\nKayıt ve erişim sorunları\nAğ bağlantısını kontrol edip ilgili ekranı yenileyin. Kapı komutu ile fiziksel geçiş ve resmi PDKS sonucu farklı durumlardır. Eksik veya hatalı kayıt için personel/sistem yöneticinize başvurun.\n\nDestek bilgisi\nYöneticinize uygulama sürümünü (Uygulama Hakkında), sorunun zamanını ve görünen hata açıklamasını iletin. Parola, oturum bilgisi veya kişisel QR kodunu paylaşmayın.';

  @override
  String get profilePrivacyDialogTitle => 'Gizlilik bilgileri';

  @override
  String get profilePrivacyDialogBody =>
      'Uygulama veri bilgisi — 19 Ekim 2026\n\nNGS Plus, oturum açtığınız kuruluşun çalışan bilgilerini, erişilebilir cihazları ve size ait erişim hareketlerini hizmetten alıp gösterir. Kişisel QR kodu hizmetten alınır; kamera kod taramak için kullanılır. Kapı isteğinde seçilen hedef hizmete iletilir. Tema, dil ve kapsamlı hedef tercihi bu cihazda saklanır.\n\nÇalışan kaydını, erişim yetkilerini ve hareket kayıtlarını kuruluşunuz yönetir. Verilerin işlenme amacı, saklama süresi, hukuki dayanağı ve kişisel veri talepleriniz için kurumunuzun personel/veri sorumlusuna başvurun.\n\nBu açıklama uygulamanın veri kullanımını anlatır; kuruluşunuzun onaylı gizlilik politikasının yerine geçmez. Kuruluşunuza ait yayımlanmış politika bağlantısı bu sürümde yapılandırılmamıştır.';

  @override
  String get profileAboutDialogTitle => 'NGS Plus Hakkında';

  @override
  String get profileAboutLine1 => 'NGS Plus Yoklama Takip Sistemi';

  @override
  String get profileAboutLine2 => 'Kurulu uygulama sürümü';

  @override
  String get profileAboutLine3 => 'Destek için kurum yöneticinize başvurun.';

  @override
  String get profileAboutLine4 =>
      'Çalışan erişim ve hareket bilgilerini görüntüleme uygulaması.';

  @override
  String get profileFallbackEmail => 'E-posta bilgisi yok';

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
  String get historyEmptyHint => 'Verileri yenilemek için aşağı çekin';

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

  @override
  String get profileFirstName => 'Ad';

  @override
  String get profileLastName => 'Soyad';

  @override
  String get profileLanguageSystem => 'Sistem dili';

  @override
  String get profileLanguageScope =>
      'Bu cihazda saklanır; çıkıştan sonra korunur.';

  @override
  String get profileVersionUnavailable => 'Sürüm bilgisi alınamadı';

  @override
  String profileVersionBuild(String version, String build) {
    return 'Sürüm $version (derleme $build)';
  }

  @override
  String get preferenceSaveFailed =>
      'Tercih kaydedilemedi. Lütfen yeniden deneyin.';

  @override
  String get preferenceIdentityUnavailable =>
      'Hesap veya proje bilgisi doğrulanamadı. Yeniden giriş yapın.';

  @override
  String get selectDeviceClear => 'Seçimi kaldır';

  @override
  String get selectDeviceInvalidated =>
      'Önceki hedef artık erişilebilir değil. Lütfen yeni bir hedef seçin.';

  @override
  String get historyLoadMore => 'Daha fazla yükle';

  @override
  String get historyAccessDenied => 'Erişim reddedildi';

  @override
  String get historyUnknownDirection => 'Bilinmeyen yön';

  @override
  String get historyUnknownAccess => 'Erişim sonucu bilinmiyor';

  @override
  String get historyStaleData =>
      'Son veriler gösteriliyor; yenileme başarısız.';

  @override
  String get historySummaryUnavailable => 'Dönem özeti alınamadı.';

  @override
  String get historyRawEvents =>
      'Ham erişim hareketleri; resmi PDKS sonucu değildir.';

  @override
  String get homeDataLoading => 'Veriler yükleniyor';

  @override
  String get homeDataUnavailable => 'Veriler alınamadı';

  @override
  String get homeDataStale => 'Önceki veriler gösteriliyor';

  @override
  String get homeDataRefreshing => 'Veriler yenileniyor';

  @override
  String get homeRetry => 'Yeniden dene';

  @override
  String get homeStatusUnknown => 'Durum bilinmiyor';

  @override
  String get homeSelfCheckIn => 'Manuel kayıt';

  @override
  String get homeSelfCheckInRecorded => 'Manuel kayıt oluşturuldu';

  @override
  String get homeCommandPending =>
      'Komut gönderildi; fiziksel geçiş doğrulanmadı.';

  @override
  String get qrCameraUnavailableRetry =>
      'Kamera başlatılamadı. Tekrar deneyin.';

  @override
  String get qrCameraInUseRetry =>
      'Kamera kullanılamıyor. Diğer kamera uygulamalarını kapatıp tekrar deneyin.';

  @override
  String get qrSettingsUnavailable =>
      'Ayarlar açılamadı. Sistem ayarlarından kamera iznini etkinleştirin.';

  @override
  String get qrServiceUnavailable => 'QR hizmeti kullanılamıyor.';

  @override
  String get qrPersonalCode => 'Kişisel QR kodunuz';

  @override
  String get qrConsumedHint => 'Kod kullanıldı. Yeni işlem için yenileyin.';

  @override
  String get qrExpiredHint => 'Kodun süresi doldu.';

  @override
  String get qrRefreshFailed => 'QR yenilenemedi.';

  @override
  String get qrStatusUnavailable =>
      'Kodun durumu doğrulanamadı. Tekrar kontrol edin.';

  @override
  String get qrReaderHint =>
      'Bu kodu desteklenen okuyucuya gösterin. Süre sunucunun bitiş zamanına göre gösterilir. İşlem kaydı kapının açıldığını veya fiziksel geçişi doğrulamaz.';

  @override
  String get qrSwitchCamera => 'Kamerayı değiştir';

  @override
  String get qrFlashlight => 'Flaş';

  @override
  String get qrCameraPermissionRequired =>
      'QR taramak için kamera izni gerekiyor.';

  @override
  String get qrOpenSettings => 'Ayarları aç';

  @override
  String get qrCameraControlUnavailable => 'Kamera kontrolü kullanılamıyor.';

  @override
  String get qrDeviceIdentityOnly =>
      'Bu bir cihaz kimlik etiketidir; geçiş yetkisi veya fiziksel bulunma kanıtı sağlamaz. Desteklenen okuyucuda QR’ım sekmesini kullanın.';

  @override
  String get qrEmployeeIdentityOnly =>
      'Bu bir çalışan kimlik kodudur. Kimlik doğrulaması veya geçiş kaydı oluşturmaz.';

  @override
  String get qrChallengeUnsupported =>
      'Bu okuyucunun güvenli işlem akışı henüz desteklenmiyor. Desteklenen okuyucuda QR’ım sekmesini kullanın.';

  @override
  String get qrScanExpired => 'QR kodun süresi doldu.';

  @override
  String get qrInvalidDate => 'QR kodun tarihi geçersiz.';

  @override
  String get qrUnsupportedVersion => 'Bu QR sürümü desteklenmiyor.';

  @override
  String qrRemainingSeconds(int seconds) {
    return 'Kalan süre: $seconds sn';
  }

  @override
  String get loginRememberEmail => 'E-postamı hatırla';

  @override
  String get passwordHelpTitle => 'Şifre yardımı';

  @override
  String get passwordHelpAdminTitle => 'Yöneticinizle iletişime geçin';

  @override
  String get passwordHelpAdminBody =>
      'Mobil şifre kurulumunu kurum yöneticiniz yönetir. Kayıtlı e-posta adresinize yeni bir kurulum bağlantısı göndermesini isteyin. Bağlantıyı açıp yeni şifrenizi belirledikten sonra giriş ekranına dönün.';

  @override
  String get passwordHelpNoEmail =>
      'Bu ekran e-posta göndermez veya şifrenizi değiştirmez.';

  @override
  String get passwordHelpRequest =>
      'Merhaba, NGS Plus mobil şifremi oluşturmak veya yenilemek istiyorum. Çalışan kaydımdaki e-posta adresime yeni bir şifre kurulum bağlantısı gönderebilir misiniz?';

  @override
  String get passwordHelpCopy => 'Yöneticiye iletilecek talebi kopyala';

  @override
  String get passwordHelpCopied =>
      'Talep kopyalandı. Yöneticinizle paylaşabilirsiniz.';

  @override
  String get passwordHelpCopyFailed =>
      'Kopyalanamadı. Aşağıdaki talep metnini seçebilirsiniz.';

  @override
  String get loginShowPassword => 'Şifreyi göster';

  @override
  String get loginHidePassword => 'Şifreyi gizle';

  @override
  String get startupTitle => 'NGS Plus başlatılıyor';

  @override
  String get startupUnavailable =>
      'Oturum doğrulanamadı. Bağlantınızı kontrol edip yeniden deneyin.';

  @override
  String get startupRetry => 'Yeniden dene';

  @override
  String get startupUseLogin => 'Giriş ekranına dön';

  @override
  String homeUpdatedAt(String time) {
    return 'Son güncelleme: $time';
  }

  @override
  String get homeScanQr => 'QR kod tara';

  @override
  String get homeCommandConfirmed =>
      'Cihaz komutu onayladı; fiziksel geçiş doğrulanmadı.';

  @override
  String get homeCommandFailed => 'Kapı komutu başarısız oldu.';

  @override
  String get homeCommandUnknown =>
      'Sonuç belirsiz; yeniden komut göndermeden durumu kontrol edin.';

  @override
  String get homeCommandCheckStatus => 'Durumu kontrol et';

  @override
  String get visitorFirstName => 'Ad';

  @override
  String get visitorLastName => 'Soyad';

  @override
  String get visitorPhone => 'Telefon';

  @override
  String get visitorStart => 'Ziyaret başlangıcı';

  @override
  String get visitorEnd => 'Ziyaret bitişi';

  @override
  String get visitorSave => 'Kaydet';

  @override
  String get visitorEdit => 'Düzenle';

  @override
  String get visitorCancelInvitation => 'Daveti iptal et';

  @override
  String get visitorCancelConfirm => 'Bu davet iptal edilsin mi?';

  @override
  String get visitorPreRegistered => 'Yetkili aktivasyonu bekleniyor';

  @override
  String get visitorAccessActive => 'Erişim aktif';

  @override
  String get visitorAccessEnded => 'Erişim sonlandırıldı';

  @override
  String get visitorExpired => 'Süresi doldu';

  @override
  String get visitorPresenceUnknown => 'Fiziksel konum bilinmiyor';

  @override
  String get visitorPresenceInside => 'Son kayda göre içeride';

  @override
  String get visitorPresenceOutside => 'Son kayda göre dışarıda';

  @override
  String get visitorOperatorRequired =>
      'Aktif erişimi iptal etmek için yetkili operatörle iletişime geçin.';

  @override
  String get visitorSaved =>
      'Davet kaydı kaydedildi; yetkili aktivasyonu gerekiyor.';

  @override
  String get visitorCancelled => 'Davet iptal edildi.';

  @override
  String get visitorLoadMore => 'Daha fazla';

  @override
  String get visitorNotice => 'Proje ziyaretçi aydınlatma metni';

  @override
  String get visitorNoticeReviewed => 'Güncel aydınlatma metnini inceledim.';

  @override
  String get visitorInvalidForm =>
      'Zorunlu alanları ve ziyaret tarihlerini kontrol edin.';

  @override
  String get visitorStale => 'Yenilenemedi; önceki kayıtlar gösteriliyor.';

  @override
  String get visitorRefresh => 'Yenile';

  @override
  String get profileChangePassword => 'Şifreyi değiştir';

  @override
  String get profileCurrentPassword => 'Mevcut şifre';

  @override
  String get profileNewPassword => 'Yeni şifre';

  @override
  String get profileRepeatPassword => 'Yeni şifreyi tekrar girin';

  @override
  String get profilePasswordRules =>
      'Yeni şifre en az 12 karakter ve en fazla 72 UTF-8 bayt olmalı, mevcut şifrenizden farklı olmalıdır. Şifre değişince tüm oturumlar kapanır; yeniden giriş yapmanız gerekir.';

  @override
  String get profilePasswordInvalid =>
      'Şifre kurallarını ve iki yeni şifrenin eşleştiğini kontrol edin.';

  @override
  String get profilePasswordRequired => 'Mevcut şifrenizi girin.';

  @override
  String get profilePasswordChanged =>
      'Şifreniz değiştirildi. Yeni şifrenizle giriş yapın.';

  @override
  String get errorRateLimited =>
      'Çok fazla deneme yapıldı. Bir süre bekleyip yeniden deneyin.';

  @override
  String get errorSessionStorageFailed =>
      'Oturum güvenli biçimde saklanamadı. Lütfen yeniden giriş yapın.';

  @override
  String get errorProtocol =>
      'Geçerli bir sunucu yanıtı alınamadı. Lütfen yeniden deneyin.';

  @override
  String get errorPasswordPolicy =>
      'Yeni şifre en az 12 karakter, en fazla 72 UTF-8 bayt olmalı ve mevcut şifreden farklı olmalıdır.';

  @override
  String get homeChooseDoor => 'Kapı seçin';

  @override
  String get homeDoorUnavailable =>
      'Seçilen kapı artık kullanılamıyor. Profil üzerinden yeni bir kapı seçin.';

  @override
  String get homeNoOpenableDoor => 'Bu cihazda açılabilir bir kapı yok.';

  @override
  String get startupContactAdministrator =>
      'Sorun devam ederse kurumunuzun sistem yöneticisine başvurun.';

  @override
  String get selectDeviceInactive => 'Hedef devre dışı';

  @override
  String get selectDeviceOutsideSchedule => 'Şu anda erişim saatleri dışında';

  @override
  String get selectDeviceUnsupported => 'Bu hedefte mobil açma desteklenmiyor';

  @override
  String get selectDeviceUnavailable => 'Bu hedef şu anda kullanılamıyor';

  @override
  String get visitorOutcomeUnknown =>
      'Sonuç bilinmiyor. Başka bir kayıt oluşturmadan aynı daveti yeniden deneyin; yinelenen kayıtları önlemek için bilgiler kilitlendi.';

  @override
  String get homeCommandRetrySameRequest => 'Aynı isteği yeniden gönder';

  @override
  String get homeCommandSending => 'Komut gönderiliyor; sonuç bekleniyor.';

  @override
  String get startupConfigurationUnavailable =>
      'Uygulama başlatılamadı. Yeniden deneyin veya kurumunuzun sistem yöneticisine başvurun.';

  @override
  String get visitorSearch => 'Davetlerde ara';

  @override
  String get visitorAllStatuses => 'Tüm erişim durumları';

  @override
  String get visitorSummaryTitle => 'Davetleriniz, tüm sayfalar';

  @override
  String get visitorSummaryLimited =>
      'Bu toplamlar alt sınırdır; özet okuma sınırına ulaşıldı.';

  @override
  String get visitorSummaryError => 'Özet yenilenemedi.';

  @override
  String get visitorSyncTitle => 'Cihaz senkronizasyonu';

  @override
  String get visitorSyncPending => 'Cihaz güncellemesi bekliyor';

  @override
  String get visitorSyncApplied => 'Cihaz güncellemeyi onayladı';

  @override
  String get visitorSyncFailed =>
      'Cihaz güncellemesi başarısız; operatörle iletişime geçin.';

  @override
  String get visitorSyncUnknown => 'Cihaz sonucu doğrulanamadı';

  @override
  String get profileDiagnosticsTitle => 'Teknik destek raporu';

  @override
  String get profileDiagnosticsBody =>
      'Uygulama sürümü, derleme ve son teknik hataları kuruluşunuzun destek ekibi için kopyalayın. Hesap bilgileri, parolalar, QR kodları ve yanıt gövdeleri dahil edilmez. Sınırlı kayıt uygulama kapanana kadar bellekte kalır; otomatik gönderim yapılmaz. Kopyalama raporu diğer uygulamaların erişebileceği sistem panosuna koyar. Yerel kaydı temizlemek önceden kopyalanan raporu silmez.';

  @override
  String get profileDiagnosticsEmpty =>
      'Yakın zamanda kaydedilen teknik hata yok. Rapor yine de uygulama ve derleme bilgisini içerir.';

  @override
  String get profileDiagnosticsCopy => 'Destek raporunu kopyala';

  @override
  String get profileDiagnosticsClear => 'Yerel kaydı temizle';

  @override
  String get profileDiagnosticsCopied =>
      'Destek raporu kopyalandı. Yalnız kuruluşunuzun destek ekibiyle paylaşın.';

  @override
  String get profileDiagnosticsCopyFailed =>
      'Rapor kopyalanamadı. Lütfen tekrar deneyin.';

  @override
  String get profileDiagnosticsCleared =>
      'Yerel kayıt temizlendi. Önceden kopyalanan raporlar panoda kalır.';

  @override
  String get visitorNotes => 'Notlar';

  @override
  String get visitorOptionalHint => 'İsteğe bağlı';
}

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
  String get commonOk => 'Tamam';

  @override
  String get commonCancel => 'İptal';

  @override
  String get commonClose => 'Kapat';

  @override
  String get commonRetry => 'Yeniden dene';

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
  String get pdksSubtitle => 'Personel Devam Kontrol Sistemi';

  @override
  String get loginPrompt =>
      'PDKS sistemine giriş yapmak için bilgilerinizi giriniz';

  @override
  String get loginTitle => 'Giriş yap';

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
  String get loginForgotPassword => 'Şifre yardımı';

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
    return '$greeting, $name';
  }

  @override
  String get homeStatusInside => 'İçeride';

  @override
  String get homeStatusOut => 'Dışarıda';

  @override
  String get homeStatusNone => 'Bugün kayıt yok';

  @override
  String get homeAttendanceEntryRow => 'Son giriş';

  @override
  String get homeAttendanceExitRow => 'Son çıkış';

  @override
  String homeExtraEntries(int count) {
    return '+$count giriş daha';
  }

  @override
  String homeExtraExits(int count) {
    return '+$count çıkış daha';
  }

  @override
  String get homeAttendanceTimeEmpty => '—';

  @override
  String get profileTitle => 'Profil';

  @override
  String get profileAccountSection => 'Hesap';

  @override
  String get profilePreferencesSection => 'Tercihler';

  @override
  String get profileSupportSection => 'Destek';

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
  String get profileTheme => 'Tema';

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
  String get profilePreferredDoor => 'Hızlı erişim kapısı';

  @override
  String get profilePreferredDoorEmpty => 'Seçilmedi';

  @override
  String get quickActionUnlock => 'Kapıyı aç';

  @override
  String get quickActionProfile => 'Profil';

  @override
  String get unlockNoDeviceSelected =>
      'Önce Profil\'den hızlı erişim kapısını seç';

  @override
  String get unlockDenied => 'Erişim Reddedildi';

  @override
  String get selectDeviceTitle => 'Kapı seç';

  @override
  String get selectDeviceSearch => 'Kapılarda ara';

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
  String get profilePrivacy => 'Gizlilik bilgileri';

  @override
  String get profilePrivacySubtitle => 'Uygulamadaki veriler ve başvuru yolu';

  @override
  String get profileLogout => 'Çıkış Yap';

  @override
  String get profileLogoutConfirmTitle => 'Çıkış Yap';

  @override
  String get profileLogoutConfirmBody =>
      'Hesabınızdan çıkış yapmak istediğinizden emin misiniz?';

  @override
  String get profileNotificationsDialogBody =>
      'Bu sürümde anlık bildirim teslimi ve bildirim tercihi yönetimi bulunmuyor. Güncel erişim ve hareket bilgilerinizi uygulamayı açarak yenileyebilirsiniz. Eksik veya hatalı kayıtlar için kurumunuzun yöneticisine başvurun.';

  @override
  String get profileSecurityDialogBody =>
      'Mevcut şifrenizi biliyorsanız aşağıdaki formdan yeni bir şifre belirleyebilirsiniz. Şifre değişikliği tüm mobil oturumları sonlandırır. Şifrenizi unuttuysanız kurum yöneticinizden yeni kurulum bağlantısı isteyin. Ortak bir cihazdan ayrılmadan önce Çıkış Yap seçeneğini kullanın.';

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
  String get profileAboutLine4 =>
      'Çalışan erişim ve hareket bilgilerini görüntüleme uygulaması.';

  @override
  String get profileFallbackEmail => 'E-posta bilgisi yok';

  @override
  String get historyTitle => 'Geçmiş';

  @override
  String get historyTabAll => 'Kayıtlar';

  @override
  String get historyTabThisMonth => 'Takvim';

  @override
  String get historyTabStats => 'Özet';

  @override
  String get historyLoading => 'Kayıtlar yükleniyor';

  @override
  String get historyErrorTitle => 'Kayıtlar alınamadı';

  @override
  String get historyEmpty => 'Kayıt bulunamadı';

  @override
  String get historyEmptyHint => 'Yeni geçişleriniz burada görünecek.';

  @override
  String get historyMonthSummary => 'Bu ayın özeti';

  @override
  String get historyActiveDays => 'Giriş günü';

  @override
  String get historyThisWeek => 'Bu hafta';

  @override
  String get historyWeeklySummary => 'Haftalık özet';

  @override
  String get historyUnknownDevice => 'Kapı bilgisi yok';

  @override
  String get historyRecordDetailTitle => 'Kayıt ayrıntısı';

  @override
  String get historyDetailDate => 'Tarih';

  @override
  String get historyDetailTime => 'Saat';

  @override
  String get historyDetailLocation => 'Konum';

  @override
  String get historyFilterTitle => 'Filtrele';

  @override
  String get historyFilterDate => 'Tarih';

  @override
  String get historyFilterDevice => 'Kapı';

  @override
  String get historyFilterClear => 'Filtreleri temizle';

  @override
  String historyDayRecordCount(int count) {
    return '$count kayıt';
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
  String get qrRefresh => 'Yenile';

  @override
  String get qrTryAgain => 'Tekrar dene';

  @override
  String get qrFrameHint => 'QR kodu çerçeveye alın';

  @override
  String get qrInvalidCode => 'Geçersiz QR kod';

  @override
  String get visitorTitle => 'Ziyaretçiler';

  @override
  String get visitorStatTotal => 'Toplam';

  @override
  String get visitorEmpty => 'Henüz davet yok';

  @override
  String get visitorEmptyHint =>
      'Ziyaretçi davet et düğmesiyle yeni bir davet oluşturun.';

  @override
  String get visitorFilterTitle => 'Filtrele';

  @override
  String get visitorAddTitle => 'Ziyaretçi davet et';

  @override
  String get visitorFieldPurpose => 'Ziyaret Amacı';

  @override
  String get visitorAddButton => 'Ziyaretçi davet et';

  @override
  String get errorNetwork =>
      'İnternet bağlantısı kurulamadı. Lütfen bağlantınızı kontrol edin.';

  @override
  String get errorTimeout => 'İşlem zamanında tamamlanamadı. Yeniden deneyin.';

  @override
  String get errorServer => 'İşlem tamamlanamadı. Biraz sonra yeniden deneyin.';

  @override
  String get errorEmploymentEnded =>
      'Mobil erişiminiz kapatıldı. Kurum yöneticinize başvurun.';

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
      'Geçiş kayıtları gösterilir. Resmi devam ve çalışma süresi sonuçları farklı olabilir.';

  @override
  String get homeDataLoading => 'Veriler yükleniyor';

  @override
  String get homeDataUnavailable => 'Bugünkü durum alınamadı';

  @override
  String get homeDataStale => 'Önceki veriler gösteriliyor';

  @override
  String get homeDataRefreshing => 'Veriler yenileniyor';

  @override
  String get homeRetry => 'Yeniden dene';

  @override
  String get homeStatusUnknown => 'Durum bilinmiyor';

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
  String get qrReaderHint => 'Kodu okuyucuya gösterin';

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
  String get qrGrantCameraPermission => 'Kamera izni ver';

  @override
  String get qrCameraControlUnavailable => 'Kamera kontrolü kullanılamıyor.';

  @override
  String get qrDeviceIdentityOnly =>
      'Bu kod cihazı tanıtır; kapıyı açmaz veya geçiş kaydı oluşturmaz. QR Kodum sekmesindeki kodu uygun okuyucuya gösterin.';

  @override
  String get qrEmployeeIdentityOnly =>
      'Bu bir çalışan kimlik kodudur. Kimlik doğrulaması veya geçiş kaydı oluşturmaz.';

  @override
  String get qrChallengeUnsupported =>
      'Bu okuyucuyla tarama yapılamıyor. QR Kodum sekmesindeki kodu uygun okuyucuya gösterin.';

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
      'Kurum yöneticinizden kayıtlı e-postanıza şifre kurulum bağlantısı göndermesini isteyin. Şifrenizi belirledikten sonra giriş yapın.';

  @override
  String get passwordHelpNoEmail =>
      'Bu ekran e-posta göndermez veya şifrenizi değiştirmez.';

  @override
  String get passwordHelpRequest =>
      'Merhaba, NGS Plus mobil şifremi oluşturmak veya yenilemek istiyorum. Çalışan kaydımdaki e-posta adresime yeni bir şifre kurulum bağlantısı gönderebilir misiniz?';

  @override
  String get passwordHelpCopy => 'Talebi kopyala';

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
  String get startupBandTitle => 'Başlatılıyor';

  @override
  String get startupFailureTitle => 'Başlatılamadı';

  @override
  String get startupUnavailable =>
      'Oturum doğrulanamadı. Bağlantınızı kontrol edip yeniden deneyin.';

  @override
  String get startupRetry => 'Yeniden dene';

  @override
  String get startupUseLogin => 'Giriş ekranına dön';

  @override
  String homeUpdatedAt(String time) {
    return 'Son güncelleme $time';
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
  String get visitorSave => 'Daveti kaydet';

  @override
  String get visitorEdit => 'Düzenle';

  @override
  String get visitorEditTitle => 'Daveti düzenle';

  @override
  String get visitorStartDate => 'Başlangıç tarihi';

  @override
  String get visitorEndDate => 'Bitiş tarihi';

  @override
  String get visitorStartTime => 'Başlangıç saati';

  @override
  String get visitorEndTime => 'Bitiş saati';

  @override
  String get visitorNotFound => 'Davet bulunamadı';

  @override
  String get visitorErrorEndBeforeStart => 'Bitiş, başlangıçtan sonra olmalı.';

  @override
  String get visitorErrorMaxDuration => 'Ziyaret en fazla 31 gün sürebilir.';

  @override
  String get visitorErrorEndInPast => 'Bitiş geçmişte olamaz.';

  @override
  String get visitorErrorNoticeRequired =>
      'Devam etmek için aydınlatma metnini onaylayın.';

  @override
  String get visitorCancelInvitation => 'Daveti iptal et';

  @override
  String get visitorCancelConfirm => 'Bu davet iptal edilsin mi?';

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
  String get visitorSaved => 'Davet kaydedildi. Yetkili onayı bekleniyor.';

  @override
  String get visitorCancelled => 'Davet iptal edildi.';

  @override
  String get visitorLoadMore => 'Daha fazla';

  @override
  String get visitorNotice => 'Proje ziyaretçi aydınlatma metni';

  @override
  String get visitorNoticeReviewed => 'Güncel aydınlatma metnini inceledim.';

  @override
  String get fieldRequired => 'Bu alan zorunlu.';

  @override
  String get visitorStale =>
      'Davetler yenilenemedi. Önceki davetler gösteriliyor.';

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
      'Yeni şifre en az 8 karakter olmalı; büyük harf, küçük harf ve rakam içermeli, en fazla 72 UTF-8 bayt olmalı ve mevcut şifrenizden farklı olmalıdır. Şifre değişince tüm oturumlar kapanır; yeniden giriş yapmanız gerekir.';

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
  String get errorProtocol => 'İşlem tamamlanamadı. Yeniden deneyin.';

  @override
  String get errorPasswordPolicy =>
      'Yeni şifre en az 8 karakter olmalı; büyük harf, küçük harf ve rakam içermeli, en fazla 72 UTF-8 bayt olmalı ve mevcut şifreden farklı olmalıdır.';

  @override
  String get homeChooseDoor => 'Kapı seçin';

  @override
  String get homeDoorUnavailable =>
      'Seçilen kapı kullanılamıyor. Yeni bir kapı seçin.';

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
  String get visitorSummaryTitle => 'Tüm davetlerin özeti';

  @override
  String get visitorSummaryLimited =>
      'Bazı davetler özete dahil edilemedi; gerçek toplam daha yüksek olabilir.';

  @override
  String get visitorSummaryError => 'Özet yenilenemedi.';

  @override
  String get visitorSyncTitle => 'Cihaz durumu';

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

  @override
  String get historyInfoTitle => 'Kayıtlar hakkında';

  @override
  String get historyTimeZone => 'Türkiye saati · UTC+3';

  @override
  String get historyAllDates => 'Tüm tarihler';

  @override
  String get historyAllDevices => 'Tüm kapılar';

  @override
  String get historyApplyFilters => 'Filtreleri uygula';

  @override
  String get historyShowAllRecords => 'Tüm kayıtları göster';

  @override
  String get historyFilteredEmptyHint =>
      'Seçtiğiniz tarih veya cihaz için kayıt bulunmuyor.';

  @override
  String get historyCalendarLegend => 'Noktalı günlerde kayıt var.';

  @override
  String get historySelectDayHint => 'Kayıtlarını görmek için bir gün seçin.';

  @override
  String get historyNoActivity => 'Bu dönemde erişim hareketi yok';

  @override
  String get historyNoActivityHint =>
      'Yeni kayıtlar burada görünecek. Kayıt olmaması devamsızlık anlamına gelmez.';

  @override
  String get historyDeniedCount => 'Reddedilen';

  @override
  String get historyUnknownCount => 'Belirsiz';

  @override
  String get historyLoadedDevices =>
      'Bu listedeki kayıtlarda yer alan kapılar gösterilir.';

  @override
  String get historyNoDeviceOptions => 'Bu kayıtlar için kapı seçeneği yok.';

  @override
  String get historyTabThisMonthPeriod => 'Bu ay';

  @override
  String get visitorPeopleSection => 'Kişi bilgileri';

  @override
  String get visitorVisitSection => 'Ziyaret bilgileri';

  @override
  String get visitorActivationHint =>
      'Davet kaydı oluşturulduktan sonra yetkili aktivasyonu gerekir.';

  @override
  String get visitorMetricPending => 'Onay bekliyor';

  @override
  String get visitorPendingShort => 'Aktivasyon bekliyor';

  @override
  String get visitorInvitationsTitle => 'Davetler';

  @override
  String get visitorFilteredEmptyHint =>
      'Arama veya durum filtresiyle eşleşen davet bulunamadı.';

  @override
  String get visitorClearFilters => 'Filtreleri temizle';

  @override
  String get visitorNoticeUnavailable =>
      'Aydınlatma bilgisi yüklenemedi. Kaydetmeden önce tekrar deneyin.';

  @override
  String get profileProject => 'Kurum ve proje';

  @override
  String get profileProjectUnavailable =>
      'Proje bilgisi şu anda kullanılamıyor';

  @override
  String get doorOperationRecoveryTitle => 'Kapı işlemini kontrol et';

  @override
  String get doorOperationNothingToCheck => 'Kontrol edilecek kapı işlemi yok.';

  @override
  String get doorOperationRecoveryHint =>
      'Önce önceki isteğin durumu kontrol edilir. Tekrar denerseniz aynı istek ve aynı kapı kullanılır. Komut sonucu fiziksel geçişi doğrulamaz.';

  @override
  String get visitorRecoveryChecking =>
      'Önceki ziyaretçi isteği kontrol ediliyor…';

  @override
  String get visitorRecoveryUnresolved =>
      'Önceki isteğin sonucu henüz doğrulanamadı. Aynı ziyaretçi bilgilerini girip aynı isteği tekrar deneyebilirsiniz. Yeni bir istek oluşturulmayacak.';

  @override
  String get visitorRecoveryRetry => 'Aynı isteği tekrar dene';

  @override
  String get visitorRecoveryFound => 'Önceki ziyaretçi kaydı bulundu.';

  @override
  String get visitorRecoveryStorageError =>
      'Ziyaretçi isteği güvenli biçimde saklanamadı veya okunamadı. Devam etmeden önce durumu tekrar kontrol edin.';

  @override
  String get errorRequestProjectMissing => 'Çalışanın proje bilgisi bulunamadı';

  @override
  String get errorRequestNoteTooLong => 'Not en fazla 500 karakter olabilir';

  @override
  String get errorRequestDateInvalid => 'Geçerli bir tarih seçin.';

  @override
  String get errorRequestRangeInvalid =>
      'Bitiş tarihi başlangıçtan önce olamaz';

  @override
  String get errorRequestStartTooOld =>
      'İzin başlangıcı en fazla 30 gün geçmiş olabilir';

  @override
  String get errorRequestRangeTooLong =>
      'İzin aralığı en fazla 60 gün olabilir';

  @override
  String get errorRequestPendingLimit =>
      'En fazla 10 bekleyen izin talebiniz olabilir';

  @override
  String get errorRequestOverlapPending =>
      'Seçilen tarihler bekleyen başka bir izin talebiyle çakışıyor';

  @override
  String get errorRequestOverlapApproved =>
      'Seçilen tarihler onaylı başka bir izinle çakışıyor';

  @override
  String get errorRequestNotFound => 'Talep bulunamadı.';

  @override
  String get errorRequestNotPending =>
      'Yalnız bekleyen kendi talebinizi geri çekebilirsiniz.';

  @override
  String get errorCorrectionDateOutOfRange =>
      'Tarih bugün ile son 30 gün arasında olmalı';

  @override
  String get errorCorrectionReasonLength => 'Gerekçe 5–300 karakter olmalı';

  @override
  String get errorCorrectionTimesMismatch =>
      'Düzeltme türüne uygun giriş ve çıkış saatlerini belirtin';

  @override
  String get errorCorrectionTimeInvalid => 'Geçerli bir saat seçin.';

  @override
  String get errorCorrectionPendingExists =>
      'Bu gün için bekleyen bir düzeltme talebiniz var';

  @override
  String get requestsTitle => 'Taleplerim';

  @override
  String get requestsLeave => 'İzin';

  @override
  String get requestsCorrection => 'Kayıt düzeltme';

  @override
  String get requestsNew => 'Yeni talep';

  @override
  String get requestsEmpty => 'Henüz talebiniz yok.';

  @override
  String get requestsRetry => 'Yeniden dene';

  @override
  String get requestsWithdraw => 'Talebi geri çek';

  @override
  String get requestsWithdrawConfirm =>
      'Bu talebi geri çekmek istiyor musunuz?';

  @override
  String get requestsCancel => 'Vazgeç';

  @override
  String get requestsUncertain =>
      'Talep gönderilmiş olabilir; listeyi kontrol edin.';

  @override
  String get requestsAdmin => 'Yönetici kaydı';

  @override
  String get requestsPending => 'Bekliyor';

  @override
  String get requestsApproved => 'Onaylandı';

  @override
  String get requestsRejected => 'Reddedildi';

  @override
  String get requestsWithdrawn => 'Geri çekildi';

  @override
  String get requestsUnknown => 'Bilinmiyor';

  @override
  String get requestsOther => 'Diğer';

  @override
  String get requestsStart => 'Başlangıç tarihi';

  @override
  String get requestsEnd => 'Bitiş tarihi';

  @override
  String get requestsDate => 'Tarih';

  @override
  String get requestsNotes => 'Not';

  @override
  String get requestsReason => 'Gerekçe';

  @override
  String get requestsType => 'Tür';

  @override
  String get requestsCheckIn => 'Giriş';

  @override
  String get requestsCheckOut => 'Çıkış';

  @override
  String get requestsBoth => 'İkisi';

  @override
  String get requestsDecision => 'Yönetici karar notu';

  @override
  String get requestsLeaveAnnual => 'Yıllık izin';

  @override
  String get requestsLeaveSick => 'Hastalık izni';

  @override
  String get requestsLeaveExcuse => 'Mazeret izni';

  @override
  String get requestsLeaveUnpaid => 'Ücretsiz izin';

  @override
  String get requestsLeaveParental => 'Doğum izni';

  @override
  String get requestsLeaveMarriage => 'Evlilik izni';

  @override
  String get requestsLeaveBereavement => 'Vefat izni';

  @override
  String get requestsLeavePaternity => 'Babalık izni';

  @override
  String get requestsLeaveLactation => 'Süt izni';

  @override
  String get requestsLeaveCompensatory => 'Telafi izni';

  @override
  String get requestsWithdrawUncertain =>
      'Talep geri çekilmiş olabilir; listeyi kontrol edin.';

  @override
  String get errorSummaryTooLarge =>
      'Bu dönem için özet oluşturulamıyor. Tarih aralığını küçültün.';

  @override
  String get errorInvalidCursor =>
      'Geçmiş sayfası artık geçerli değil. Listeyi yenileyin.';

  @override
  String get errorDeviceNotFound =>
      'Cihaz bu projede bulunamadı. Cihaz seçimini yenileyin veya yöneticinize başvurun.';

  @override
  String get errorSummaryInvalidData =>
      'Kayıt zamanları doğrulanamadı. Kayıtların kontrolü için yöneticinize başvurun.';

  @override
  String get errorVisitorInvalid =>
      'Ziyaretçi bilgileri veya liste sayfası geçersiz. Bilgileri ve tarihleri kontrol edin; gerekirse listeyi yenileyin.';

  @override
  String get errorVisitorLocked =>
      'Bu davet artık düzenlenemiyor. Daveti yenileyin veya operatöre başvurun.';

  @override
  String get errorVisitorNoticeChanged =>
      'Ziyaretçi aydınlatma metni değişti. Davet formunu yenileyip güncel metni okuyun ve tekrar onaylayın.';

  @override
  String get errorRequestConflict =>
      'Bu işlem farklı ziyaretçi bilgileriyle daha önce kaydedilmiş. Ziyaretçi listesini yenileyip mevcut daveti kontrol edin.';

  @override
  String get navQr => 'QR';

  @override
  String get homeToday => 'Bugün';

  @override
  String get homeFirstEntry => 'İlk giriş';

  @override
  String get loginSigningIn => 'Giriş yapılıyor';

  @override
  String get fieldSelectDate => 'Tarih seçin';

  @override
  String get fieldSelectTime => 'Saat seçin';

  @override
  String get fieldSelectOption => 'Seçin';

  @override
  String get requestsLeaveFormTitle => 'İzin talebi';

  @override
  String get requestsCorrectionFormTitle => 'Kayıt düzeltme talebi';

  @override
  String get requestsLeaveSubmit => 'İzin talebi gönder';

  @override
  String get requestsLeaveSubmitting => 'İzin talebi gönderiliyor';

  @override
  String get requestsLeaveSubmitted => 'İzin talebi gönderildi';

  @override
  String get requestsCorrectionSubmit => 'Düzeltme talebi gönder';

  @override
  String get requestsCorrectionSubmitting => 'Düzeltme talebi gönderiliyor';

  @override
  String get requestsCorrectionSubmitted => 'Düzeltme talebi gönderildi';

  @override
  String get requestsWithdrawnToast => 'Talep geri çekildi';

  @override
  String get requestsTimeZoneHint => 'Saatler Türkiye saatine göre girilir.';

  @override
  String get visitorSaving => 'Davet kaydediliyor';

  @override
  String get visitorLoadFailed => 'Davetler alınamadı. Yeniden deneyin.';

  @override
  String get visitorNoMatchTitle => 'Eşleşen davet yok';

  @override
  String get commonLoading => 'Yükleniyor';

  @override
  String get fieldNoOptions => 'Seçenek yok';

  @override
  String get metricNoRecord => 'Kayıt yok';

  @override
  String get fieldClear => 'Temizle';

  @override
  String historyWeeklyTotalRecords(int count) {
    return 'Bu hafta toplam $count kayıt';
  }

  @override
  String get unlockGranted => 'Erişim Verildi';

  @override
  String get visitorPreRegistered => 'Yetkili aktivasyonu bekleniyor';
}

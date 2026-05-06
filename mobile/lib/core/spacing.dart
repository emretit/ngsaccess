/// Uygulama geneli boşluk ve max-width sabitleri.
///
/// Magic number'lar yerine `AppSpacing.lg` kullanılarak tutarlı bir spacing
/// scale sağlanır. Mevcut ekranlarda toplu rewrite yapılmadı; yeni eklemelerde
/// veya overflow düzeltmelerinde bu sabitler tercih edilir.
class AppSpacing {
  AppSpacing._();

  static const double xs = 4;
  static const double sm = 8;
  static const double md = 12;
  static const double lg = 16;
  static const double xl = 24;
  static const double xxl = 32;

  /// Form (login, forgot password) gibi tek kolon dar içerikler için.
  static const double formMaxWidth = 480;

  /// Genel sayfa içeriği — tablet ve büyük ekranda kenarlara yapışmasın.
  static const double contentMaxWidth = 720;
}

/// Internal navigation intent; never accepted from an external return URL.
enum QrTab { code, scan }

class QrOpenIntent {
  const QrOpenIntent._scan(this.revision, {required this.sessionEpoch})
    : tab = QrTab.scan;

  final QrTab tab;
  final int revision;
  final int sessionEpoch;

  static int _revision = 0;
  static QrOpenIntent requestScan({required int sessionEpoch}) =>
      QrOpenIntent._scan(++_revision, sessionEpoch: sessionEpoch);
}

/** Verified writeAudit sources:
 * projects/onboarding/privacyBiometric/privacyRetention; employeeConsents/visitors;
 * lib/employeeCascade/cardReadings; pdksRecords; holidays/settings; biometricDestruction.
 * Keep this scope aligned with those writers; ordinary reads are not logged.
 */
export function AuditCoverage() {
  return <details className="text-xs text-muted-foreground">
    <summary className="cursor-pointer focus-visible:outline focus-visible:outline-ring">Hangi eylemler kaydedilir</summary>
    <p className="mt-2">Bu günlük şu işlemleri kapsar:</p>
    <ul className="mt-2 max-w-3xl list-disc space-y-1 pl-5">
      <li>Proje gizlilik ayarlarının oluşturulması; biyometrik veri işleme, kart okuma saklama süresi ve yapay zekâda ad gizleme ayarlarının değiştirilmesi.</li>
      <li>Çalışan rızalarının alınması ve iptali; ziyaretçi rızasının alınması.</li>
      <li>Çalışan silinirken kişisel verilerin temizlenmesi ve canlı izleme okumasından çalışana kart atanması.</li>
      <li>Elle PDKS kaydı oluşturma, düzeltme, toplu işleme ve silme.</li>
      <li>Tatil ekleme, silme ve resmî tatilleri toplu ekleme; mesai oranlarını kaydetme.</li>
      <li>Biyometrik imha sürecinin başlatılması ve ilerleme sonuçları; saklama süresi dolan kart okumalarının otomatik temizliği.</li>
    </ul>
    <p className="mt-2">Diğer yönetim işlemleri bu günlüğe kaydedilmez. Projesiz toplu işlemler, tüm projeler görünümünde yer alır.</p>
  </details>;
}

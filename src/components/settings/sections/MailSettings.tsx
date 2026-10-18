export function MailSettings({ onComplete: _onComplete }: { onComplete?: () => void }) {
  return <div className="space-y-3 text-sm">
    <p>Davet e-postaları sunucuda yapılandırılmış Resend sağlayıcısı ile gönderilir.</p>
    <p className="text-muted-foreground">Özel SMTP yapılandırması gönderim akışına bağlı değildir. Bu sayfadan SMTP bağlantısı kurulamaz veya davet gönderimi kapatılamaz. Sağlayıcı yapılandırması için sistem yöneticinizle iletişime geçin.</p>
  </div>;
}

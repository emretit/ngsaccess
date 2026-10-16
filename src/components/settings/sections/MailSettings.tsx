import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
export function MailSettings({ onComplete: _onComplete }: { onComplete?: () => void }) {
  return <Card><CardHeader><CardTitle>E-posta gönderimi</CardTitle></CardHeader><CardContent>
    <p>Davet e-postaları sunucuda yapılandırılmış Resend sağlayıcısı ile gönderilir.</p>
    <p className="mt-2 text-sm text-muted-foreground">Özel SMTP yapılandırması henüz gönderim akışına bağlı değildir. Bu sayfadan SMTP bağlantısı kurulamaz veya davet gönderimi kapatılamaz. Sağlayıcı yapılandırması için sistem yöneticinizle iletişime geçin.</p>
  </CardContent></Card>;
}

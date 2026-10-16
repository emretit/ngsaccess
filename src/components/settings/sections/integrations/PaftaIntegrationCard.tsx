import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function PaftaIntegrationCard() {
  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <CardTitle className="text-base">Pafta</CardTitle>
          <Badge variant="secondary">Bağlı değil</Badge>
        </div>
        <CardDescription>
          Pafta entegrasyonu geliştiriliyor — henüz bağlı değil.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Henüz veri aktarımı veya senkronizasyon yapılmıyor. Entegrasyon kullanıma
          hazır olduğunda bağlantı ayarları burada yer alacak.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" disabled>Bağlantıyı Test Et</Button>
          <Button type="button" disabled>Bağlan</Button>
        </div>
      </CardContent>
    </Card>
  );
}

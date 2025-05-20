
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

export default function SecurityCard() {
  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>Güvenlik</CardTitle>
        <CardDescription>
          Hesap güvenliği ayarlarınızı yönetin
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium">Şifre Değiştir</h4>
              <p className="text-sm text-gray-500">Hesap şifrenizi güncellemeyi düşünüyor musunuz?</p>
            </div>
            <Button variant="outline">Şifre Değiştir</Button>
          </div>
          
          <Separator />
          
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium">İki Faktörlü Doğrulama</h4>
              <p className="text-sm text-gray-500">Ekstra güvenlik için iki faktörlü doğrulamayı açın</p>
            </div>
            <Button variant="outline" disabled>Yakında</Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

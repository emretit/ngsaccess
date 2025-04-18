
import { Card } from "@/components/ui/card";

const TemporaryAccess = () => {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Geçici Erişim</h2>
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Geçici Erişim Yönetimi</h3>
        <p className="text-muted-foreground">Geçici erişim izinlerini düzenle</p>
      </Card>
    </div>
  );
};

export default TemporaryAccess;

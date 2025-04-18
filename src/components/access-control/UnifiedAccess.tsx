
import { Card } from "@/components/ui/card";

const UnifiedAccess = () => {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Erişim Yönetimi</h2>
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Erişim Matrisi</h3>
          <p className="text-muted-foreground">Erişim yetkilendirmelerini görüntüle ve düzenle</p>
        </Card>
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Erişim Kuralları</h3>
          <p className="text-muted-foreground">Erişim kurallarını yönet</p>
        </Card>
      </div>
    </div>
  );
};

export default UnifiedAccess;

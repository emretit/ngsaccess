import { useEffect, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Info } from "lucide-react";
import { toast } from "@/hooks/use-toast";

/**
 * IDE Smart panelleri için sistem geneli ortak MQTT kimliği (singleton).
 * Admin "UUID ile ekle" yaparken bu kimlik cihaz satırına kopyalanır. Burada
 * yapılan değişiklik yalnızca BUNDAN SONRA eklenen panelleri etkiler.
 */
export function IdeDefaultsSettings() {
  const defaults = useQuery(api.ideDefaults.get, {});
  const upsert = useMutation(api.ideDefaults.upsert);

  const [ideUser, setIdeUser] = useState("");
  const [idePassword, setIdePassword] = useState("");
  const [ideDoorCount, setIdeDoorCount] = useState(4);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (defaults) {
      setIdeUser(defaults.ideUser);
      setIdePassword(defaults.idePassword);
      setIdeDoorCount(defaults.ideDoorCount);
    }
  }, [defaults]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await upsert({ ideUser, idePassword, ideDoorCount });
      toast({ title: "Başarılı", description: "Varsayılanlar kaydedildi" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Kaydedilemedi";
      toast({ title: "Hata", description: message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (defaults === undefined) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Card className="max-w-lg">
      <CardHeader>
        <CardTitle className="text-base">IDE Smart MQTT Varsayılanları</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-start gap-2 rounded-lg border border-blue-500/30 bg-blue-500/10 p-3 text-xs text-blue-700 dark:text-blue-400">
          <Info className="h-4 w-4 shrink-0 mt-0.5" />
          <span>
            Yeni panel "UUID ile ekle" yapıldığında bu kullanıcı/şifre cihaza kopyalanır.
            Değişiklik yalnızca <strong>bundan sonra</strong> eklenen panelleri etkiler;
            mevcut cihazlar etkilenmez.
          </span>
        </div>

        <div className="space-y-2">
          <Label>MQTT kullanıcı</Label>
          <Input value={ideUser} onChange={(e) => setIdeUser(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>MQTT şifre</Label>
          <Input value={idePassword} onChange={(e) => setIdePassword(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Varsayılan kapı sayısı</Label>
          <Input
            type="number"
            min={1}
            max={8}
            value={ideDoorCount}
            onChange={(e) => setIdeDoorCount(Math.max(1, Math.min(Number(e.target.value) || 1, 8)))}
          />
        </div>

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Kaydet
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}


import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Loader2 } from 'lucide-react';
import { Badge } from './ui/badge';
import { useToast } from './ui/use-toast';

export default function CardReaderTest() {
  const [cardId, setCardId] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cardId) {
      toast({
        title: "Kart ID gerekli",
        description: "Lütfen bir kart ID girin.",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      // Call the Supabase Edge Function
      const { data, error } = await supabase.functions.invoke('card-reader', {
        body: { card_id: cardId }
      });

      if (error) {
        throw error;
      }

      setResult(data);
      toast({
        title: "Kart okuma başarılı",
        description: data.access_granted 
          ? "Erişim izni verildi." 
          : "Erişim reddedildi.",
        variant: data.access_granted ? "default" : "destructive"
      });
    } catch (error) {
      console.error('Error testing card reader:', error);
      toast({
        title: "Hata",
        description: "Kart okuma işlemi başarısız oldu.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Kart Okuyucu Testi (Supabase)</CardTitle>
        <CardDescription>
          Supabase Edge Function ile kart okuyucu testi yapın
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex space-x-2">
            <Input
              placeholder="Kart ID"
              value={cardId}
              onChange={(e) => setCardId(e.target.value)}
              className="flex-1"
            />
            <Button type="submit" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Test Et
            </Button>
          </div>

          {result && (
            <div className="mt-4 p-4 bg-muted rounded-md">
              <div className="flex justify-between items-center mb-2">
                <span className="font-medium">Durum:</span>
                <Badge variant={result.access_granted ? "success" : "destructive"}>
                  {result.access_granted ? 'İzin Verildi' : 'Reddedildi'}
                </Badge>
              </div>
              <div className="text-sm space-y-1">
                <p><span className="font-medium">Mesaj:</span> {result.message}</p>
                <p><span className="font-medium">İşlem ID:</span> {result.reading_id}</p>
              </div>
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  );
}

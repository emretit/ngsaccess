
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageSquare } from "lucide-react";

interface SampleQueriesProps {
  onQuerySelect: (query: string) => void;
  isVisible: boolean;
}

export function SampleQueries({ onQuerySelect, isVisible }: SampleQueriesProps) {
  const sampleQueries = [
    "Bugün kimler geç kaldı?",
    "Bu hafta IT departmanında kimler vardı?",
    "Dün kaç kişi işe geldi?",
    "Bu ay en çok geç kalan 10 kişi",
    "Geçen hafta devamsızlık yapanlar",
    "Bugün hangi departmanlarda kimler var?",
    "Ahmet Yılmaz'ın bu ayki kayıtları",
    "Bu hafta Finans departmanı devam durumu"
  ];

  if (!isVisible) return null;

  return (
    <Card className="mb-4">
      <CardHeader>
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <MessageSquare className="h-4 w-4" />
          Örnek Sorular
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {sampleQueries.map((query, index) => (
            <Button
              key={index}
              variant="outline"
              size="sm"
              className="text-left justify-start h-auto py-2 px-3"
              onClick={() => onQuerySelect(query)}
            >
              <span className="text-xs">{query}</span>
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

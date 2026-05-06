import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageSquare } from "lucide-react";
import { NaturalLanguageService } from "./services/naturalLanguageService";

interface SampleQueriesProps {
  onQuerySelect: (query: string) => void;
  isVisible: boolean;
}

export function SampleQueries({ onQuerySelect, isVisible }: SampleQueriesProps) {
  if (!isVisible) return null;

  const sampleQueries = NaturalLanguageService.getSampleQueries();

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
          {sampleQueries.map((query) => (
            <Button
              key={query}
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

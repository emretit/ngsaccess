
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles } from "lucide-react";

interface AiInsightsCardProps {
  insight?: string;
  isLoading?: boolean;
}

export function AiInsightsCard({ insight, isLoading = false }: AiInsightsCardProps) {
  return (
    <Card className="bg-card border-border">
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
        <CardTitle className="text-md font-medium flex items-center text-primary">
          <Sparkles className="h-4 w-4 mr-2" />
          AI Insights
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-primary rounded-full animate-bounce"></div>
            <div className="w-3 h-3 bg-primary rounded-full animate-bounce animation-delay-200"></div>
            <div className="w-3 h-3 bg-primary rounded-full animate-bounce animation-delay-400"></div>
          </div>
        ) : insight ? (
          <p className="text-sm text-foreground">{insight}</p>
        ) : (
          <p className="text-sm text-muted-foreground">Henüz bir AI değerlendirmesi bulunmuyor.</p>
        )}
      </CardContent>
    </Card>
  );
}

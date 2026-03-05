import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Siparis() {
  return (
    <div className="flex h-[calc(100vh-140px)] flex-col gap-3">
      <div className="flex items-center justify-between rounded-lg border bg-card p-3">
        <p className="text-sm text-muted-foreground">
          Siparis modulu ngsplus.app altinda /siparis-app ile servis ediliyor.
        </p>
        <Button asChild variant="outline" size="sm">
          <a href="/siparis-app/index.html" target="_blank" rel="noreferrer">
            Yeni Sekmede Ac
            <ExternalLink className="ml-2 h-4 w-4" />
          </a>
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden rounded-xl border bg-background shadow-sm">
        <iframe
          title="Siparis"
          src="/siparis-app/index.html"
          className="h-full w-full"
        />
      </div>
    </div>
  );
}

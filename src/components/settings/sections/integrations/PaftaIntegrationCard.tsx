import { StatusBadge } from "@/components/shared/StatusBadge";
export function PaftaIntegrationCard() {
  return <section className="space-y-2 border-t pt-6">
    <div className="flex flex-wrap items-center gap-3"><h3 className="text-base font-semibold">Pafta</h3><StatusBadge tone="neutral">Geliştiriliyor</StatusBadge></div>
    <p className="text-sm text-muted-foreground">Pafta entegrasyonu henüz kullanılamıyor. Bu ekrandan veri aktarımı yapılmaz.</p>
  </section>;
}

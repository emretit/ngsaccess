import { Link } from "react-router-dom";
import { ScanLine } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";

// Sanal okuyucu modeli + QR sözleşmesi (B1) henüz yok; sabit örnek listesi üretimde gösterilmez.
export default function VirtualReaders() {
  return (
    <div className="mx-auto max-w-[1536px] space-y-7">
      <PageHeader title="Sanal Okuyucular" scope="Telefonla QR okutulan giriş noktaları" />
      <section className="max-w-xl rounded-md border border-line bg-surface">
        <EmptyState
          live={false}
          compact
          icon={ScanLine}
          title="Yakında"
          description="Telefonla QR okutulan giriş noktalarının yönetimi hazırlanıyor. Çalışanlar şimdilik mobil uygulamadaki QR tarama ile giriş yapabilir."
        />
        <div className="flex justify-center px-4 pb-6">
          <Button asChild variant="outline" className="min-h-11"><Link to="/devices">Cihazlara git</Link></Button>
        </div>
      </section>
    </div>
  );
}

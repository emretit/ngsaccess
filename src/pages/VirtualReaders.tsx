import { useNavigate } from "react-router-dom";
import { ScanLine } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { useActiveProjectScope } from "@/hooks/useActiveProjectScope";

// Sanal okuyucu modeli + QR sözleşmesi (B1) henüz yok; sabit örnek listesi üretimde gösterilmez.
const VirtualReaders = () => {
  const navigate = useNavigate();
  const { activeProject } = useActiveProjectScope();

  return (
    <div className="mx-auto max-w-[1536px] space-y-7">
      <PageHeader
        title="Sanal Okuyucular"
        scope={`${activeProject?.name ?? "Proje seçilmedi"} · Telefonla QR okutulan giriş noktaları`}
      />
      <section className="rounded-md border border-line bg-surface">
        <EmptyState
          icon={ScanLine}
          title="Henüz kullanıma açılmadı"
          description="Telefonla QR okutularak kullanılan sanal okuyucular hazırlanıyor. Fiziksel QR okuyucuları Cihazlar sayfasından ekleyip yönetebilirsiniz."
          action={{ label: "Cihazlara git", onClick: () => navigate("/devices") }}
        />
      </section>
    </div>
  );
};

export default VirtualReaders;


import { PdksAiChat } from "@/components/pdks/PdksAiChat";

export default function AiReport() {
  return (
    <div className="container mx-auto">
      <h1 className="text-2xl font-semibold mb-6">AI Rapor</h1>
      <div className="glass-card p-4 flex-1 flex flex-col" style={{ minHeight: "calc(100vh - 12rem)" }}>
        <PdksAiChat />
      </div>
    </div>
  );
}

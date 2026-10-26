import { useSearchParams } from "react-router-dom";
import { usePermissions } from "@/hooks/usePermissions";
import { permissionCapabilities, type SettingsTab } from "@/lib/capabilities";
import { cn } from "@/lib/utils";

export const SETTINGS_SECTIONS: { key: SettingsTab; label: string; scope: string }[] = [
  { key: "general", label: "Genel", scope: "Seçili projenin şirket bilgileri ve varsayılanları." },
  { key: "users", label: "Kullanıcılar ve davetler", scope: "Yetkiniz kapsamındaki kullanıcılar. Davette hedef proje ayrıca seçilir." },
  { key: "roles", label: "Roller", scope: "Seçili projenin rol yetkileri." },
  { key: "reports", label: "Raporlar", scope: "Proje kapsamına göre indirme ve kişisel e-posta hatırlatması." },
  { key: "integrations", label: "Entegrasyonlar", scope: "Seçili projenin köprü anahtarları ve entegrasyon bilgileri." },
  { key: "privacy", label: "Gizlilik ve KVKK", scope: "Seçili projenin biyometri, saklama süresi ve asistan gizlilik ayarları." },
  { key: "mail", label: "E-posta gönderimi", scope: "Seçili projenin rapor e-postalarını kendi hesabınızdan (Google Workspace, kurumsal SMTP) gönderme ayarı." },
  { key: "notifications", label: "Bildirimler", scope: "Seçili projenin bildirim tercihleri." },
];
export function SettingsSidebar({ selected, onSelect, disabled = false }: {
  selected: SettingsTab; onSelect: (tab: SettingsTab) => void; disabled?: boolean;
}) {
  const { can, role } = usePermissions();
  const [params] = useSearchParams();
  const items = SETTINGS_SECTIONS.filter(item => permissionCapabilities(can, role).settingsTabs.includes(item.key));
  return <div className="w-full min-w-0 shrink-0 min-[761px]:w-[184px]">
    <div className="space-y-1 min-[761px]:hidden">
      <label htmlFor="settings-section" className="text-sm font-medium">Ayar bölümü</label>
      <select id="settings-section" className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value={selected} disabled={disabled}
        onChange={event => { const item = items.find(item => item.key === event.target.value); if (item) onSelect(item.key); }}>
        {items.map(item => <option key={item.key} value={item.key}>{item.label}</option>)}
      </select>
    </div>
    <nav aria-label="Ayar bölümleri" className="hidden space-y-1 min-[761px]:block">
      {items.map(item => {
        const next = new URLSearchParams(params);
        if (item.key === "general") next.delete("tab"); else next.set("tab", item.key);
        return <a key={item.key} href={`/settings${next.size ? `?${next}` : ""}`} aria-current={selected === item.key ? "page" : undefined} aria-disabled={disabled}
          onClick={event => { if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return; event.preventDefault(); if (!disabled) onSelect(item.key); }}
          className={cn("block rounded px-3 py-2 text-sm hover:bg-subtle", selected === item.key && "bg-selected font-medium text-primary", disabled && "opacity-60")}>
          {item.label}
        </a>;
      })}
    </nav>
  </div>;
}

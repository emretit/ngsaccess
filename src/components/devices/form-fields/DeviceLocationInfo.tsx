
import { FormSelectField } from "@/components/employees/FormFields";
import { Zone, Door } from "@/hooks/useZonesAndDoors";

interface DeviceLocationInfoProps {
  projectId: string;
  onProjectChange: (value: string) => void;
  zoneId: string;
  onZoneChange: (value: string) => void;
  doorId: string;
  onDoorChange: (value: string) => void;
  projects: { id: number; name: string; }[];
  zones: Zone[];
  doors: Door[];
  loading: boolean;
}

export function DeviceLocationInfo({
  projectId,
  onProjectChange,
  zoneId,
  onZoneChange,
  doorId,
  onDoorChange,
  projects,
  zones,
  doors,
  loading
}: DeviceLocationInfoProps) {
  // Filter doors based on selected zone
  const filteredDoors = doors.filter(door => String(door.zone_id) === zoneId);

  return (
    <>
      <FormSelectField
        label="Proje"
        name="project"
        value={projectId}
        onChange={onProjectChange}
        options={projects.map(project => ({
          id: project.id.toString(),
          name: project.name
        }))}
        placeholder="Proje Seçiniz"
      />

      <FormSelectField
        label="Bölge"
        name="zone"
        value={zoneId}
        onChange={(val) => {
          onZoneChange(val);
          if (val !== zoneId) {
            // Bölge değiştiğinde kapı seçimini sıfırla
            onDoorChange('');
          }
        }}
        options={zones.map(zone => ({
          id: String(zone.id),
          name: zone.name
        }))}
        placeholder={loading ? "Yükleniyor..." : "Bölge Seçiniz"}
      />

      <FormSelectField
        label="Kapı"
        name="door"
        value={doorId}
        onChange={onDoorChange}
        options={filteredDoors.map(door => ({
          id: String(door.id),
          name: door.name
        }))}
        placeholder={zoneId 
          ? (filteredDoors.length === 0 
              ? "Seçili bölgede kapı yok" 
              : "Kapı Seçiniz") 
          : "Önce bölge seçiniz"}
        disabled={!zoneId || loading}
      />
    </>
  );
}

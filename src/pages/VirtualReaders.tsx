
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import VirtualReader from "@/components/devices/VirtualReader";

const sampleReaders = [
  { id: "VR-001", label: "Main Entrance" },
  { id: "VR-002", label: "Staff Door" },
  { id: "VR-003", label: "Cafeteria" },
  { id: "VR-004", label: "Conference Room" },
  { id: "VR-005", label: "IT Department" },
  { id: "VR-006", label: "HR Office" },
];

const VirtualReaders = () => {
  return (
    <div className="container mx-auto p-6">
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Virtual QR Readers</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Click on any reader to simulate a QR code scan.
          </p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {sampleReaders.map((reader) => (
          <VirtualReader
            key={reader.id}
            id={reader.id}
            label={reader.label}
          />
        ))}
      </div>
    </div>
  );
};

export default VirtualReaders;

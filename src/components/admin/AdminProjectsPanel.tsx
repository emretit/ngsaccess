import { AdminDataBoundary } from "./components/AdminDataBoundary";
import { AdminProjectsContent } from "./projects/AdminProjectsContent";

export default function AdminProjectsPanel() {
  return (
    <AdminDataBoundary label="Projeler">
      <AdminProjectsContent />
    </AdminDataBoundary>
  );
}

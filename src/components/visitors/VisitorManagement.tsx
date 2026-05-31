import { useMemo, useState } from "react";
import { Visitor, isVisitorInside } from "@/types/visitor";
import { useVisitors } from "@/hooks/useVisitors";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { VisitorFilters, type VisitorStatusFilter } from "./VisitorFilters";
import { VisitorStats } from "./VisitorStats";
import VisitorTable from "./VisitorTable";
import VisitorSlideOverPanel from "./VisitorSlideOverPanel";
import VisitorZoneDialog from "./VisitorZoneDialog";

export default function VisitorManagement() {
  const { visitors, isLoading } = useVisitors();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<VisitorStatusFilter>("all");
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [editingVisitor, setEditingVisitor] = useState<Visitor | null>(null);
  const [isZoneDialogOpen, setIsZoneDialogOpen] = useState(false);

  const filteredVisitors = useMemo(() => {
    let filtered = visitors;

    if (statusFilter === "active") {
      filtered = filtered.filter((v) => v.isActive);
    } else if (statusFilter === "inside") {
      filtered = filtered.filter((v) => isVisitorInside(v));
    } else if (statusFilter === "ended") {
      filtered = filtered.filter((v) => !v.isActive);
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (v) =>
          v.firstName.toLowerCase().includes(q) ||
          v.lastName.toLowerCase().includes(q) ||
          (v.visitorCompany ?? "").toLowerCase().includes(q) ||
          v.cardNumber.toLowerCase().includes(q),
      );
    }

    return filtered;
  }, [visitors, searchQuery, statusFilter]);

  const handleNewVisitor = () => {
    setEditingVisitor(null);
    setIsPanelOpen(true);
  };

  const handleEditVisitor = (visitor: Visitor) => {
    setEditingVisitor(visitor);
    setIsPanelOpen(true);
  };

  const handleClosePanel = () => {
    setIsPanelOpen(false);
    setEditingVisitor(null);
  };

  if (isLoading) {
    return <LoadingSpinner text="Ziyaretçiler yükleniyor..." />;
  }

  return (
    <div className="space-y-3">
      <VisitorFilters
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        onNewVisitor={handleNewVisitor}
        onNewZone={() => setIsZoneDialogOpen(true)}
      />

      <VisitorStats visitors={visitors} />

      <div className="rounded-xl border bg-card shadow-xs">
        <VisitorTable visitors={filteredVisitors} onEdit={handleEditVisitor} />
      </div>

      <VisitorSlideOverPanel
        isOpen={isPanelOpen}
        onClose={handleClosePanel}
        visitor={editingVisitor}
        onSave={handleClosePanel}
      />

      <VisitorZoneDialog
        isOpen={isZoneDialogOpen}
        onClose={() => setIsZoneDialogOpen(false)}
      />
    </div>
  );
}

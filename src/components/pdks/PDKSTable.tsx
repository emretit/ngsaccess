
import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Badge } from "@/components/ui/badge";

interface PDKSRecord {
  id: number;
  employee_first_name: string;
  employee_last_name: string;
  date: string;
  entry_time: string;
  exit_time: string;
  status: string;
}

interface PDKSTableProps {
  records: PDKSRecord[];
  loading: boolean;
  searchTerm: string;
  statusFilter: string;
}

export function PDKSTable({ records, loading, searchTerm, statusFilter }: PDKSTableProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const recordsPerPage = 10;

  // Pagination calculations
  const indexOfLastRecord = currentPage * recordsPerPage;
  const indexOfFirstRecord = indexOfLastRecord - recordsPerPage;
  const currentRecords = records.slice(indexOfFirstRecord, indexOfLastRecord);
  const totalPages = Math.ceil(records.length / recordsPerPage);

  // Status badge styling
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "present":
        return <Badge variant="success">Mevcut</Badge>;
      case "late":
        return <Badge className="bg-yellow-500">Geç</Badge>;
      case "absent":
        return <Badge variant="destructive">Yok</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="flex space-x-2">
          <div className="w-3 h-3 bg-burgundy rounded-full animate-bounce"></div>
          <div className="w-3 h-3 bg-burgundy rounded-full animate-bounce animation-delay-200"></div>
          <div className="w-3 h-3 bg-burgundy rounded-full animate-bounce animation-delay-400"></div>
        </div>
      </div>
    );
  }

  // No records state
  if (records.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        {searchTerm || statusFilter !== "all"
          ? "Arama kriterlerine uygun kayıt bulunamadı"
          : "Henüz kayıt bulunmuyor"}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md border">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="font-semibold">Ad Soyad</TableHead>
              <TableHead className="font-semibold">Tarih</TableHead>
              <TableHead className="font-semibold">Giriş Saati</TableHead>
              <TableHead className="font-semibold">Çıkış Saati</TableHead>
              <TableHead className="font-semibold">Durum</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {currentRecords.map((record) => (
              <TableRow key={record.id} className="hover:bg-muted/30 transition-colors">
                <TableCell className="font-medium">
                  {record.employee_first_name} {record.employee_last_name}
                </TableCell>
                <TableCell>
                  {new Date(record.date).toLocaleDateString("tr-TR")}
                </TableCell>
                <TableCell>{record.entry_time}</TableCell>
                <TableCell>{record.exit_time}</TableCell>
                <TableCell>{getStatusBadge(record.status)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <Pagination className="justify-end">
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                className={currentPage === 1 ? "pointer-events-none opacity-50" : ""}
              />
            </PaginationItem>
            {[...Array(totalPages)].map((_, index) => {
              const pageNumber = index + 1;
              // Show first page, current page, last page, and pages around current
              if (
                pageNumber === 1 ||
                pageNumber === totalPages ||
                (pageNumber >= currentPage - 1 && pageNumber <= currentPage + 1)
              ) {
                return (
                  <PaginationItem key={pageNumber}>
                    <PaginationLink
                      onClick={() => setCurrentPage(pageNumber)}
                      isActive={currentPage === pageNumber}
                    >
                      {pageNumber}
                    </PaginationLink>
                  </PaginationItem>
                );
              } else if (
                pageNumber === currentPage - 2 ||
                pageNumber === currentPage + 2
              ) {
                return (
                  <PaginationItem key={pageNumber}>
                    <PaginationEllipsis />
                  </PaginationItem>
                );
              }
              return null;
            })}
            <PaginationItem>
              <PaginationNext
                onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                className={currentPage === totalPages ? "pointer-events-none opacity-50" : ""}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
    </div>
  );
}

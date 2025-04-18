
'use client';

import { useState } from 'react';
import { Employee } from '@/types/employee';
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Edit2, Trash2 } from "lucide-react";

interface EmployeeTableProps {
  employees: Employee[];
  onEdit: (employee: Employee) => void;
  onDelete: (employee: Employee) => void;
}

export default function EmployeeTable({ employees, onEdit, onDelete }: EmployeeTableProps) {
  const [sortConfig, setSortConfig] = useState<{
    key: keyof Employee;
    direction: 'asc' | 'desc';
  } | null>(null);

  const sortedEmployees = [...employees].sort((a, b) => {
    if (!sortConfig) return 0;
    const { key, direction } = sortConfig;
    
    const aVal = a[key];
    const bVal = b[key];
    
    if (aVal === null || bVal === null) return 0;
    if (aVal < bVal) return direction === 'asc' ? -1 : 1;
    if (aVal > bVal) return direction === 'asc' ? 1 : -1;
    return 0;
  });

  const requestSort = (key: keyof Employee) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Fotoğraf</TableHead>
            <TableHead onClick={() => requestSort('first_name')} className="cursor-pointer">
              Ad Soyad
            </TableHead>
            <TableHead onClick={() => requestSort('email')} className="cursor-pointer">
              E-posta
            </TableHead>
            <TableHead onClick={() => requestSort('department_id')} className="cursor-pointer">
              Departman
            </TableHead>
            <TableHead onClick={() => requestSort('position_id')} className="cursor-pointer">
              Pozisyon
            </TableHead>
            <TableHead onClick={() => requestSort('card_number')} className="cursor-pointer">
              Kart No
            </TableHead>
            <TableHead onClick={() => requestSort('is_active')} className="cursor-pointer">
              Durum
            </TableHead>
            <TableHead className="text-right">İşlemler</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedEmployees.map(employee => (
            <TableRow key={employee.id}>
              <TableCell>
                <Avatar>
                  <AvatarImage src={employee.photo_url || ''} alt={`${employee.first_name} ${employee.last_name}`} />
                  <AvatarFallback>{employee.first_name?.[0]}{employee.last_name?.[0]}</AvatarFallback>
                </Avatar>
              </TableCell>
              <TableCell>{employee.first_name} {employee.last_name}</TableCell>
              <TableCell>{employee.email}</TableCell>
              <TableCell>{employee.departments?.name}</TableCell>
              <TableCell>{employee.positions?.name}</TableCell>
              <TableCell>{employee.card_number}</TableCell>
              <TableCell>
                <Badge variant={employee.is_active ? "success" : "secondary"}>
                  {employee.is_active ? 'Aktif' : 'Pasif'}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onEdit(employee)}
                  className="mr-2"
                >
                  <Edit2 className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onDelete(employee)}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

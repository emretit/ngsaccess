
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Employee } from "@/types/employee";

export function EngineeringDepartmentView() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchEngineeringEmployees() {
      try {
        setLoading(true);
        // First, find the Engineering department ID
        const { data: deptData, error: deptError } = await supabase
          .from('departments')
          .select('id')
          .eq('name', 'Engineering')
          .single();

        if (deptError) {
          console.error("Error fetching Engineering department:", deptError);
          setError("Engineering departmanı bulunamadı");
          setLoading(false);
          return;
        }

        if (!deptData) {
          setError("Engineering departmanı sistemde kayıtlı değil");
          setLoading(false);
          return;
        }

        // Now fetch employees in this department
        const { data: empData, error: empError } = await supabase
          .from('employees')
          .select(`
            *,
            departments (id, name),
            positions (id, name)
          `)
          .eq('department_id', deptData.id);

        if (empError) {
          console.error("Error fetching department employees:", empError);
          setError("Çalışanlar yüklenirken bir hata oluştu");
        } else {
          setEmployees(empData || []);
        }
      } catch (err) {
        console.error("Unexpected error:", err);
        setError("Beklenmeyen bir hata oluştu");
      } finally {
        setLoading(false);
      }
    }

    fetchEngineeringEmployees();
  }, []);

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Engineering Departmanı Çalışanları</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center p-4">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
          </div>
        ) : error ? (
          <div className="text-red-500 p-4">{error}</div>
        ) : employees.length === 0 ? (
          <div className="text-center p-4">Engineering departmanında çalışan bulunamadı</div>
        ) : (
          <>
            <div className="mb-4">
              <p><strong>Gerçek Veritabanı Kayıtları:</strong> Aşağıda Engineering departmanındaki gerçek çalışanlar listelenmektedir.</p>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Adı Soyadı</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Pozisyon</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {employees.map((employee) => (
                  <TableRow key={employee.id}>
                    <TableCell>{employee.first_name} {employee.last_name}</TableCell>
                    <TableCell>{employee.email}</TableCell>
                    <TableCell>{employee.positions?.name || '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <div className="mt-8 border-t pt-4">
              <p><strong>PDKS AI Raporu Çalışanları:</strong></p>
              <p className="text-sm text-gray-500 mb-4">
                PDKS AI asistanı örnek çalışanlar göstermiştir: Ahmet Yılmaz, Ayşe Demir, Mehmet Çelik, Fatma Aydın, Ali Koç
              </p>
              
              <div className="bg-amber-50 p-4 rounded-md border border-amber-200">
                <p className="font-medium">Farklılık Nedeni:</p>
                <ul className="list-disc pl-5 space-y-1 mt-2">
                  <li>PDKS AI asistanı veritabanında gerçek veri bulunamadığında örnek veriler üretmektedir.</li>
                  <li>OpenAI bağlantısı kurulmuş olsa da, gerçek verilerinize doğrudan erişmek için SQL sorguları çalıştırılması gerekmektedir.</li>
                  <li>API anahtarı doğru olsa da, tam fonksiyon için Edge Function üzerinden veritabanına bağlantı yapılandırılması gerekebilir.</li>
                  <li>Bu nedenle AI, rapor istendiğinde gerçek kayıtlar yerine örnek veri göstermiştir.</li>
                </ul>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

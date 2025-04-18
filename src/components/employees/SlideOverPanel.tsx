
import { useEffect, useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from '@/integrations/supabase/client';
import type { Employee } from '@/types/employee';

interface SlideOverPanelProps {
  isOpen: boolean;
  onClose: () => void;
  employee: Employee | null;
  onSave: (employee: any) => void;
}

export default function SlideOverPanel({
  isOpen,
  onClose,
  employee,
  onSave,
}: SlideOverPanelProps) {
  const [formData, setFormData] = useState<any>({
    first_name: '',
    last_name: '',
    email: '',
    tc_no: '',
    card_number: '',
    is_active: true,
  });

  useEffect(() => {
    if (employee) {
      setFormData({
        first_name: employee.first_name,
        last_name: employee.last_name,
        email: employee.email,
        tc_no: employee.tc_no,
        card_number: employee.card_number,
        is_active: employee.is_active,
      });
    } else {
      setFormData({
        first_name: '',
        last_name: '',
        email: '',
        tc_no: '',
        card_number: '',
        is_active: true,
      });
    }
  }, [employee]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (employee) {
        const { data, error } = await supabase
          .from('employees')
          .update(formData)
          .eq('id', employee.id)
          .select()
          .single();

        if (error) throw error;
        onSave(data);
      } else {
        const { data, error } = await supabase
          .from('employees')
          .insert(formData)
          .select()
          .single();

        if (error) throw error;
        onSave(data);
      }
    } catch (error) {
      console.error('Error saving employee:', error);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{employee ? 'Personel Düzenle' : 'Yeni Personel'}</SheetTitle>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="first_name">Ad</Label>
            <Input
              id="first_name"
              name="first_name"
              value={formData.first_name}
              onChange={handleChange}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="last_name">Soyad</Label>
            <Input
              id="last_name"
              name="last_name"
              value={formData.last_name}
              onChange={handleChange}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">E-posta</Label>
            <Input
              id="email"
              name="email"
              type="email"
              value={formData.email}
              onChange={handleChange}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tc_no">TC No</Label>
            <Input
              id="tc_no"
              name="tc_no"
              value={formData.tc_no}
              onChange={handleChange}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="card_number">Kart No</Label>
            <Input
              id="card_number"
              name="card_number"
              value={formData.card_number}
              onChange={handleChange}
              required
            />
          </div>
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="is_active"
              name="is_active"
              checked={formData.is_active}
              onChange={handleChange}
              className="rounded border-gray-300"
            />
            <Label htmlFor="is_active">Aktif</Label>
          </div>
          <div className="flex justify-end space-x-4 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              İptal
            </Button>
            <Button type="submit">
              {employee ? 'Güncelle' : 'Kaydet'}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}

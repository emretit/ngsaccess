// @ts-nocheck

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";

interface AddShiftDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (shift: any) => void;
  onUpdate: (shift: any) => void;
  editingShift: any;
  onClose: () => void;
}

export function AddShiftDialog({ 
  open, 
  onOpenChange, 
  onAdd, 
  onUpdate, 
  editingShift, 
  onClose 
}: AddShiftDialogProps) {
  const [formData, setFormData] = useState({
    name: "",
    startTime: "",
    endTime: "",
    breakDuration: "",
    lunchBreakStart: "",
    lunchBreakEnd: "",
  });

  useEffect(() => {
    if (editingShift) {
      setFormData({
        name: editingShift.name,
        startTime: editingShift.startTime,
        endTime: editingShift.endTime,
        breakDuration: editingShift.breakDuration,
        lunchBreakStart: editingShift.lunchBreakStart,
        lunchBreakEnd: editingShift.lunchBreakEnd,
      });
    } else {
      setFormData({
        name: "",
        startTime: "",
        endTime: "",
        breakDuration: "15",
        lunchBreakStart: "",
        lunchBreakEnd: "",
      });
    }
  }, [editingShift, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (editingShift) {
      onUpdate({ ...editingShift, ...formData });
    } else {
      onAdd(formData);
    }
    
    handleClose();
  };

  const handleClose = () => {
    setFormData({
      name: "",
      startTime: "",
      endTime: "",
      breakDuration: "15",
      lunchBreakStart: "",
      lunchBreakEnd: "",
    });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-gray-900">
            {editingShift ? "Vardiya Düzenle" : "Yeni Vardiya Ekle"}
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <Card>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-sm font-medium text-gray-700">
                    Vardiya Adı *
                  </Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Örn: Sabah Vardiyası"
                    required
                    className="w-full"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="startTime" className="text-sm font-medium text-gray-700">
                      Başlangıç Saati *
                    </Label>
                    <Input
                      id="startTime"
                      type="time"
                      value={formData.startTime}
                      onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="endTime" className="text-sm font-medium text-gray-700">
                      Bitiş Saati *
                    </Label>
                    <Input
                      id="endTime"
                      type="time"
                      value={formData.endTime}
                      onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="breakDuration" className="text-sm font-medium text-gray-700">
                    Mola Süresi (Dakika)
                  </Label>
                  <Input
                    id="breakDuration"
                    type="number"
                    value={formData.breakDuration}
                    onChange={(e) => setFormData({ ...formData, breakDuration: e.target.value })}
                    placeholder="15"
                    min="0"
                    max="120"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="lunchBreakStart" className="text-sm font-medium text-gray-700">
                      Öğle Molası Başlangıç
                    </Label>
                    <Input
                      id="lunchBreakStart"
                      type="time"
                      value={formData.lunchBreakStart}
                      onChange={(e) => setFormData({ ...formData, lunchBreakStart: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lunchBreakEnd" className="text-sm font-medium text-gray-700">
                      Öğle Molası Bitiş
                    </Label>
                    <Input
                      id="lunchBreakEnd"
                      type="time"
                      value={formData.lunchBreakEnd}
                      onChange={(e) => setFormData({ ...formData, lunchBreakEnd: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              className="px-6"
            >
              İptal
            </Button>
            <Button
              type="submit"
              className="bg-primary hover:bg-primary/90 text-white px-6"
            >
              {editingShift ? "Güncelle" : "Kaydet"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

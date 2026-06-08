import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { VisitorFormData } from "./hooks/useVisitorFormData";
import VisitorCardCapture from "./VisitorCardCapture";
import { formatVisitorTime } from "./visitorTime";
import type { Id } from "../../../convex/_generated/dataModel";
import { FieldError } from "@/components/shared/FormFieldWrapper";

interface VisitorFormFieldsProps {
  formData: VisitorFormData;
  setFormData: (data: VisitorFormData) => void;
  presetRules: { id: string; name: string }[];
  hostEmployees: { id: string; name: string }[];
  isEditing: boolean;
  kvkkConsentAt?: string | null;
  errors?: Partial<Record<string, string>>;
}

export default function VisitorFormFields({
  formData,
  setFormData,
  presetRules,
  hostEmployees,
  isEditing,
  kvkkConsentAt,
  errors = {},
}: VisitorFormFieldsProps) {
  const handleChange = <K extends keyof VisitorFormData>(field: K, value: VisitorFormData[K]) => {
    setFormData({ ...formData, [field]: value });
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Ziyaretçi Bilgileri */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium">Ziyaretçi Bilgileri</h3>

        <div>
          <Label htmlFor="v_first_name">Ad *</Label>
          <Input
            id="v_first_name"
            value={formData.firstName}
            onChange={(e) => handleChange("firstName", e.target.value)}
            aria-invalid={!!errors.firstName}
            aria-describedby={errors.firstName ? "v_first_name-error" : undefined}
          />
          <FieldError id="v_first_name-error" message={errors.firstName} />
        </div>

        <div>
          <Label htmlFor="v_last_name">Soyad *</Label>
          <Input
            id="v_last_name"
            value={formData.lastName}
            onChange={(e) => handleChange("lastName", e.target.value)}
            aria-invalid={!!errors.lastName}
            aria-describedby={errors.lastName ? "v_last_name-error" : undefined}
          />
          <FieldError id="v_last_name-error" message={errors.lastName} />
        </div>

        <div>
          <Label htmlFor="v_company">Şirket / Kurum</Label>
          <Input
            id="v_company"
            value={formData.visitorCompany}
            onChange={(e) => handleChange("visitorCompany", e.target.value)}
            placeholder="Ziyaretçinin şirketi"
          />
        </div>

        <div>
          <Label htmlFor="v_phone">Telefon</Label>
          <Input
            id="v_phone"
            value={formData.visitorPhone}
            onChange={(e) => handleChange("visitorPhone", e.target.value)}
            placeholder="05xx xxx xx xx"
          />
        </div>

        <div>
          <Label htmlFor="v_purpose">Ziyaret Amacı</Label>
          <Input
            id="v_purpose"
            value={formData.visitPurpose}
            onChange={(e) => handleChange("visitPurpose", e.target.value)}
            placeholder="Toplantı, kargo, bakım..."
          />
        </div>

        <div>
          <Label htmlFor="v_host">Ziyaret Edilen Kişi</Label>
          <Select
            value={formData.hostEmployeeId ?? ""}
            onValueChange={(value) =>
              handleChange("hostEmployeeId", (value || null) as Id<"employees"> | null)
            }
          >
            <SelectTrigger id="v_host">
              <SelectValue placeholder="Personel seçin" />
            </SelectTrigger>
            <SelectContent>
              {hostEmployees.map((emp) => (
                <SelectItem key={emp.id} value={emp.id}>
                  {emp.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Erişim Bilgileri */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium">Erişim Bilgileri</h3>

        <VisitorCardCapture onCapture={(no) => handleChange("cardNumber", no)} />

        <div>
          <Label htmlFor="v_card">Kart Numarası *</Label>
          <Input
            id="v_card"
            value={formData.cardNumber}
            onChange={(e) => handleChange("cardNumber", e.target.value)}
            placeholder="Karta okutun veya elle girin"
            aria-invalid={!!errors.cardNumber}
            aria-describedby={errors.cardNumber ? "v_card-error" : undefined}
          />
          <FieldError id="v_card-error" message={errors.cardNumber} />
        </div>

        <div>
          <Label htmlFor="v_zone">Ziyaretçi Bölgesi *</Label>
          <Select
            value={formData.presetRuleId ?? ""}
            onValueChange={(value) =>
              handleChange("presetRuleId", (value || null) as Id<"accessRules"> | null)
            }
            disabled={isEditing}
          >
            <SelectTrigger id="v_zone">
              <SelectValue placeholder="Erişebileceği bölge" />
            </SelectTrigger>
            <SelectContent>
              {presetRules.map((rule) => (
                <SelectItem key={rule.id} value={rule.id}>
                  {rule.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {isEditing ? (
            <p className="text-xs text-muted-foreground mt-1">
              Bölge düzenlemede değiştirilemez. Farklı bölge için yeni ziyaretçi oluşturun.
            </p>
          ) : presetRules.length === 0 ? (
            <p className="text-xs text-amber-600 mt-1">
              Hazır ziyaretçi bölgesi yok. Erişim Yönetimi'nde hedef türü "Ziyaretçi" olan bir
              kural oluşturun.
            </p>
          ) : null}
        </div>

        <div>
          <Label htmlFor="v_expires">Geçerlilik Bitişi *</Label>
          <Input
            id="v_expires"
            type="datetime-local"
            value={formData.accessExpiresAt}
            onChange={(e) => handleChange("accessExpiresAt", e.target.value)}
            required
          />
          <p className="text-xs text-muted-foreground mt-1">
            Bu zamandan sonra erişim otomatik olarak iptal edilir (TR saati).
          </p>
        </div>

        <div>
          <Label htmlFor="v_notes">Notlar</Label>
          <Textarea
            id="v_notes"
            value={formData.notes}
            onChange={(e) => handleChange("notes", e.target.value)}
            placeholder="Ek notlar..."
            rows={3}
          />
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="v_active"
            checked={formData.isActive}
            onCheckedChange={(checked) => handleChange("isActive", checked === true)}
          />
          <Label htmlFor="v_active">Erişim aktif</Label>
        </div>

        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="v_kvkk"
              checked={formData.kvkkConsent}
              disabled={!!kvkkConsentAt}
              onCheckedChange={(checked) => handleChange("kvkkConsent", checked === true)}
            />
            <Label htmlFor="v_kvkk">KVKK aydınlatma metni onaylandı</Label>
          </div>
          {kvkkConsentAt && (
            <p className="text-xs text-muted-foreground">
              Rıza alındı: {formatVisitorTime(kvkkConsentAt)}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

import { Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { notify } from "@/lib/notify";
import {
  auditChanges,
  auditFieldDisplayValue,
  auditFieldLabel,
  maskAuditValue,
  redactAuditValue,
} from "./auditLabels";

interface Props {
  targetTable: string;
  targetId: string;
  oldValue?: unknown;
  newValue?: unknown;
  action?: "create" | "update" | "delete";
  note?: string;
}

export function AuditChangeDetail({
  targetTable,
  targetId,
  oldValue,
  newValue,
  action,
  note,
}: Props) {
  const changes = auditChanges(oldValue, newValue);
  const copyId = async () => {
    try {
      await navigator.clipboard.writeText(targetId);
      notify.success("Hedef kimliği kopyalandı");
    } catch (error: unknown) {
      notify.error("Kopyalanamadı; kimliği seçip kopyalayabilirsiniz.", error);
    }
  };
  return (
    <div className="min-w-0 space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">Tam hedef kimliği</span>
        <code className="min-w-0 break-all text-xs select-all">{targetId}</code>
        <Button
          variant="outline"
          size="sm"
          aria-label="Tam hedef kimliğini kopyala"
          onClick={copyId}
        >
          <Copy className="mr-2 h-4 w-4" aria-hidden="true" />
          Kopyala
        </Button>
      </div>
      {action && <><h3 className="text-sm font-semibold">Not</h3><p className="whitespace-pre-wrap [overflow-wrap:anywhere] text-sm">{note || "Not kaydedilmemiş."}</p><h3 className="text-sm font-semibold">Değişen alanlar</h3><p className="text-xs text-muted-foreground">Kaydedilmedi: ilgili değer olay verisinde bulunmuyor.{action === "create" ? " Oluşturma olayında önceki değer kaydedilmemiş olabilir." : action === "delete" ? " Silme olayında sonraki değer kaydedilmemiş olabilir." : " Eksik değer, daha önce hiç değer olmadığı anlamına gelmez."}</p></>}
      {changes.length ? (
        <div role="table" aria-label="Değişen alanlar" className="divide-y border-y">
          <div
            role="row"
            className="hidden md:grid md:grid-cols-3 gap-3 py-2 text-sm font-medium"
          >
            <span role="columnheader">Alan</span>
            <span role="columnheader">Önce</span>
            <span role="columnheader">Sonra</span>
          </div>
          {changes.map((change) => (
            <div
              role="row"
              key={change.field}
              className="grid min-w-0 grid-cols-1 gap-3 py-3 md:grid-cols-3"
            >
              <div role="rowheader" className="break-words text-sm font-medium">
                {auditFieldLabel(targetTable, change.field)}
              </div>
              <div
                role="cell"
                className="min-w-0 whitespace-pre-wrap [overflow-wrap:anywhere] text-sm"
              >
                <span className="mr-2 font-medium md:hidden">Önce:</span>
                {auditFieldDisplayValue(change.field, maskAuditValue(change.field, change.before))}
              </div>
              <div
                role="cell"
                className="min-w-0 whitespace-pre-wrap [overflow-wrap:anywhere] text-sm"
              >
                <span className="mr-2 font-medium md:hidden">Sonra:</span>
                {auditFieldDisplayValue(change.field, maskAuditValue(change.field, change.after))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Alan düzeyinde değişiklik kaydedilmemiş.
        </p>
      )}
      <details>
        <summary className="cursor-pointer rounded text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          Teknik ayrıntı (ham JSON)
        </summary>
        <div className="mt-3 grid min-w-0 grid-cols-1 gap-3 md:grid-cols-2">
          {[
            ["Önce", oldValue],
            ["Sonra", newValue],
          ].map(([label, value], index) => (
            <div key={index} className="min-w-0">
              <h4 className="mb-2 text-sm font-medium">{String(label)}</h4>
              <pre className="max-h-60 overflow-auto whitespace-pre-wrap break-all rounded bg-muted p-3 text-xs">
                {value == null ? "Kaydedilmedi" : JSON.stringify(redactAuditValue(value), null, 2)}
              </pre>
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}

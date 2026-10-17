import { Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { notify } from "@/lib/notify";
import {
  auditChanges,
  auditDisplayValue,
  auditFieldLabel,
  maskAuditValue,
  redactAuditValue,
} from "./auditLabels";

interface Props {
  targetTable: string;
  targetId: string;
  oldValue?: unknown;
  newValue?: unknown;
}

export function AuditChangeDetail({
  targetTable,
  targetId,
  oldValue,
  newValue,
}: Props) {
  const changes = auditChanges(oldValue, newValue);
  const copyId = async () => {
    try {
      await navigator.clipboard.writeText(targetId);
      notify.success("Hedef kimliği kopyalandı");
    } catch (error: unknown) {
      notify.error("Hedef kimliği kopyalanamadı", error);
    }
  };
  return (
    <div className="min-w-0 space-y-4 p-3">
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
      {changes.length ? (
        <div role="table" aria-label="Değişen alanlar" className="space-y-2">
          <div
            role="row"
            className="hidden md:grid md:grid-cols-3 gap-3 text-sm font-medium"
          >
            <span role="columnheader">Alan</span>
            <span role="columnheader">Önce</span>
            <span role="columnheader">Sonra</span>
          </div>
          {changes.map((change) => (
            <div
              role="row"
              key={change.field}
              className="grid min-w-0 grid-cols-1 gap-3 rounded-lg border p-3 md:grid-cols-3"
            >
              <div role="rowheader" className="break-words text-sm font-medium">
                {auditFieldLabel(targetTable, change.field)}
              </div>
              <div
                role="cell"
                className="min-w-0 whitespace-pre-wrap break-words text-sm"
              >
                <span className="mr-2 font-medium md:hidden">Önce:</span>
                {auditDisplayValue(maskAuditValue(change.field, change.before))}
              </div>
              <div
                role="cell"
                className="min-w-0 whitespace-pre-wrap break-words text-sm"
              >
                <span className="mr-2 font-medium md:hidden">Sonra:</span>
                {auditDisplayValue(maskAuditValue(change.field, change.after))}
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
              <pre className="max-h-60 overflow-auto rounded bg-muted p-3 text-xs">
                {value == null ? "—" : JSON.stringify(redactAuditValue(value), null, 2)}
              </pre>
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}
